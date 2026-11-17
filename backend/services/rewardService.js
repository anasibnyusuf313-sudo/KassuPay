const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Wallet, Transaction, LedgerEntry } = require("../db");
const Offer = require("../models/Offer");
const RewardCard = require("../models/RewardCard");
const RewardCount = require("../models/RewardCount");

// ---------- settings ----------
const PROMO_EMAIL = "rewards@kaasupay.system"; // the company wallet's owner (A1)
const CARD_EXPIRY_DAYS = 7;
const MAX_CARDS_PER_DAY = 3; // per payer, per India day (A7)
const PING_PONG_HOURS = 24; // no card if the receiver paid the payer in this time (A7)

// An expected problem (like "Card not found") that carries a status code
class RewardError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// paise -> "₹10.00"
function rupees(paise) {
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

// "2026-11-17": today's date in India (UTC+05:30), so "per day" matches the person's day
function indiaDay(date) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------- A1: the promo wallet ----------
// A special user nobody can sign in as (its password is random and thrown away).
// Created once, the first time it is needed. Always called OUTSIDE a transaction.
let promoUser = null;

async function getPromoUser() {
  if (promoUser) return promoUser;

  let user = await User.findOne({ username: PROMO_EMAIL });
  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    try {
      user = await User.create({
        username: PROMO_EMAIL,
        firstName: "KaasuPay",
        lastName: "Rewards",
        passwordHash,
      });
    } catch (err) {
      if (err.code !== 11000) throw err; // someone else created it at the same moment
      user = await User.findOne({ username: PROMO_EMAIL });
    }
  }

  try {
    await Wallet.updateOne({ userId: user._id }, { $setOnInsert: { balance: 0 } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  promoUser = user;
  return user;
}

// ---------- Level 1: create an offer and deposit its budget ----------
async function createOffer({ code, title, percent, maxCashback, minPayment, budget, days }) {
  if (await Offer.exists({ code })) throw new RewardError(409, "Offer code already exists");

  const promo = await getPromoUser();
  const session = await mongoose.startSession();
  try {
    let offer;
    await session.withTransaction(async () => {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

      [offer] = await Offer.create(
        [{ code, title, percent, maxCashback, minPayment, budget, budgetLeft: budget, startsAt, endsAt }],
        { session }
      );

      // The budget is real money in the company wallet: a normal DEPOSIT with a ledger row
      const wallet = await Wallet.findOneAndUpdate(
        { userId: promo._id },
        { $inc: { balance: budget } },
        { returnDocument: "after", session }
      );
      if (!wallet) throw new RewardError(500, "Promo wallet is missing");

      const [txn] = await Transaction.create(
        [{ type: "DEPOSIT", toUserId: promo._id, amount: budget, note: `Cashback budget: ${code}` }],
        { session }
      );
      await LedgerEntry.create(
        [{ userId: promo._id, transactionId: txn._id, direction: "CREDIT", amount: budget, balanceAfter: wallet.balance }],
        { session }
      );
    });
    return offer;
  } catch (err) {
    if (err && err.code === 11000) throw new RewardError(409, "Offer code already exists");
    throw err;
  } finally {
    await session.endSession();
  }
}

// ---------- Level 2 + 4: maybe issue a card, INSIDE the payment's transaction ----------
// Called by transferInSession (services/money.js) after the money has moved.
// Both /wallet/transfer and paying a money request go through that function,
// so both get cards from this one place.
//
// "No card" is never an error: it just returns null and the payment goes on.
async function maybeIssueCard({ session, payerId, receiverId, amount, transactionId }) {
  try {
    const now = new Date();

    // 1. Is an offer running right now, and is the payment big enough?
    const offer = await Offer.findOne({ startsAt: { $lte: now }, endsAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .session(session);
    if (!offer || amount < offer.minPayment) return null;

    // 2. The server decides the reward, in whole paise, rounded DOWN (A4)
    const reward = Math.min(Math.floor((amount * offer.percent) / 100), offer.maxCashback);
    if (reward < 1) return null;

    // 3. No ping pong: no card if the receiver paid the payer in the last 24 hours (A7)
    const since = new Date(now.getTime() - PING_PONG_HOURS * 60 * 60 * 1000);
    const pingPong = await Transaction.exists({
      type: "TRANSFER",
      fromUserId: receiverId,
      toUserId: payerId,
      createdAt: { $gte: since },
    }).session(session);
    if (pingPong) return null;

    // 4. At most 3 cards per payer per India day: one atomic step (A7).
    //    First make sure today's counter exists, then add 1 only if it is still under 3.
    const day = indiaDay(now);
    await RewardCount.updateOne({ userId: payerId, day }, { $setOnInsert: { cards: 0 } }, { upsert: true, session });
    const slot = await RewardCount.findOneAndUpdate(
      { userId: payerId, day, cards: { $lt: MAX_CARDS_PER_DAY } },
      { $inc: { cards: 1 } },
      { returnDocument: "after", session }
    );
    if (!slot) return null;

    // 5. Make the card. The unique index on transactionId means a second card
    //    for the same payment is impossible (A3).
    const [card] = await RewardCard.create(
      [
        {
          userId: payerId,
          offerId: offer._id,
          transactionId,
          amount: reward,
          status: "UNCLAIMED",
          expiresAt: new Date(now.getTime() + CARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        },
      ],
      { session }
    );
    return card;
  } catch (err) {
    // A clash with another payment at the same moment must reach withTransaction,
    // so it can run the whole payment again.
    if (err && typeof err.hasErrorLabel === "function" && err.hasErrorLabel("TransientTransactionError")) {
      throw err;
    }
    // Anything else in the card code is a bug in the BONUS, so it must not fail the payment.
    console.error("Scratch card skipped:", err && err.message);
    return null;
  }
}

// ---------- Level 3: scratch a card ----------
// Why a claim failed: not found, not yours, expired, or already used.
// This read only picks the message. The atomic update above is the real protection.
async function explainClaimFailure(cardId, userId) {
  const card = await RewardCard.findById(cardId);
  if (!card || !card.userId.equals(userId)) return new RewardError(404, "Card not found");

  const now = new Date();
  if (card.status === "UNCLAIMED" && card.expiresAt <= now) {
    await RewardCard.updateOne({ _id: card._id, status: "UNCLAIMED" }, { $set: { status: "EXPIRED" } });
    return new RewardError(410, "This card has expired");
  }
  if (card.status === "EXPIRED") return new RewardError(410, "This card has expired");
  return new RewardError(409, `This card is already ${card.status}`);
}

// The four steps of A5, in ONE transaction.
async function claimCard({ cardId, userId }) {
  if (!mongoose.isValidObjectId(cardId)) throw new RewardError(404, "Card not found");

  const promo = await getPromoUser();
  const session = await mongoose.startSession();
  try {
    let result = null;
    let missed = false;

    await session.withTransaction(async () => {
      // (withTransaction may run this function again after a clash, so start clean)
      result = null;
      missed = false;
      const now = new Date();

      // 1. UNCLAIMED -> CLAIMED, only if it is still unclaimed, not expired, and MINE
      const card = await RewardCard.findOneAndUpdate(
        { _id: cardId, userId, status: "UNCLAIMED", expiresAt: { $gt: now } },
        { $set: { status: "CLAIMED", claimedAt: now } },
        { returnDocument: "after", session }
      );
      if (!card) {
        missed = true;
        return;
      }

      // 2. Take the amount from the offer's budget, only if enough is left, in ONE step (A2)
      const offer = await Offer.findOneAndUpdate(
        { _id: card.offerId, budgetLeft: { $gte: card.amount } },
        { $inc: { budgetLeft: -card.amount } },
        { returnDocument: "after", session }
      );

      // 4. Budget could not cover it: the card becomes EXHAUSTED and we COMMIT.
      //    This is a correct ending, not an error. Throwing here would roll the card
      //    back to UNCLAIMED and the person could scratch it forever.
      if (!offer) {
        await RewardCard.updateOne({ _id: card._id }, { $set: { status: "EXHAUSTED" } }, { session });
        result = { exhausted: true };
        return;
      }

      // 3. Budget step worked: MOVE the money promo wallet -> user, with two ledger rows.
      //    This is not the user's send-money code, so the Day 6 daily limit does not apply.
      const promoWallet = await Wallet.findOneAndUpdate(
        { userId: promo._id, balance: { $gte: card.amount } },
        { $inc: { balance: -card.amount } },
        { returnDocument: "after", session }
      );
      if (!promoWallet) throw new RewardError(500, "The cashback wallet is empty. Please tell the staff.");

      const userWallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { balance: card.amount } },
        { returnDocument: "after", session }
      );
      if (!userWallet) throw new RewardError(404, "Wallet not found");

      const [txn] = await Transaction.create(
        [
          {
            type: "CASHBACK",
            fromUserId: promo._id,
            toUserId: userId,
            amount: card.amount,
            note: String(offer.title || "Cashback").slice(0, 50),
          },
        ],
        { session }
      );

      await LedgerEntry.create(
        [
          { userId: promo._id, transactionId: txn._id, direction: "DEBIT", amount: card.amount, balanceAfter: promoWallet.balance },
          { userId, transactionId: txn._id, direction: "CREDIT", amount: card.amount, balanceAfter: userWallet.balance },
        ],
        { session, ordered: true }
      );

      await RewardCard.updateOne({ _id: card._id }, { $set: { cashbackTransactionId: txn._id } }, { session });

      result = { exhausted: false, amount: card.amount, balance: userWallet.balance };
    });

    if (missed) throw await explainClaimFailure(cardId, userId);

    if (result.exhausted) return { message: "Better luck next time", amount: 0 };
    return { message: `You won ${rupees(result.amount)}`, amount: result.amount, balance: result.balance };
  } finally {
    await session.endSession();
  }
}

// ---------- lazy expiry: no background job (like Day 7) ----------
async function expireOldCardsFor(userId) {
  await RewardCard.updateMany(
    { userId, status: "UNCLAIMED", expiresAt: { $lte: new Date() } },
    { $set: { status: "EXPIRED" } }
  );
}

// ---------- my cards ----------
async function listCards(userId) {
  await expireOldCardsFor(userId);

  const cards = await RewardCard.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(50);
  const offers = await Offer.find({ _id: { $in: [...new Set(cards.map((c) => String(c.offerId)))] } }).select("code title");
  const byId = new Map(offers.map((o) => [String(o._id), o]));

  return cards.map((c) => {
    const offer = byId.get(String(c.offerId));
    // The reward stays hidden until the card is scratched (A4). It also leaks nothing.
    let amount = null;
    if (c.status === "CLAIMED") amount = c.amount;
    if (c.status === "EXHAUSTED") amount = 0;
    return {
      id: c._id.toString(),
      offer: offer ? offer.code : "",
      offerTitle: offer ? offer.title : "Festive cashback",
      amount,
      status: c.status,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    };
  });
}

// ---------- A8: a report that proves itself ----------
async function offerReport(code) {
  const offer = await Offer.findOne({ code });
  if (!offer) throw new RewardError(404, "Offer not found");

  // old unscratched cards count as EXPIRED in the report too
  await RewardCard.updateMany(
    { offerId: offer._id, status: "UNCLAIMED", expiresAt: { $lte: new Date() } },
    { $set: { status: "EXPIRED" } }
  );

  // one aggregation: how many cards in each state, and the total of the CLAIMED ones
  const rows = await RewardCard.aggregate([
    { $match: { offerId: offer._id } },
    {
      $group: {
        _id: "$status",
        cards: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ["$status", "CLAIMED"] }, "$amount", 0] } },
      },
    },
  ]);

  const count = (status) => (rows.find((r) => r._id === status) || { cards: 0 }).cards;
  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0);

  return {
    code: offer.code,
    title: offer.title,
    budget: offer.budget,
    budgetLeft: offer.budgetLeft,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    cardsIssued: rows.reduce((sum, r) => sum + r.cards, 0),
    unclaimed: count("UNCLAIMED"),
    claimed: count("CLAIMED"),
    exhausted: count("EXHAUSTED"),
    expired: count("EXPIRED"),
    totalPaid,
    // the proof: what left the budget must equal what reached users
    check: offer.budget - offer.budgetLeft === totalPaid,
  };
}

module.exports = {
  RewardError,
  createOffer,
  maybeIssueCard,
  claimCard,
  listCards,
  offerReport,
};
