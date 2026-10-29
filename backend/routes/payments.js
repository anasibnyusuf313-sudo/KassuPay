const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const authMiddleware = require("../authmiddleware");
const { PaymentOrder, Wallet } = require("../db");
const { createGatewayOrder, checkCheckoutSignature } = require("../services/gateway");
const { creditTopUp } = require("../services/money");
const { RAZORPAY_KEY_ID } = require("../config");

const router = express.Router();

function firstError(zodError) {
  const issue = zodError.issues[0];
  const field = issue.path[0] || "body";
  return `${field}: ${issue.message}`;
}

// ---------------- LEVEL 1: CREATE AN ORDER ----------------
const orderSchema = z.object({
  amount: z
    .number()
    .int("must be whole paise")
    .min(1000, "must be at least 1000 paise")
    .max(1000000, "must be at most 1000000 paise"),
});

router.post("/order", authMiddleware, async (req, res) => {
  try {
    const result = orderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: firstError(result.error) });
    }
    const { amount } = result.data;

    // make our own id first, so the receipt can be short: "kp_" + id (27 characters)
    const id = new mongoose.Types.ObjectId();
    const gatewayOrder = await createGatewayOrder({ amount, receipt: "kp_" + id });

    await PaymentOrder.create({
      _id: id,
      userId: req.userId,
      gatewayOrderId: gatewayOrder.id,
      amount,
    });

    // never send the Key Secret. The Key Id is fine.
    res.status(201).json({
      orderId: gatewayOrder.id,
      amount,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order failed:", err);
    res.status(500).json({ error: "Could not create the payment order" });
  }
});

// ---------------- LEVEL 3: VERIFY AND ADD MONEY ONCE ----------------
const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

router.post("/verify", authMiddleware, async (req, res) => {
  const result = verifySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: firstError(result.error) });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = result.data;

  // the order must be MINE
  const order = await PaymentOrder.findOne({ gatewayOrderId: razorpay_order_id, userId: req.userId });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // check the seal, using the order id from OUR database
  if (!checkCheckoutSignature(order.gatewayOrderId, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  const out = await creditTopUp({ orderId: order._id, paymentId: razorpay_payment_id, via: "CALLBACK" });

  const wallet = await Wallet.findOne({ userId: req.userId });
  res.json({
    message: out.credited ? "Money added" : "Already added",
    orderId: order.gatewayOrderId,
    amount: order.amount,
    balance: wallet.balance,
  });
});

// ---------------- LEVEL 5: ORDER STATUS ----------------
router.get("/orders/:orderId", authMiddleware, async (req, res) => {
  const order = await PaymentOrder.findOne({ gatewayOrderId: req.params.orderId, userId: req.userId });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json({
    orderId: order.gatewayOrderId,
    amount: order.amount,
    status: order.status,
    paidVia: order.paidVia || null,
  });
});

module.exports = router;