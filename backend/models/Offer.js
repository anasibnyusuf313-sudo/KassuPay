const mongoose = require("mongoose");

const wholePaise = { validator: Number.isInteger, message: "must be whole paise" };

// A cashback offer = rules (who gets what) + a budget (how much can be given in total).
// All money is in paise.
const offerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // like FESTIVE
    title: { type: String, default: "Festive cashback", trim: true, maxlength: 40 }, // shown in the app
    percent: { type: Number, required: true, min: 1, max: 50, validate: wholePaise },
    maxCashback: { type: Number, required: true, min: 1, validate: wholePaise },
    minPayment: { type: Number, required: true, min: 1, validate: wholePaise },
    budget: { type: Number, required: true, min: 1, validate: wholePaise }, // what staff put in
    budgetLeft: { type: Number, required: true, min: 0, validate: wholePaise }, // goes down on every paid card
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// "which offer is running right now?"
offerSchema.index({ startsAt: 1, endsAt: 1 });

module.exports = mongoose.models.Offer || mongoose.model("Offer", offerSchema);
