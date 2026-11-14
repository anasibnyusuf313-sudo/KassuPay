const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const { LedgerEntry } = require("../db");
const {
  isValidYmd,
  startOfIndiaDay,
  startOfNextIndiaDay,
  isValidMonth,
  monthRange,
  formatIndia,
} = require("../services/indiaDates");
const { csvCell, rupees } = require("../services/csv");

// IMPORTANT: use the same path as the auth require in your routes/wallet.js.
// These two lines work whether the file exports the function itself or { authMiddleware }.
const authModule = require("../authmiddleware");
const authMiddleware = typeof authModule === "function" ? authModule : authModule.authMiddleware;

const router = express.Router();

const TYPES = ["TRANSFER", "DEPOSIT", "TOPUP", "WITHDRAWAL", "REVERSAL"];
const MAX_CSV_ROWS = 20000; // keeps the file under Vercel's reply size limit

// ---------- small helpers ----------
function labelFor(type, direction) {
  if (type === "TRANSFER") return direction === "DEBIT" ? "Sent" : "Received";
  if (type === "DEPOSIT") return "Bank deposit";
  if (type === "TOPUP") return "Added via Razorpay";
  if (type === "WITHDRAWAL") return "Withdrawal to bank";
  if (type === "REVERSAL") return "Refund of failed withdrawal";
  return direction === "DEBIT" ? "Money out" : "Money in";
}

// The cursor is the (createdAt, _id) of the last row we sent, as one opaque string
function encodeCursor(row) {
  return Buffer.from(
    JSON.stringify({ t: new Date(row.createdAt).toISOString(), id: String(row._id) })
  ).toString("base64url");
}

// Returns { t: Date, id: ObjectId }, or null if the cursor is broken. Never throws.
function decodeCursor(text) {
  try {
    const obj = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
    if (!obj || typeof obj.t !== "string" || typeof obj.id !== "string") return null;
    const t = new Date(obj.t);
    if (Number.isNaN(t.getTime())) return null;
    if (!/^[0-9a-fA-F]{24}$/.test(obj.id)) return null;
    return { t, id: new mongoose.Types.ObjectId(obj.id) };
  } catch (err) {
    return null;
  }
}

// ---------------- GET /wallet/history ----------------
const ymd = z.string().refine(isValidYmd, "must be a date like 2026-11-04");

const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(500).optional(),
  direction: z.enum(["DEBIT", "CREDIT"]).optional(),
  type: z.enum(TYPES).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});

router.get("/history", authMiddleware, async (req, res) => {
  const parsed = historySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid inputs" });
  }
  const { limit, cursor, direction, type, from, to } = parsed.data;

  if (from && to && from > to) {
    return res.status(400).json({ error: "from must not be after to" });
  }

  // Every condition goes into one list and is joined with $and,
  // so the cursor's $or can never overwrite another condition
  const conditions = [{ userId: req.userId }];
  if (direction) conditions.push({ direction });
  if (type) conditions.push({ type });
  if (from) conditions.push({ createdAt: { $gte: startOfIndiaDay(from) } });
  if (to) conditions.push({ createdAt: { $lt: startOfNextIndiaDay(to) } });
  if (cursor) {
    const c = decodeCursor(cursor);
    if (!c) {
      return res.status(400).json({ error: "Bad cursor" });
    }
    // "older than the last row I saw", with _id deciding when the times are equal
    conditions.push({
      $or: [{ createdAt: { $lt: c.t } }, { createdAt: c.t, _id: { $lt: c.id } }],
    });
  }

  // ask for one extra row: if it comes back, there is a next page
  const rows = await LedgerEntry.find({ $and: conditions })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate({
      path: "transactionId",
      populate: [
        { path: "fromUserId", select: "firstName lastName" },
        { path: "toUserId", select: "firstName lastName" },
      ],
    })
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

  const items = page.map((e) => {
    const t = e.transactionId && typeof e.transactionId === "object" ? e.transactionId : null;
    const kind = e.type || (t ? t.type : null); // old rows are covered even before the backfill

    let withWhom = labelFor(kind, e.direction);
    if (kind === "TRANSFER" && t) {
      const other = e.direction === "DEBIT" ? t.toUserId : t.fromUserId;
      withWhom = other && other.firstName ? `${other.firstName} ${other.lastName}` : "Unknown";
    }

    return {
      id: String(e._id),
      transactionId: t ? String(t._id) : null,
      type: kind,
      direction: e.direction,
      amount: e.amount,
      withWhom,
      label: labelFor(kind, e.direction),
      note: t && t.note ? t.note : "",
      balanceAfter: e.balanceAfter,
      createdAt: e.createdAt,
      at: e.createdAt,
    };
  });

  res.json({ items, nextCursor });
});

