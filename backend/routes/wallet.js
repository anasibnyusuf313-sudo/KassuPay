const express = require("express");
const { z } = require("zod");
const authMiddleware = require("../middleware");
const { User, Wallet, LedgerEntry, IdempotencyRecord } = require("../db");
const { MoneyError, runTransfer } = require("../services/money");

const router = express.Router();

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

router.get("/balance", authMiddleware, async (req, res) => {
  const wallet = await Wallet.findOneAndUpdate(
    { userId: req.userId },
    { $setOnInsert: { userId: req.userId, balance: 0 } },
    { upsert: true, new: true }
  );
  res.json({
    balance: wallet.balance,
    display: "₹" + (wallet.balance / 100).toFixed(2),
  });
});

// ---------------- TRANSFER ----------------
const transferSchema = z.object({
  to: z.string().trim().toLowerCase().email("must be a valid email"),
  amount: z
    .number()
    .int("must be whole paise")
    .min(100, "must be at least 100 paise")
    .max(1000000, "must be at most 1000000 paise"),
  note: z.string().trim().max(50, "is too long").default(""),
});

router.post("/transfer", authMiddleware, async (req, res) => {
  // 1. Is the Idempotency-Key header there?
  const key = req.headers["idempotency-key"];
  if (!key || key.length > 100) {
    return res.status(400).json({ error: "Idempotency-Key header is required (max 100 characters)" });
  }

  // 2. Is the body valid?
  const result = transferSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { to, amount, note } = result.data;

  // 3. Does the receiver exist?
  const receiver = await User.findOne({ username: to });
  if (!receiver) {
    return res.status(404).json({ error: "Receiver not found" });
  }

  // 4. Sending to yourself? (ObjectId vs text: use .equals)
  if (receiver._id.equals(req.userId)) {
    return res.status(400).json({ error: "You cannot send money to yourself" });
  }

  // 5. Claim the key. The unique (userId, key) pair lets only one copy win.
  const requestHash = JSON.stringify({ to, amount, note });
  let record;
  try {
    record = await IdempotencyRecord.create({
      userId: req.userId,
      key,
      requestHash,
      state: "IN_PROGRESS",
    });
  } catch (err) {
    if (err.code !== 11000) throw err; // a real problem

    // The key was already used. What happened to it?
    const existing = await IdempotencyRecord.findOne({ userId: req.userId, key });
    if (!existing || existing.state === "IN_PROGRESS") {
      return res.status(409).json({ error: "This transfer is still being processed" });
    }
    if (existing.requestHash !== requestHash) {
      return res
        .status(422)
        .json({ error: "This Idempotency-Key was already used for a different transfer" });
    }
    // same request, already done: send back the saved reply, move no money
    return res.status(existing.responseStatus).json(existing.responseBody);
  }

  // 6. Move the money (all or nothing)
  try {
    const out = await runTransfer({ fromUserId: req.userId, toUser: receiver, amount, note });
    const body = { message: "Transfer successful", transaction: out.transaction, balance: out.balance };

    await IdempotencyRecord.updateOne(
      { _id: record._id },
      { state: "DONE", responseStatus: 201, responseBody: body }
    );
    return res.status(201).json(body);
  } catch (err) {
    if (err instanceof MoneyError) {
      // an expected failure: save it, so a retry gets the same answer
      const body = { error: err.message };
      await IdempotencyRecord.updateOne(
        { _id: record._id },
        { state: "DONE", responseStatus: err.status, responseBody: body }
      );
      return res.status(err.status).json(body);
    }
    // an unexpected failure: free the key so the user can retry
    await IdempotencyRecord.deleteOne({ _id: record._id });
    throw err;
  }
});

// ---------------- MY PASSBOOK ----------------
const historySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/transactions", authMiddleware, async (req, res) => {
  const result = historySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { page, limit } = result.data;

  const filter = { userId: req.userId }; // only MY passbook lines

  const [total, entries] = await Promise.all([
    LedgerEntry.countDocuments(filter),
    LedgerEntry.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "transactionId",
        populate: [
          { path: "fromUserId", select: "firstName lastName" },
          { path: "toUserId", select: "firstName lastName" },
        ],
      }),
  ]);

  const data = entries.map((e) => {
    const t = e.transactionId;
       let withWhom = "Bank deposit";
    if (t && t.type === "TRANSFER") {
      const other = e.direction === "DEBIT" ? t.toUserId : t.fromUserId;
      withWhom = other ? `${other.firstName} ${other.lastName}` : "Unknown";
    } else if (t && t.type === "TOPUP") {
      withWhom = "Added via Razorpay";
    }
    return {
      transactionId: t ? t._id.toString() : null,
      type: t ? t.type : null,
      direction: e.direction,
      amount: e.amount,
      withWhom,
      note: t ? t.note : "",
      balanceAfter: e.balanceAfter,
      createdAt: e.createdAt,
    };
  });

  res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
});

module.exports = router;