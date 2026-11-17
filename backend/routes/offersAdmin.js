const express = require("express");
const { z } = require("zod");
const adminModule = require("../adminMiddleware");
const { RewardError, createOffer, offerReport } = require("../services/rewardService");

// adminMiddleware.js may export the function directly, or inside an object
const adminMiddleware =
  typeof adminModule === "function" ? adminModule : adminModule.adminMiddleware || adminModule.default;
if (typeof adminMiddleware !== "function") {
  throw new Error("routes/offersAdmin.js: could not find the function exported by adminMiddleware.js");
}

const router = express.Router();

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

const wholeNumber = () => z.number().int("must be whole paise").min(1, "must be at least 1");

const offerSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{3,20}$/, "must be 3 to 20 capital letters or digits"),
  title: z.string().trim().min(1).max(40, "is too long").optional(), // shown in the app
  percent: z.number().int("must be a whole number").min(1, "must be 1 to 50").max(50, "must be 1 to 50"),
  maxCashback: wholeNumber(),
  minPayment: wholeNumber(),
  budget: wholeNumber(),
  days: z.number().int("must be a whole number").min(1, "must be 1 to 30").max(30, "must be 1 to 30"),
});

// ---------------- CREATE AN OFFER (staff) ----------------
router.post("/", adminMiddleware, async (req, res) => {
  const result = offerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid inputs", detail: firstError(result.error) });
  }
  const input = result.data;

  try {
    const offer = await createOffer({ ...input, title: input.title || "Festive cashback" });
    return res.status(201).json({
      message: "Offer created",
      offer: {
        code: offer.code,
        title: offer.title,
        percent: offer.percent,
        maxCashback: offer.maxCashback,
        minPayment: offer.minPayment,
        budget: offer.budget,
        budgetLeft: offer.budgetLeft,
        startsAt: offer.startsAt,
        endsAt: offer.endsAt,
      },
    });
  } catch (err) {
    if (err instanceof RewardError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// ---------------- THE REPORT (staff) ----------------
router.get("/:code", adminMiddleware, async (req, res) => {
  try {
    const report = await offerReport(String(req.params.code).toUpperCase());
    return res.json(report);
  } catch (err) {
    if (err instanceof RewardError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

module.exports = router;
