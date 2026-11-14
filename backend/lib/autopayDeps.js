// ============================================================================
// THE ONLY FILE YOU MUST EDIT.
//
// AutoPay reuses code you wrote on earlier days. I could not see those files,
// so the four things below are the "plugs". Point each one at your own code.
// Everything else in the Day 10 files stays as it is.
// ============================================================================

// 1. Your User model (used to check the payee exists and to show names).
//    Fields used: _id, firstName, lastName.
const User = require("../models/User"); // <- change the path if yours differs

// 2. Your auth middleware (Day 1 to 3). It must put the logged-in user's id on the request.
const authMiddleware = require("../middleware/auth"); // <- change the path/name if yours differs

// how to read the logged-in user's id after authMiddleware ran
function getUserId(req) {
  return String(req.userId || (req.user && (req.user.id || req.user._id)));
}

// 3. Your Day 6 PIN check.
//    Must return { ok: true } when the PIN is right, or
//    { ok: false, status: 403, body: { message: "Wrong PIN. 2 tries left", triesLeft: 2 } }.
async function verifyPin(userId, pin) {
  // EXAMPLE (adjust to your checkPin):
  //   const { checkPin } = require("../services/pin");
  //   return checkPin(userId, pin);
  throw new Error("Wire verifyPin in backend/lib/autopayDeps.js");
}

// 4. Your Day 7 shared money function (the one requests.js uses when a request is paid).
//    It MUST:
//      - run inside the given mongoose `session` (do not start your own transaction)
//      - apply the Day 6 daily limit and write the ledger rows
//      - throw an error when it cannot pay (insufficient balance, daily limit...)
//      - return { transactionId }
async function moveMoney({ session, fromUserId, toUserId, amount, note }) {
  // EXAMPLE (adjust to your function):
  //   const { transferMoney } = require("../services/transfer");
  //   const tx = await transferMoney({ session, from: fromUserId, to: toUserId, amount, note });
  //   return { transactionId: tx._id };
  throw new Error("Wire moveMoney in backend/lib/autopayDeps.js");
}

// Turns an error from moveMoney into a short reason saved on the FAILED run.
// "Expected" errors (no balance, daily limit) are your own Day 3 / Day 6 errors.
// Anything else is logged as unexpected by the job.
function describeError(err) {
  const expected = typeof err.status === "number" && err.status < 500;
  return { expected, reason: expected ? err.message : "Payment failed" };
}

module.exports = { User, authMiddleware, getUserId, verifyPin, moveMoney, describeError };
