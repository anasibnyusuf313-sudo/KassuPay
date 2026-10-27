const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Wallet } = require("../db");
const { JWT_SECRET } = require("../config");
const authMiddleware = require("../middleware");
const { cacheGet, cacheSet, cacheDel } = require("../redis"); // NEW

const router = express.Router();

// Turns a Zod error into a simple string for the first error found.
function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

// ---------------- SIGNUP ----------------
const signupSchema = z.object({
  username: z.string().trim().toLowerCase().email("must be a valid email"),
  firstName: z.string().trim().min(1, "is required").max(20, "is too long"),
  lastName: z.string().trim().min(1, "is required").max(20, "is too long"),
  password: z.string().min(6, "must be at least 6 characters"),
});

router.post("/signup", async (req, res) => {
  // 1. Data validation: check the request shape
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { username, firstName, lastName, password } = result.data;

  // 2. Is email already registered?
  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(409).json({ error: "This email is already registered" });
  }

  // 3. Hash the password. We never store the password itself.
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Save the user in MongoDB
  const user = new User({ username, firstName, lastName, passwordHash });
  await user.save();

  // 5. Create a wallet for the user, starting with 0 balance (in paise)
  const wallet = new Wallet({ userId: user.id, balance: 0 });
  await wallet.save();

  // 6. Reply 
  res.status(201).json({
    message: "User created successfully",
    user: { id: user.id, username, firstName, lastName },
    wallet: { id: wallet.id, balance: wallet.balance },
  });
});

// ---------------- SIGNIN ----------------
const signinSchema = z.object({
  username: z.string().trim().toLowerCase().email("must be a valid email"),
  password: z.string().min(1, "is required"),
});

router.post("/signin", async (req, res) => {
  // 1. Validate the request body
  const result = signinSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { username, password } = result.data;

  // 2. Find the user by email
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: "Wrong email or password" });
  }

  // 3. Check the password
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Wrong email or password" });
  }

  // 4. Make a token that expires in 1 hour
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });

  // 5. Reply with the token
  res.json({ message: "Signed in", token });
});

// ----------------(cached for 60 seconds) ----------------
router.get("/me", authMiddleware, async (req, res) => {
  const key = `user:${req.userId}`;

  // 1. Check Redis first for a cached copy of the user profile
  const cached = await cacheGet(key);
  if (cached) {
    return res.json({ user: cached, source: "cache" });
  }

  // 2. Not there: ask the database
  const user = await User.findById(req.userId).select("-passwordHash");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const profile = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
  };

  // 3. Save a copy for 60 seconds
  await cacheSet(key, profile, 60);

  res.json({ user: profile, source: "database" });
});

// ---------------- EDIT PROFILE (deletes the cached copy) ---------------- NEW
const updateSchema = z
  .object({
    firstName: z.string().trim().min(1, "is required").max(20, "is too long").optional(),
    lastName: z.string().trim().min(1, "is required").max(20, "is too long").optional(),
    password: z.string().min(6, "must be at least 6 characters").optional(),
  })
  .strict();

router.put("/", authMiddleware, async (req, res) => {
  const result = updateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }

  const { firstName, lastName, password } = result.data;
  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Send at least one of firstName, lastName, password" });
  }

  await User.updateOne({ _id: req.userId }, updates);
  await cacheDel(`user:${req.userId}`); // the old copy is now wrong

  res.json({ message: "Profile updated" });
});

module.exports = router;