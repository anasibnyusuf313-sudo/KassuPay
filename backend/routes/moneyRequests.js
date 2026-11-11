const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const authMiddleware = require("../authmiddleware");
const { PinError, checkPin } = require("../services/pin");
const { User, IdempotencyRecord } = require("../db");
const { MoneyError } = require("../services/money");
const MoneyRequest = require("../models/MoneyRequest");
const {
  declineRequest,
  cancelRequest,
  expireOldFor,
  payRequest,
} = require("../services/requestService");
const { rateLimit } = require("../services/rateLimit");
const { REQUEST_EXPIRY_DAYS, MAX_PENDING_PER_PAYER } = require("../config");

const router = express.Router();

// 20 new requests an hour per user (Level 5)
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many requests created. Try again later.",
});
// Same limit as the other money routes: 10 a minute (Day 6)
const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many payment attempts. Wait a moment.",
});

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : "Unknown");

// How a request looks in lists and by id
function view(r, requester, payer, me) {
  return {
    id: r._id.toString(),
    from: fullName(requester), // who asked
    to: fullName(payer), // who was asked
    direction: r.payerId.equals(me) ? "INCOMING" : "OUTGOING",
    amount: r.amount,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    transactionId: r.transactionId ? r.transactionId.toString() : null,
  };
}

// Send the right status for expected errors, rethrow the rest
function sendError(res, err) {
  if (err instanceof MoneyError || err instanceof PinError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

// ---------------- CREATE ----------------
const createSchema = z.object({
  to: z.string().refine((v) => mongoose.isValidObjectId(v), "must be a valid user id"),
  amount: z
    .number()
    .int("must be whole paise")
    .min(100, "must be at least 100 paise")
    .max(1000000, "must be at most 1000000 paise"),
  note: z.string().trim().max(100, "is too long").default(""),
});

router.post("/", authMiddleware, createLimiter, async (req, res) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid inputs", detail: firstError(result.error) });
  }
  const { to, amount, note } = result.data;

  if (String(to) === String(req.userId)) {
    return res.status(400).json({ error: "You can't request money from yourself" });
  }

  const payer = await User.findById(to).select("firstName lastName");
  if (!payer) return res.status(404).json({ error: "User not found" });

  // Max 5 pending requests to the same person.
  // This is "check, then act": two requests at the same instant could make it 6.
  // That is acceptable here (see DAY7_ANSWERS.md); it would never be for a balance.
  const pending = await MoneyRequest.countDocuments({
    requesterId: req.userId,
    payerId: to,
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  });
  if (pending >= MAX_PENDING_PER_PAYER) {
    return res
      .status(409)
      .json({ error: `You already have ${MAX_PENDING_PER_PAYER} pending requests to this person` });
  }

  const expiresAt = new Date(Date.now() + REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const request = await MoneyRequest.create({
    requesterId: req.userId,
    payerId: to,
    amount,
    note,
    expiresAt,
  });

  res.status(201).json({
    message: "Request sent",
    request: {
      id: request._id.toString(),
      to: fullName(payer),
      amount,
      note,
      status: request.status,
      expiresAt,
    },
  });
});

// ---------------- LISTS ----------------
const listSchema = z.object({
  status: z.enum(["PENDING", "PAID", "DECLINED", "CANCELLED", "EXPIRED"]).optional(),
});

function listRoute(side) {
  // side "payerId" = incoming, "requesterId" = outgoing
  return async (req, res) => {
    const result = listSchema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: firstError(result.error) });
    }

    await expireOldFor(req.userId); // lazy expiry, before reading

    const filter = { [side]: req.userId };
    if (result.data.status) filter.status = result.data.status;

    const docs = await MoneyRequest.find(filter).sort({ createdAt: -1 }).limit(20);

    const ids = [...new Set(docs.flatMap((d) => [String(d.requesterId), String(d.payerId)]))];
    const users = await User.find({ _id: { $in: ids } }).select("firstName lastName");
    const byId = new Map(users.map((u) => [String(u._id), u]));

    res.json({
      requests: docs.map((d) =>
        view(d, byId.get(String(d.requesterId)), byId.get(String(d.payerId)), req.userId)
      ),
    });
  };
}

// ---------------- FIND A PERSON BY EMAIL (for the "Request money" form) ----------------
// Returns only the id and the name. Rate limited so it cannot be used to scan for emails.
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many lookups. Wait a moment.",
});
const lookupSchema = z.object({ email: z.string().trim().toLowerCase().email("must be a valid email") });

