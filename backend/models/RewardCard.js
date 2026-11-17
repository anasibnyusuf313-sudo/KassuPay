const mongoose = require("mongoose");

// One scratch card. It belongs to the PAYER and to exactly one payment.
// The reward amount is decided by the SERVER when the card is created (A4).
const rewardCardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true }, // the payment
    amount: { type: Number, required: true, min: 1 }, // paise. Hidden from the app until the card is claimed
    status: {
      type: String,
      enum: ["UNCLAIMED", "CLAIMED", "EXHAUSTED", "EXPIRED"],
      default: "UNCLAIMED",
    },
    expiresAt: { type: Date, required: true },
    cashbackTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }, // set when paid
    claimedAt: { type: Date },
  },
  { timestamps: true }
);

// The second lock (A3): even if the card code ran twice, the database refuses a second card
rewardCardSchema.index({ transactionId: 1 }, { unique: true });
// "my cards, newest first"
rewardCardSchema.index({ userId: 1, createdAt: -1 });
// the offer report groups by offer and status
rewardCardSchema.index({ offerId: 1, status: 1 });

module.exports = mongoose.models.RewardCard || mongoose.model("RewardCard", rewardCardSchema);
