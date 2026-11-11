const mongoose = require("mongoose");

// A request is only a note: "requester asks payer for amount".
// No money moves until the payer pays (services/requests.js).
const moneyRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, required: true }, // gets the money
    payerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // gives the money
    amount: { type: Number, required: true, min: 100, max: 1000000 }, // paise
    note: { type: String, trim: true, maxlength: 100, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "DECLINED", "CANCELLED", "EXPIRED"],
      default: "PENDING",
    },
    expiresAt: { type: Date, required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId }, // set when paid
    decidedAt: { type: Date }, // when it left PENDING
  },
  { timestamps: true }
);

// Raju's inbox: match payer (E), match status (E), newest first (S)
moneyRequestSchema.index({ payerId: 1, status: 1, createdAt: -1 });
// Priya's sent list: same idea with the requester
moneyRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });

module.exports =
  mongoose.models.MoneyRequest || mongoose.model("MoneyRequest", moneyRequestSchema);
