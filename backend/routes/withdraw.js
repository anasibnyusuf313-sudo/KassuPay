const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const authMiddleware = require("../authmiddleware");
const Withdrawal = require("../models/Withdrawal");
const { withdrawMoney, settleWithdrawal } = require("../services/money");

const router = express.Router();

// same style as wallet.js: the login middleware puts the user id in req.userId
const uid = (req) => req.userId;

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

// amount is in PAISE, same as /transfer (10000 paise = Rs 100)
const withdrawSchema = z.object({
  bankAccountId: z
    .string()
    .refine((v) => mongoose.isValidObjectId(v), "choose a bank account"),
  amount: z
    .number()
    .int("must be whole paise")
    .min(100, "must be at least 100 paise")
    .max(1000000, "must be at most 1000000 paise"),
});

const publicView = (w) => ({
  id: w._id.toString(),
  amount: w.amount,
  status: w.status,
  bankLast4: w.bankLast4,
  createdAt: w.createdAt,
});

// Request a withdrawal
router.post("/", authMiddleware, async (req, res) => {
  try {
    const result = withdrawSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: firstError(result.error) });
    }
    const { bankAccountId, amount } = result.data;

    const withdrawal = await withdrawMoney({
      userId: uid(req),
      bankAccountId,
      amount,
    });

    // SIMULATED payout: marked SUCCESS right away.
    // Later, replace this with a real payout call (RazorpayX).
    await settleWithdrawal(withdrawal._id, true);
    withdrawal.status = "SUCCESS";

    res.status(201).json({
      message: "Withdrawal successful",
      withdrawal: publicView(withdrawal),
    });
  } catch (err) {
    // expected problems like "Insufficient balance" carry their own status
    const status = Number(err.status);
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: err.message });
    }
    console.error("WITHDRAW ERROR:", err);
    res.status(500).json({ error: "Something went wrong on our side" });
  }
});

// My withdrawal history
router.get("/", authMiddleware, async (req, res) => {
  try {
    const list = await Withdrawal.find({ userId: uid(req) })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(list.map(publicView));
  } catch (err) {
    console.error("LIST WITHDRAW ERROR:", err);
    res.status(500).json({ error: "Something went wrong on our side" });
  }
});

module.exports = router;