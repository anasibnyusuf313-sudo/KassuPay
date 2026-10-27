const mongoose = require("mongoose");
const { Wallet, Transaction, LedgerEntry, PaymentOrder } = require("../db"); // NEW: PaymentOrder added

// An expected problem (like "Insufficient balance") that carries a status code
class MoneyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- DEPOSIT (staff puts money in) ----------
async function deposit({ toUser, amount, note }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: toUser._id },
        { $inc: { balance: amount } },
        { returnDocument: "after", session }
      );
      if (!wallet) throw new MoneyError(404, "Wallet not found");

      const [txn] = await Transaction.create(
        [{ type: "DEPOSIT", toUserId: toUser._id, amount, note: note || "Bank deposit" }],
        { session }
      );

      await LedgerEntry.create(
        [{ userId: toUser._id, transactionId: txn._id, direction: "CREDIT", amount, balanceAfter: wallet.balance }],
        { session }
      );

      result = { transactionId: txn._id.toString(), balance: wallet.balance };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------- TRANSFER (all or nothing) ----------
async function runTransfer({ fromUserId, toUser, amount, note }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const senderWallet = await Wallet.findOneAndUpdate(
        { userId: fromUserId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: "after", session }
      );
      if (!senderWallet) throw new MoneyError(400, "Insufficient balance");

      const receiverWallet = await Wallet.findOneAndUpdate(
        { userId: toUser._id },
        { $inc: { balance: amount } },
        { returnDocument: "after", session }
      );
      if (!receiverWallet) throw new MoneyError(404, "Receiver not found");

      const [txn] = await Transaction.create(
        [{ type: "TRANSFER", fromUserId, toUserId: toUser._id, amount, note }],
        { session }
      );

      await LedgerEntry.create(
        [
          { userId: fromUserId, transactionId: txn._id, direction: "DEBIT", amount, balanceAfter: senderWallet.balance },
          { userId: toUser._id, transactionId: txn._id, direction: "CREDIT", amount, balanceAfter: receiverWallet.balance },
        ],
        { session }
      );

      result = {
        transaction: {
          id: txn._id.toString(),
          to: toUser.username,
          amount,
          note,
          createdAt: txn.createdAt,
        },
        balance: senderWallet.balance,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------- NEW: TOP-UP (money from Razorpay), credited exactly once ----------
async function creditTopUp({ orderId, paymentId, via }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // 1. Claim the order: CREATED (or EXPIRED) -> PAID, only if it is still unpaid
      const order = await PaymentOrder.findOneAndUpdate(
        { _id: orderId, status: { $in: ["CREATED", "EXPIRED"] } },
        { status: "PAID", gatewayPaymentId: paymentId, paidVia: via },
        { returnDocument: "after", session }
      );
      if (!order) {
        result = { credited: false }; // already paid by someone else: add nothing
        return;
      }

      // 2. Add the amount saved in OUR order to the wallet
      const wallet = await Wallet.findOneAndUpdate(
        { userId: order.userId },
        { $inc: { balance: order.amount } },
        { returnDocument: "after", session }
      );
      if (!wallet) throw new MoneyError(404, "Wallet not found");

      // 3. Record the event and the passbook line
      const [txn] = await Transaction.create(
        [{ type: "TOPUP", toUserId: order.userId, amount: order.amount, note: "Added via Razorpay" }],
        { session }
      );
      await LedgerEntry.create(
        [{ userId: order.userId, transactionId: txn._id, direction: "CREDIT", amount: order.amount, balanceAfter: wallet.balance }],
        { session }
      );
      await PaymentOrder.updateOne({ _id: order._id }, { transactionId: txn._id }, { session });

      result = { credited: true, amount: order.amount, balance: wallet.balance };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { MoneyError, deposit, runTransfer, creditTopUp }; // NEW: creditTopUp exported