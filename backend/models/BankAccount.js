const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    accountHolderName: { type: String, required: true, trim: true },
    // select: false means the full number is never sent back unless you ask for it
    accountNumber: { type: String, required: true, select: false },
    last4: { type: String, required: true },
    ifsc: { type: String, required: true, uppercase: true, trim: true },
  },
  { timestamps: true }
);

// same user cannot add the same account twice
bankAccountSchema.index({ userId: 1, accountNumber: 1 }, { unique: true });

module.exports =
  mongoose.models.BankAccount || mongoose.model("BankAccount", bankAccountSchema);