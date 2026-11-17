const mongoose = require("mongoose");

// How many cards a person has earned on one India day (A7: at most 3).
const rewardCountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true }, // "2026-11-17", the India date
    cards: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

rewardCountSchema.index({ userId: 1, day: 1 }, { unique: true });

module.exports = mongoose.models.RewardCount || mongoose.model("RewardCount", rewardCountSchema);
