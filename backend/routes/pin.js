const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../authmiddleware"); // use the same require line as in your wallet.js
const { User } = require("../db");
const { PinError, checkPin } = require("../services/pin");
const { cacheDel } = require("../redis");

const router = express.Router();

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

// A PIN is a string of exactly 4 digits. A string, not a number, so "0042" keeps its zeros.
const pinField = z.string().regex(/^\d{4}$/, "must be exactly 4 digits");

// ---------------- SET (first time, or forgot it) ----------------
// Needs the account PASSWORD, so a stolen login token alone cannot set a PIN
const setSchema = z
  .object({ pin: pinField, password: z.string().min(1, "is required") })
  .strict();

router.post("/set", authMiddleware, async (req, res) => {
  const result = setSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { pin, password } = result.data;

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // 403, not 401, so the app does not log the person out
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(403).json({ error: "Wrong password" });
  }

  const pinHash = await bcrypt.hash(pin, 10);
  await User.updateOne(
    { _id: req.userId },
    { pinHash, pinSetAt: new Date(), pinFailedAttempts: 0, pinLockedUntil: null }
  );
  await cacheDel(`user:${req.userId}`); // /me is cached and must now say hasPin: true

  res.status(201).json({ message: "PIN set" });
});

// ---------------- CHANGE (knows the old PIN) ----------------
const changeSchema = z.object({ oldPin: pinField, newPin: pinField }).strict();

router.post("/change", authMiddleware, async (req, res) => {
  const result = changeSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { oldPin, newPin } = result.data;

  if (oldPin === newPin) {
    return res.status(400).json({ error: "New PIN must be different from the old one" });
  }

  try {
    await checkPin(req.userId, oldPin); // wrong tries count towards the lockout
  } catch (err) {
    if (err instanceof PinError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }

  const pinHash = await bcrypt.hash(newPin, 10);
  await User.updateOne({ _id: req.userId }, { pinHash, pinSetAt: new Date() });
  await cacheDel(`user:${req.userId}`);

  res.json({ message: "PIN changed" });
});

module.exports = router;