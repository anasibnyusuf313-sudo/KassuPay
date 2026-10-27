const express = require("express");
const { z } = require("zod");
const adminMiddleware = require("../adminMiddleware");
const { User, Wallet, Transaction, LedgerEntry } = require("../db");
const { MoneyError, deposit } = require("../services/money");

const router = express.Router();

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

const depositSchema = z.object({
  to: z.string().trim().toLowerCase().email("must be a valid email"),
  amount: z
    .number()
    .int("must be whole paise")
    .min(100, "must be at least 100 paise")
    .max(10000000, "must be at most 10000000 paise"),
  note: z.string().trim().max(50, "is too long").optional(),
});

// Staff puts money into a wallet
router.post("/deposit", adminMiddleware, async (req, res) => {
  const result = depositSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { to, amount, note } = result.data;

  const user = await User.findOne({ username: to });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  let out;
  try {
    out = await deposit({ toUser: user, amount, note });
  } catch (err) {
    if (err instanceof MoneyError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }

  res.status(201).json({
    message: "Deposit successful",
    transactionId: out.transactionId,
    to: user.username,
    amount,
    balance: out.balance,
  });
});

// Bonus: prove the money adds up
router.get("/reconcile", adminMiddleware, async (req, res) => {
  const wallets = await Wallet.find();

  // credits and debits per person, added up by the database
  const sums = await LedgerEntry.aggregate([
    { $group: { _id: { userId: "$userId", direction: "$direction" }, total: { $sum: "$amount" } } },
  ]);

  const net = {}; // userId -> credits minus debits
  for (const s of sums) {
    const id = s._id.userId.toString();
    net[id] = (net[id] || 0) + (s._id.direction === "CREDIT" ? s.total : -s.total);
  }

  let totalBalance = 0;
  const mismatches = [];
  for (const w of wallets) {
    totalBalance += w.balance;
    const ledgerSays = net[w.userId.toString()] || 0;
    if (ledgerSays !== w.balance) {
      mismatches.push({ userId: w.userId.toString(), balance: w.balance, ledgerSays });
    }
  }

  const dep = await Transaction.aggregate([
    { $match: { type: { $in: ["DEPOSIT", "TOPUP"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalDeposited = dep.length ? dep[0].total : 0;

  res.json({
    wallets: wallets.length,
    totalBalance,
    totalDeposited,
    moneyIsConserved: totalBalance === totalDeposited && mismatches.length === 0,
    mismatches,
  });
});

module.exports = router;