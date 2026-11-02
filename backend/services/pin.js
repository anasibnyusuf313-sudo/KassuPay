const bcrypt = require("bcryptjs");
const { User } = require("../db");

const MAX_TRIES = 5;
const LOCK_MINUTES = 5;

// An expected PIN problem that carries a status code
class PinError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function lockedMessage(until) {
  const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return `Too many wrong PIN attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

// Checks the PIN. Throws a PinError if it is wrong, locked, or not set.
async function checkPin(userId, pin) {
  const now = new Date();

  // 1. Reserve an attempt BEFORE comparing, in one atomic step.
  //    If someone fires 100 guesses at once, they still get only 5 real tries,
  //    because every request must first take the next number.
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      pinHash: { $ne: null }, // a PIN exists
      $or: [{ pinLockedUntil: null }, { pinLockedUntil: { $lte: now } }], // not locked
    },
    { $inc: { pinFailedAttempts: 1 } },
    { returnDocument: "after" }
  ).select("+pinHash");

  // 2. Nothing matched: find out why
  if (!user) {
    const u = await User.findById(userId).select("pinSetAt pinLockedUntil");
    if (!u) throw new PinError(404, "User not found");
    if (u.pinLockedUntil && u.pinLockedUntil > now) {
      throw new PinError(429, lockedMessage(u.pinLockedUntil));
    }
    throw new PinError(403, "Set a payment PIN first");
  }

  // 3. Too many guesses arrived together: refuse without comparing
  if (user.pinFailedAttempts > MAX_TRIES) {
    throw new PinError(429, "Too many wrong PIN attempts. Try again later.");
  }

  // 4. Compare
  const ok = await bcrypt.compare(pin, user.pinHash);
  if (ok) {
    await User.updateOne({ _id: userId }, { pinFailedAttempts: 0, pinLockedUntil: null });
    return;
  }

  // 5. Wrong: lock on the last try, otherwise say how many are left
  if (user.pinFailedAttempts >= MAX_TRIES) {
    const until = new Date(Date.now() + LOCK_MINUTES * 60000);
    await User.updateOne({ _id: userId }, { pinFailedAttempts: 0, pinLockedUntil: until });
    throw new PinError(429, lockedMessage(until));
  }
  const left = MAX_TRIES - user.pinFailedAttempts;
  throw new PinError(403, `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.`);
}

module.exports = { PinError, checkPin };