const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const Mandate = require("../models/Mandate");
const MandateRun = require("../models/MandateRun");
const { indiaDay, firstRunDay } = require("../lib/dates");
const { User, authMiddleware, getUserId, verifyPin } = require("../lib/autopayDeps");

const router = express.Router();
router.use(authMiddleware);

const MAX_ACTIVE = 5;
const isId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);
const nameOf = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || "User" : "Unknown");

const setupSchema = z.object({
  to: z.string().refine(isId),
  amount: z.number().int().min(100).max(500000), // paise
  dayOfMonth: z.number().int().min(1).max(28),
  pin: z.string().min(1),
});

function show(m, payee) {
  return {
    id: String(m._id),
    to: nameOf(payee),
    amount: m.amount,
    dayOfMonth: m.dayOfMonth,
    status: m.status,
    nextRunDay: m.nextRunDay,
    failedCount: m.failedCount,
  };
}

// POST /autopay : set up
router.post("/", async (req, res) => {
  try {
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid inputs" });
    const { to, amount, dayOfMonth, pin } = parsed.data;
    const me = getUserId(req);

    if (to === me) return res.status(400).json({ message: "You can't set up AutoPay to yourself" });

    const payee = await User.findById(to);
    if (!payee) return res.status(404).json({ message: "User not found" });

    // the PIN is asked once, here (A1)
    const pinResult = await verifyPin(me, pin);
    if (!pinResult.ok) return res.status(pinResult.status || 403).json(pinResult.body);

    const active = await Mandate.countDocuments({ payerId: me, status: { $ne: "CANCELLED" } });
    if (active >= MAX_ACTIVE) return res.status(409).json({ message: `You can have at most ${MAX_ACTIVE} AutoPays` });

    const m = await Mandate.create({
      payerId: me,
      payeeId: to,
      amount,
      dayOfMonth,
      nextRunDay: firstRunDay(indiaDay(), dayOfMonth),
    });
    res.status(201).json({ message: "AutoPay set up", mandate: show(m, payee) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /autopay : my AutoPays (as payer)
router.get("/", async (req, res) => {
  try {
    const me = getUserId(req);
    const list = await Mandate.find({ payerId: me }).sort({ createdAt: -1 });
    const users = await User.find({ _id: { $in: list.map((m) => m.payeeId) } });
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json({ mandates: list.map((m) => show(m, byId.get(String(m.payeeId)))) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /autopay/:id/runs : history of one AutoPay, newest first
router.get("/:id/runs", async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "AutoPay not found" });
    const m = await Mandate.findOne({ _id: req.params.id, payerId: getUserId(req) });
    if (!m) return res.status(404).json({ message: "AutoPay not found" });
    const runs = await MandateRun.find({ mandateId: m._id }).sort({ dueDay: -1 }).limit(100);
    res.json({
      runs: runs.map((r) => ({
        id: String(r._id),
        dueDay: r.dueDay,
        status: r.status,
        amount: r.amount,
        reason: r.reason,
        transactionId: r.transactionId ? String(r.transactionId) : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Atomic state change with the payer in the condition (Day 7).
// Not yours: 404. Wrong state: 409 with the current status.
async function change(req, res, { from, set, okMessage }) {
  try {
    const me = getUserId(req);
    if (!isId(req.params.id)) return res.status(404).json({ message: "AutoPay not found" });

    const current = await Mandate.findOne({ _id: req.params.id, payerId: me });
    if (!current) return res.status(404).json({ message: "AutoPay not found" });

    const patch = typeof set === "function" ? set(current) : set;
    const updated = await Mandate.findOneAndUpdate(
      { _id: current._id, payerId: me, status: { $in: from } },
      { $set: patch },
      { new: true }
    );
    if (!updated) {
      const now = await Mandate.findById(current._id);
      return res.status(409).json({ message: `This AutoPay is already ${now.status}` });
    }
    res.json({ message: okMessage, ...(patch.nextRunDay ? { nextRunDay: updated.nextRunDay } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
}

router.post("/:id/pause", (req, res) =>
  change(req, res, { from: ["ACTIVE"], set: { status: "PAUSED" }, okMessage: "AutoPay paused" })
);

// resume works the next run day out again from today: paused months are never charged
router.post("/:id/resume", (req, res) =>
  change(req, res, {
    from: ["PAUSED"],
    set: (m) => ({ status: "ACTIVE", failedCount: 0, nextRunDay: firstRunDay(indiaDay(), m.dayOfMonth) }),
    okMessage: "AutoPay resumed",
  })
);

router.post("/:id/cancel", (req, res) =>
  change(req, res, { from: ["ACTIVE", "PAUSED"], set: { status: "CANCELLED" }, okMessage: "AutoPay cancelled" })
);

module.exports = router;
