const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../authmiddleware");
const BankAccount = require("../models/BankAccount");

const router = express.Router();

// same style as wallet.js: the login middleware puts the user id in req.userId
const uid = (req) => req.userId;

const MAX_ACCOUNTS = 5;

// only send safe fields back to the browser
const publicView = (a) => ({
  id: a._id.toString(),
  accountHolderName: a.accountHolderName,
  last4: a.last4,
  ifsc: a.ifsc,
  createdAt: a.createdAt,
});

// Add a bank account
router.post("/", authMiddleware, async (req, res) => {
  try {
    const name = String(req.body.accountHolderName || "").trim();
    const accountNumber = String(req.body.accountNumber || "").trim();
    const ifsc = String(req.body.ifsc || "").trim().toUpperCase();

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: "Enter the account holder name" });
    }
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({ error: "Account number must be 9 to 18 digits" });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ error: "Enter a valid IFSC code" });
    }

    const count = await BankAccount.countDocuments({ userId: uid(req) });
    if (count >= MAX_ACCOUNTS) {
      return res.status(400).json({ error: `You can add up to ${MAX_ACCOUNTS} bank accounts` });
    }

    const account = await BankAccount.create({
      userId: uid(req),
      accountHolderName: name,
      accountNumber,
      last4: accountNumber.slice(-4),
      ifsc,
    });

    res.status(201).json(publicView(account));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This bank account is already added" });
    }
    console.error("ADD BANK ERROR:", err);
    res.status(500).json({ error: "Something went wrong on our side" });
  }
});

// List my bank accounts
router.get("/", authMiddleware, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ userId: uid(req) }).sort({ createdAt: -1 });
    res.json(accounts.map(publicView));
  } catch (err) {
    console.error("LIST BANK ERROR:", err);
    res.status(500).json({ error: "Something went wrong on our side" });
  }
});

// Delete a bank account
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid bank account" });
    }
    const result = await BankAccount.deleteOne({ _id: req.params.id, userId: uid(req) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Bank account not found" });
    }
    res.json({ message: "Bank account removed" });
  } catch (err) {
    console.error("DELETE BANK ERROR:", err);
    res.status(500).json({ error: "Something went wrong on our side" });
  }
});

module.exports = router;