const mongoose = require("mongoose");
const MoneyRequest = require("../models/MoneyRequest");
const { User, Transaction } = require("../db");
const { MoneyError, transferInSession } = require("./money");
const { DAILY_LIMIT_PAISE } = require("../config");

// Thrown inside the pay transaction when the PENDING -> PAID step found nothing.
// The reason is worked out AFTER the transaction has rolled back (see explainFailure).
class StateMissed extends Error {}

// ---------- who may do what ----------
// For a request that could not be changed, work out the right error.
// This read is ONLY for the message. The atomic update is the real protection.
async function explainFailure(id, userId, role, action) {
  const doc = mongoose.isValidObjectId(id) ? await MoneyRequest.findById(id) : null;
  const isRequester = doc && doc.requesterId.equals(userId);
  const isPayer = doc && doc.payerId.equals(userId);

  if (!doc || (!isRequester && !isPayer)) return new MoneyError(404, "Request not found");

  if (role === "payerId" && !isPayer) {
    return new MoneyError(403, `Only the person asked can ${action} this request`);
  }
  if (role === "requesterId" && !isRequester) {
    return new MoneyError(403, `Only the person who asked can ${action} this request`);
  }

  const expired =
    doc.status === "EXPIRED" || (doc.status === "PENDING" && doc.expiresAt <= new Date());
  if (expired) return new MoneyError(410, "This request has expired");

  return new MoneyError(409, `This request is already ${doc.status}`);
}

// ---------- decline / cancel: one atomic step ----------
// role is "payerId" (decline) or "requesterId" (cancel)
async function changeState({ id, userId, role, newStatus, action }) {
  const now = new Date();
  const doc = mongoose.isValidObjectId(id)
    ? await MoneyRequest.findOneAndUpdate(
        { _id: id, [role]: userId, status: "PENDING", expiresAt: { $gt: now } },
        { $set: { status: newStatus, decidedAt: now } },
        { returnDocument: "after" }
      )
    : null;
  if (!doc) throw await explainFailure(id, userId, role, action);
  return doc;
}

const declineRequest = (id, userId) =>
  changeState({ id, userId, role: "payerId", newStatus: "DECLINED", action: "decline" });

const cancelRequest = (id, userId) =>
  changeState({ id, userId, role: "requesterId", newStatus: "CANCELLED", action: "cancel" });

// ---------- lazy expiry ----------
// No cron job, no worker. Old pending requests of this user are marked EXPIRED
// just before we read their lists.
async function expireOldFor(userId) {
  await MoneyRequest.updateMany(
    {
      $or: [{ payerId: userId }, { requesterId: userId }],
      status: "PENDING",
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: "EXPIRED", decidedAt: new Date() } }
  );
}

// ---------- daily limit (counted inside the transaction) ----------
// STAND-IN for your Day 6 daily-limit code (I did not have it). It sums the
// TRANSFER money this user sent in the last 24 hours. Swap in your own check here.
async function assertDailyLimit(session, userId, amount) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await Transaction.aggregate([
    {
      $match: {
        type: "TRANSFER",
        fromUserId: new mongoose.Types.ObjectId(String(userId)),
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);

  const sentToday = row ? row.total : 0;
  if (sentToday + amount > DAILY_LIMIT_PAISE) {
    throw new MoneyError(400, "Daily limit reached");
  }
}

// ---------- PAY: state change + money, one transaction ----------
async function payRequest({ id, payerId }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const now = new Date();

      // 1. Cheapest check first: PENDING -> PAID, only if still pending,
      //    not expired, and I am the payer.
      const request = await MoneyRequest.findOneAndUpdate(
        { _id: id, payerId, status: "PENDING", expiresAt: { $gt: now } },
        { $set: { status: "PAID", decidedAt: now } },
        { returnDocument: "after", session }
      );
      if (!request) throw new StateMissed();

      // 2. Daily limit
      await assertDailyLimit(session, payerId, request.amount);

      // 3. Same money code as /transfer: debit payer, credit requester, ledger rows
      const requester = await User.findById(request.requesterId).session(session);
      if (!requester) throw new MoneyError(404, "Requester not found");

      // Transaction.note allows only 50 characters (db.js), a request note allows 100
      const note = (request.note ? `Request: ${request.note}` : "Request payment").slice(0, 50);
      const out = await transferInSession({
        session,
        fromUserId: payerId,
        toUser: requester,
        amount: request.amount,
        note,
      });

      // 4. Remember which money movement paid this request
      await MoneyRequest.updateOne(
        { _id: request._id },
        { $set: { transactionId: out.transaction.id } },
        { session }
      );

      result = { transactionId: out.transaction.id, balance: out.balance };
    });
    return result;
  } catch (err) {
    // The transaction has rolled back, so the request is still as it was.
    if (err instanceof StateMissed) throw await explainFailure(id, payerId, "payerId", "pay");
    throw err;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  declineRequest,
  cancelRequest,
  expireOldFor,
  payRequest,
};
