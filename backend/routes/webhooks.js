const express = require("express");
const { PaymentOrder } = require("../db");
const { checkWebhookSignature } = require("../services/gateway");
const { creditTopUp } = require("../services/money");

const router = express.Router();

// req.body is a Buffer of the exact bytes here (see index.js)
router.post("/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  // 1. Check the seal on the RAW bytes
  if (!Buffer.isBuffer(req.body) || !checkWebhookSignature(req.body, signature)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  // 2. Only now read it as JSON
  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    return res.status(400).json({ error: "Invalid webhook body" });
  }

  // 3. Act only on payment.captured. Reply 200 to the rest.
  if (event.event !== "payment.captured") {
    return res.json({ status: "ignored", event: event.event });
  }

  const payment = event.payload && event.payload.payment && event.payload.payment.entity;
  if (!payment || !payment.order_id) {
    return res.json({ status: "ignored: unknown order" });
  }

  // 4. Find OUR order
  const order = await PaymentOrder.findOne({ gatewayOrderId: payment.order_id });
  if (!order) {
    return res.json({ status: "ignored: unknown order" });
  }

  // 5. Never trust an amount from outside: compare with our own order
  if (payment.amount !== order.amount || payment.currency !== order.currency) {
    console.error("AMOUNT MISMATCH", { order: order.gatewayOrderId, ours: order.amount, theirs: payment.amount });
    return res.json({ status: "flagged: amount mismatch" }); // 200, so Razorpay stops resending
  }

  // 6. Credit once (the same function as /verify)
  const out = await creditTopUp({ orderId: order._id, paymentId: payment.id, via: "WEBHOOK" });
  res.json({ status: out.credited ? "credited" : "already credited" });
});

module.exports = router;