const express = require("express");
const crypto = require("crypto");
const { runDue } = require("../services/autopay");
const { indiaDay, isValidDay } = require("../lib/dates");

const router = express.Router();

// A3: Vercel sends "Authorization: Bearer <CRON_SECRET>". This route is NOT behind
// authMiddleware: the secret is its only lock. Missing secret = locked for everyone.
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.get("authorization") || "");
  const want = Buffer.from("Bearer " + secret);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// GET /cron/autopay (mounted at /api/v1/cron)
router.get("/autopay", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ message: "Unauthorized" });

  try {
    // A9: injecting the clock. ?date= only works on your laptop (ALLOW_TIME_TRAVEL=true).
    let today = indiaDay();
    if (req.query.date !== undefined) {
      if (process.env.ALLOW_TIME_TRAVEL !== "true") return res.status(400).json({ message: "Time travel is off" });
      if (!isValidDay(req.query.date)) return res.status(400).json({ message: "Invalid date" });
      today = req.query.date;
    }

    const summary = await runDue(today);
    res.json(summary);
  } catch (err) {
    console.error("[cron/autopay]", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;
