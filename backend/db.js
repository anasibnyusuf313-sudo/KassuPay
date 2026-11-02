const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  // Repair: payment orders must NOT be unique per user (one person can add money many times)
  try {
    const indexes = await PaymentOrder.collection.indexes();
    const bad = indexes.find((i) => i.name === "userId_1" && i.unique);
    if (bad) {
      await PaymentOrder.collection.dropIndex("userId_1");
      console.log("Dropped the wrong unique index userId_1 on paymentorders");
    }
  } catch (err) {
    // the collection may not exist yet, which is fine
  }
}

const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      username: { type: String, required: true, unique: true, trim: true, lowercase: true },
      firstName: { type: String, required: true, trim: true, maxLength: 50 },
      lastName: { type: String, required: true, trim: true, maxLength: 50 },
      passwordHash: { type: String, required: true },
      pinHash: { type: String, default: null, select: false },
    },
    { timestamps: true }
  )
);

const Wallet = mongoose.model(
  "Wallet",
  new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
      balance: {
        type: Number,
        required: true,
        default: 0, // in PAISE
        min: 0,
        validate: { validator: Number.isInteger, message: "balance must be whole paise" },
      },
    },
    { timestamps: true }
  )
);

const Transaction = mongoose.model(
  "Transaction",
  new mongoose.Schema(
    {
      type: { type: String, required: true, enum: ["DEPOSIT", "TRANSFER", "TOPUP", "WITHDRAW"] }, 
      fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "amount must be whole paise" } },
      note: { type: String, trim: true, maxLength: 50, default: "" },
      status: { type: String, default: "SUCCESS" },
    },
    { timestamps: true }
  )
);

      const userSchema = new mongoose.Schema({
        // ...existing fields (username, firstName, lastName, passwordHash, etc.)
        pinHash: { type: String, default: null, select: false }, // hidden from normal queries
        pinSetAt: { type: Date, default: null },
        pinFailedAttempts: { type: Number, default: 0 },
        pinLockedUntil: { type: Date, default: null },
      });

const ledgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    direction: { type: String, required: true, enum: ["DEBIT", "CREDIT"] },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
ledgerSchema.index({ userId: 1, createdAt: -1 });
const LedgerEntry = mongoose.model("LedgerEntry", ledgerSchema);

const idempotencySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    state: { type: String, required: true, enum: ["IN_PROGRESS", "DONE"] },
    responseStatus: Number,
    responseBody: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);
idempotencySchema.index({ userId: 1, key: 1 }, { unique: true });
const IdempotencyRecord = mongoose.model("IdempotencyRecord", idempotencySchema);

// NEW: one "add money" attempt
const PaymentOrder = mongoose.model(
  "PaymentOrder",
  new mongoose.Schema(
    {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  gatewayOrderId: { type: String, required: true, unique: true }, // Razorpay's order_...
  amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "amount must be whole paise" } },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["CREATED", "PAID", "EXPIRED"], default: "CREATED" },
  gatewayPaymentId: String, // pay_..., set when paid
  paidVia: { type: String, enum: ["CALLBACK", "WEBHOOK"] }, // who won the race
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
},
{ timestamps: true }
  )
);

module.exports = { connectDB, User, Wallet, Transaction, LedgerEntry, IdempotencyRecord, PaymentOrder };
