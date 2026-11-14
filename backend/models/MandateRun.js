const mongoose = require("mongoose");

// One document per AutoPay per due day. It is lock 2 (the unique index)
// and also the history the user sees: "Paid on 5 Dec, failed on 5 Jan".
const mandateRunSchema = new mongoose.Schema(
  {
    mandateId: { type: mongoose.Schema.Types.ObjectId, required: true },
    dueDay: { type: String, required: true }, // India date this payment was due
    status: { type: String, enum: ["SUCCESS", "FAILED", "MISSED"], required: true },
    amount: { type: Number, required: true }, // paise
    reason: { type: String, default: "" }, // why it failed or was missed
    transactionId: { type: mongoose.Schema.Types.ObjectId }, // set on SUCCESS
  },
  { timestamps: true }
);

mandateRunSchema.index({ mandateId: 1, dueDay: 1 }, { unique: true });

module.exports = mongoose.models.MandateRun || mongoose.model("MandateRun", mandateRunSchema);
