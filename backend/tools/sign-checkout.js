// Makes the signature Razorpay checkout would send, so you can test /verify from Postman.
// Usage: node tools/sign-checkout.js <order_id> <payment_id>
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const [orderId, paymentId] = process.argv.slice(2);
if (!orderId || !paymentId) {
  console.log("Usage: node tools/sign-checkout.js <order_id> <payment_id>");
  process.exit(1);
}
const signature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  .update(orderId + "|" + paymentId)
  .digest("hex");
console.log(JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }));