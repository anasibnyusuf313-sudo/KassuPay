const mongoose = require("mongoose");

// A mandate is a standing permission: "pay payeeId `amount` paise on `dayOfMonth` every month".
// The PIN is checked once, at setup. After that the nightly job pays it.
const mandateSchema = new mongoose.Schema(
  {
    payerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // gives the money
    payeeId: { type: mongoose.Schema.Types.ObjectId, required: true }, // gets the money
    amount: { type: Number, required: true, min: 100, max: 500000 }, // paise
    dayOfMonth: { type: Number, required: true, min: 1, max: 28 },
    status: { type: String, enum: ["ACTIVE", "PAUSED", "CANCELLED"], default: "ACTIVE" },
    nextRunDay: { type: String, required: true }, // India date, "YYYY-MM-DD"
    failedCount: { type: Number, default: 0 }, // failures in a row
  },
  { timestamps: true }
);

// the nightly job: ACTIVE, nextRunDay <= today, oldest first
mandateSchema.index({ status: 1, nextRunDay: 1 });
// a user's own list
mandateSchema.index({ payerId: 1, status: 1 });

module.exports = mongoose.models.Mandate || mongoose.model("Mandate", mandateSchema);
