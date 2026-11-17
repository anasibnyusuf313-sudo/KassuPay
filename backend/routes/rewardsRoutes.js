const express = require("express");
const authMiddleware = require("../authmiddleware");
const { RewardError, claimCard, listCards } = require("../services/rewardService");

const router = express.Router();

// ---------------- MY CARDS ----------------
// amount is null until the card is scratched
router.get("/", authMiddleware, async (req, res) => {
  const cards = await listCards(req.userId);
  res.json({ cards });
});

// ---------------- SCRATCH A CARD ----------------
// The app only says "claim card 123". It never sends an amount: the server already knows.
router.post("/:id/claim", authMiddleware, async (req, res) => {
  try {
    const out = await claimCard({ cardId: req.params.id, userId: req.userId });
    return res.json(out);
  } catch (err) {
    if (err instanceof RewardError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

module.exports = router;