// ---------------- GET /wallet/statement?month=2026-11 ----------------
const monthSchema = z.object({
  month: z.string().refine(isValidMonth, "must look like 2026-11"),
});

router.get("/statement", authMiddleware, async (req, res) => {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid inputs" });
  }
  const { month } = parsed.data;
  const { start, end } = monthRange(month);

  // aggregate() does NOT turn text into an ObjectId for you. find() does.
  const userId = new mongoose.Types.ObjectId(req.userId);
  const inMonth = { userId, createdAt: { $gte: start, $lt: end } };

  // money in, money out and the number of rows: the database adds them up
  const [sums] = await LedgerEntry.aggregate([
    { $match: inMonth }, // first, so it can use the index
    {
      $group: {
        _id: null,
        totalIn: { $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$amount", 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ["$direction", "DEBIT"] }, "$amount", 0] } },
        entries: { $sum: 1 },
      },
    },
  ]);

  // opening and closing come from a different source: the balances the ledger recorded
  const before = await LedgerEntry.findOne({ userId, createdAt: { $lt: start } })
    .sort({ createdAt: -1, _id: -1 })
    .select("balanceAfter")
    .lean();
  const last = await LedgerEntry.findOne(inMonth)
    .sort({ createdAt: -1, _id: -1 })
    .select("balanceAfter")
    .lean();

  const openingBalance = before ? before.balanceAfter : 0;
  const closingBalance = last ? last.balanceAfter : openingBalance;
  const totalIn = sums ? sums.totalIn : 0;
  const totalOut = sums ? sums.totalOut : 0;
  const entries = sums ? sums.entries : 0;

  res.json({
    month,
    openingBalance,
    totalIn,
    totalOut,
    closingBalance,
    entries,
    check: openingBalance + totalIn - totalOut === closingBalance, // the statement proves itself
  });
});

// ---------------- GET /wallet/statement/csv?month=2026-11 ----------------
router.get("/statement/csv", authMiddleware, async (req, res) => {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid inputs" });
  }
  const { month } = parsed.data;
  const { start, end } = monthRange(month);

  const filter = { userId: req.userId, createdAt: { $gte: start, $lt: end } };

  const count = await LedgerEntry.countDocuments(filter);
  if (count > MAX_CSV_ROWS) {
    return res.status(413).json({
      error: `This month has ${count} entries. A single file can hold at most ${MAX_CSV_ROWS}.`,
    });
  }

  const rows = await LedgerEntry.find(filter)
    .sort({ createdAt: 1, _id: 1 }) // oldest first
    .populate({ path: "transactionId", select: "type note" })
    .lean();

  const header = ["Date", "Type", "Description", "Debit (Rs)", "Credit (Rs)", "Balance (Rs)"];
  const lines = [header.map(csvCell).join(",")];

  for (const e of rows) {
    const t = e.transactionId && typeof e.transactionId === "object" ? e.transactionId : null;
    const kind = e.type || (t ? t.type : "");
    const description = (t && t.note) || labelFor(kind, e.direction);

    lines.push(
      [
        formatIndia(e.createdAt),
        kind,
        description,
        e.direction === "DEBIT" ? rupees(e.amount) : "",
        e.direction === "CREDIT" ? rupees(e.amount) : "",
        rupees(e.balanceAfter),
      ]
        .map(csvCell) // every value, even numbers, goes through csvCell
        .join(",")
    );
  }

  // the first character (\uFEFF) makes Excel read the file as UTF-8
  const body = "\uFEFF" + lines.join("\r\n") + "\r\n";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="kaasupay-${month}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
});

module.exports = router;
