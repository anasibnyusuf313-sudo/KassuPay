const mongoose = require("mongoose");
const Mandate = require("../models/Mandate");
const MandateRun = require("../models/MandateRun");
const { nextMonth, daysBetween } = require("../lib/dates");
const { moveMoney, describeError } = require("../lib/autopayDeps");

const BATCH = 50; // at most this many AutoPays per call (A8)
const GRACE_DAYS = 3; // later than this is MISSED, not paid (A6)
const MAX_FAILS = 3; // failures in a row before the AutoPay pauses itself (A7)

// thrown when another run already did this month: skip quietly
class Skip extends Error {}
// duplicate key on the unique run record (lock 2) also means "already done"
const isSkip = (e) => e instanceof Skip || (e && e.code === 11000);

// run fn(session) in one transaction (Day 3): everything saves, or nothing does
async function inTx(fn) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

// LOCK 1 (A5): move nextRunDay forward, but only if it is still the day we are about to handle.
// Only one run can win. The other gets null and skips.
async function claim(m, dueDay, session) {
  const claimed = await Mandate.findOneAndUpdate(
    { _id: m._id, status: "ACTIVE", nextRunDay: dueDay },
    { $set: { nextRunDay: nextMonth(dueDay) } },
    { new: true, session }
  );
  if (!claimed) throw new Skip();
  return claimed;
}

// too late: record MISSED, move on, never charge
function markMissed(m, dueDay) {
  return inTx(async (session) => {
    await claim(m, dueDay, session);
    // LOCK 2: unique { mandateId, dueDay }
    await MandateRun.create(
      [{ mandateId: m._id, dueDay, status: "MISSED", amount: m.amount, reason: "More than 3 days late" }],
      { session }
    );
  });
}

// claim + money + run record in ONE transaction: they can never disagree
function pay(m, dueDay) {
  return inTx(async (session) => {
    await claim(m, dueDay, session);
    const { transactionId } = await moveMoney({
      session,
      fromUserId: m.payerId,
      toUserId: m.payeeId,
      amount: m.amount,
      note: "AutoPay",
    });
    await MandateRun.create(
      [{ mandateId: m._id, dueDay, status: "SUCCESS", amount: m.amount, transactionId }],
      { session }
    );
    await Mandate.updateOne({ _id: m._id }, { $set: { failedCount: 0 } }, { session });
  });
}

// the payment failed (its transaction rolled back): record it, still move to next month,
// count the failure, pause after MAX_FAILS in a row
function fail(m, dueDay, reason) {
  return inTx(async (session) => {
    const claimed = await claim(m, dueDay, session);
    await MandateRun.create(
      [{ mandateId: m._id, dueDay, status: "FAILED", amount: m.amount, reason }],
      { session }
    );
    const fails = claimed.failedCount + 1;
    await Mandate.updateOne(
      { _id: m._id },
      { $set: { failedCount: fails, ...(fails >= MAX_FAILS ? { status: "PAUSED" } : {}) } },
      { session }
    );
  });
}

// One AutoPay. Pays at most ONE month per run. Never throws: one bad AutoPay
// must not stop the other 299 (A7).
async function processOne(m, today) {
  const res = { succeeded: 0, failed: 0, missed: 0 };
  let dueDay = m.nextRunDay;

  try {
    while (dueDay <= today) {
      // very late: MISSED, then look at the next month
      if (daysBetween(dueDay, today) > GRACE_DAYS) {
        try {
          await markMissed(m, dueDay);
        } catch (e) {
          if (isSkip(e)) return res; // another run got it
          throw e;
        }
        res.missed++;
        dueDay = nextMonth(dueDay);
        continue;
      }

      // inside the grace window: pay it
      try {
        await pay(m, dueDay);
        res.succeeded++;
      } catch (e) {
        if (isSkip(e)) return res; // another run got it
        const { expected, reason } = describeError(e);
        if (!expected) console.error("[autopay] unexpected error", String(m._id), dueDay, e);
        try {
          await fail(m, dueDay, reason);
          res.failed++;
        } catch (e2) {
          if (!isSkip(e2)) console.error("[autopay] could not record failure", String(m._id), dueDay, e2);
        }
      }
      break; // one paid/failed month per run
    }
  } catch (e) {
    console.error("[autopay] error on", String(m._id), e);
  }
  return res;
}

// The nightly job (A4): everything DUE (nextRunDay <= today), not just today's.
async function runDue(today) {
  const rows = await Mandate.find({ status: "ACTIVE", nextRunDay: { $lte: today } })
    .sort({ nextRunDay: 1, _id: 1 })
    .limit(BATCH + 1);
  const more = rows.length > BATCH;
  const batch = rows.slice(0, BATCH);

  const summary = { date: today, due: batch.length, succeeded: 0, failed: 0, missed: 0, more };
  for (const m of batch) {
    const r = await processOne(m, today);
    summary.succeeded += r.succeeded;
    summary.failed += r.failed;
    summary.missed += r.missed;
  }
  return summary;
}

module.exports = { runDue, BATCH, GRACE_DAYS, MAX_FAILS };
