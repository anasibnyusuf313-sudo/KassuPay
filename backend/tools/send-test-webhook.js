// Sends a signed, Razorpay style "payment.captured" webhook to your own server.
// Usage: node tools/send-test-webhook.js <order_id> <amount_in_paise> [event_id] [payment_id]
require("dotenv").config({ quiet: true });
const crypto = require("crypto");

const [orderId, amount, eventId = "evt_" + Date.now(), paymentId = "pay_TEST" + Date.now()] = process.argv.slice(2);
if (!orderId || !amount) {
  console.log("Usage: node tools/send-test-webhook.js <order_id> <amount_in_paise> [event_id] [payment_id]");
  process.exit(1);
}

const body = JSON.stringify({
  entity: "event",
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: Number(amount), currency: "INR", status: "captured", method: "upi" } } },
});
const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

fetch("http://localhost:3000/api/v1/webhooks/razorpay", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Razorpay-Signature": signature, "x-razorpay-event-id": eventId },
  body,
})
  .then(async (r) => console.log(r.status, await r.text()))
  .catch((e) => console.error("Could not reach your server:", e.message));