router.get("/lookup", authMiddleware, lookupLimiter, async (req, res) => {
  const result = lookupSchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const user = await User.findOne({ username: result.data.email }).select("firstName lastName");
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user._id.equals(req.userId)) {
    return res.status(400).json({ error: "You can't request money from yourself" });
  }
  res.json({ user: { id: user._id.toString(), name: fullName(user) } });
});

// These two MUST come before "/:id", or "incoming" would be read as an id
router.get("/incoming", authMiddleware, listRoute("payerId"));
router.get("/outgoing", authMiddleware, listRoute("requesterId"));

// ---------------- ONE REQUEST ----------------
router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: "Request not found" });
  }

  // mark this one expired first if its time is up
  await MoneyRequest.updateOne(
    { _id: id, status: "PENDING", expiresAt: { $lte: new Date() } },
    { $set: { status: "EXPIRED", decidedAt: new Date() } }
  );

  // Only the two people in it can see it. Anyone else gets 404, not 403.
  const doc = await MoneyRequest.findOne({
    _id: id,
    $or: [{ requesterId: req.userId }, { payerId: req.userId }],
  });
  if (!doc) return res.status(404).json({ error: "Request not found" });

  const [requester, payer] = await Promise.all([
    User.findById(doc.requesterId).select("firstName lastName"),
    User.findById(doc.payerId).select("firstName lastName"),
  ]);
  res.json({ request: view(doc, requester, payer, req.userId) });
});

// ---------------- DECLINE / CANCEL ----------------
router.post("/:id/decline", authMiddleware, async (req, res) => {
  try {
    await declineRequest(req.params.id, req.userId);
    res.json({ message: "Request declined" });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    await cancelRequest(req.params.id, req.userId);
    res.json({ message: "Request cancelled" });
  } catch (err) {
    sendError(res, err);
  }
});

// ---------------- PAY ----------------
const paySchema = z.object({ pin: z.string().regex(/^\d{4}$/, "must be exactly 4 digits") });

router.post("/:id/pay", authMiddleware, moneyLimiter, async (req, res) => {
  const { id } = req.params;

  // 2. Idempotency-Key header and body
  const key = req.headers["idempotency-key"];
  if (!key || key.length > 100) {
    return res.status(400).json({ error: "Idempotency-Key header is required (max 100 characters)" });
  }
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: firstError(parsed.error) });
  }
  const { pin } = parsed.data;

  // 3. Load the request. Strangers and bad ids get 404; the requester gets 403.
  const doc = mongoose.isValidObjectId(id) ? await MoneyRequest.findById(id) : null;
  if (!doc || (!doc.payerId.equals(req.userId) && !doc.requesterId.equals(req.userId))) {
    return res.status(404).json({ error: "Request not found" });
  }
  if (!doc.payerId.equals(req.userId)) {
    return res.status(403).json({ error: "Only the person asked can pay this request" });
  }

  // 4. PIN, before the idempotency record, so a wrong PIN does not use up the key
  try {
    await checkPin(req.userId, pin);
  } catch (err) {
    return sendError(res, err);
  }

  // 5. Claim the key. The hash is the route + request id. NEVER the PIN.
  const requestHash = JSON.stringify({ route: "pay", id });
  let record;
  try {
    record = await IdempotencyRecord.create({
      userId: req.userId,
      key,
      requestHash,
      state: "IN_PROGRESS",
    });
  } catch (err) {
    if (err.code !== 11000) throw err;

    const existing = await IdempotencyRecord.findOne({ userId: req.userId, key });
    if (!existing || existing.state === "IN_PROGRESS") {
      return res.status(409).json({ error: "This payment is still being processed" });
    }
    if (existing.requestHash !== requestHash) {
      return res
        .status(422)
        .json({ error: "This Idempotency-Key was already used for a different request" });
    }
    return res.status(existing.responseStatus).json(existing.responseBody);
  }

  // 6. One transaction: state change + daily limit + money + ledger
  try {
    const out = await payRequest({ id, payerId: req.userId });
    const body = {
      message: "Request paid",
      transactionId: out.transactionId,
      balance: out.balance,
    };
    await IdempotencyRecord.updateOne(
      { _id: record._id },
      { state: "DONE", responseStatus: 200, responseBody: body }
    );
    return res.status(200).json(body);
  } catch (err) {
    if (err instanceof MoneyError) {
      const body = { error: err.message };
      await IdempotencyRecord.updateOne(
        { _id: record._id },
        { state: "DONE", responseStatus: err.status, responseBody: body }
      );
      return res.status(err.status).json(body);
    }
    await IdempotencyRecord.deleteOne({ _id: record._id });
    throw err;
  }
});

module.exports = router;
