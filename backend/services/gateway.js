const crypto = require("crypto");
const Razorpay = require("razorpay");
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require("../config");

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

// Ask Razorpay to create an order (the amount is fixed here, on our side)
async function createGatewayOrder({ amount, receipt }) {
  return razorpay.orders.create({ amount, currency: "INR", receipt });
}

// Compare two seals in constant time. Different lengths would make timingSafeEqual throw.
function sameSeal(expected, received) {
  if (typeof received !== "string" || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// Checkout signature: HMAC of "order_id|payment_id" with the Key Secret
function checkCheckoutSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId)
    .digest("hex");
  return sameSeal(expected, signature);
}

// Webhook signature: HMAC of the RAW body with the Webhook Secret
function checkWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return sameSeal(expected, signature);
}

module.exports = { createGatewayOrder, checkCheckoutSignature, checkWebhookSignature };