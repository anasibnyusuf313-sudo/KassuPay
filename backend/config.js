// All secrets come from .env. If any is missing, stop with a clear message.
const REQUIRED = [
  "JWT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error("Missing in your .env file: " + missing.join(", "));
  process.exit(1);
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
};