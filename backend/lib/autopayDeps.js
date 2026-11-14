// The plugs between AutoPay and your earlier days. Already wired to your real files:
//   db.js (User), authmiddleware.js, services/pin.js (checkPin), services/money.js (transferInSession)

const { User } = require("../db");
const authMiddleware = require("../authmiddleware"); // exports the function directly, sets req.userId
const { checkPin, PinError } = require("../services/pin");
const { transferInSession } = require("../services/money");

function getUserId(req) {
  return String(req.userId);
}

// Day 6 checkPin THROWS a PinError when the PIN is wrong, locked or not set.
// The AutoPay route wants a plain result instead.
async function verifyPin(userId, pin) {
  try {
    await checkPin(userId, pin);
    return { ok: true };
  } catch (err) {
    if (err instanceof PinError) {
      const body = { message: err.message };
      const left = /(\d+) attempts? left/.exec(err.message);
      if (left) body.triesLeft = Number(left[1]);
      return { ok: false, status: err.status, body };
    }
    throw err;
  }
}

// The nightly job's payment. It runs inside the transaction the job opened (`session`),
// so the claim, the money and the run record save together or not at all.
// transferInSession throws MoneyError (400 "Insufficient balance", 404 ...) when it cannot pay.
async function moveMoney({ session, fromUserId, toUserId, amount, note }) {
  const toUser = await User.findById(toUserId).session(session);
  if (!toUser) {
    const e = new Error("Payee not found");
    e.status = 404;
    throw e;
  }
  const result = await transferInSession({ session, fromUserId, toUser, amount, note });
  return { transactionId: result.transaction.id };
}

// Turns an error from moveMoney into the reason saved on a FAILED run.
// MoneyError carries a status below 500 (e.g. "Insufficient balance"): expected.
// Anything else is logged by the job as unexpected.
function describeError(err) {
  const expected = typeof err.status === "number" && err.status < 500;
  return { expected, reason: expected ? err.message : "Payment failed" };
}

module.exports = { User, authMiddleware, getUserId, verifyPin, moveMoney, describeError };