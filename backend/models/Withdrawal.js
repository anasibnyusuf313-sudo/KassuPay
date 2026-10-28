const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // saved copy, so history still works if the user deletes the bank account later
    bankLast4: { type: String, required: true },
    bankIfsc: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Withdrawal || mongoose.model("Withdrawal", withdrawalSchema);