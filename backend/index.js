require("dotenv").config(); // must be the very first line

const path = require("path");
const express = require("express");
const cors = require("cors");
const rootRouter = require("./routes/index");
const webhooksRouter = require("./routes/webhooks");
const { connectDB } = require("./db");
const { connectRedis } = require("./redis");

const app = express();
app.use(cors());

// Connect once, reuse across requests (works locally and on Vercel)
let ready;
function init() {
  if (!ready) {
    ready = connectDB().then(() => {
      connectRedis(); // no await
    });
    ready.catch(() => { ready = null; }); // allow retry if it failed
  }
  return ready;
}

app.use(async (req, res, next) => {
  try {
    await init();
    next();
  } catch (err) {
    console.error("DB connection failed:", err.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Webhook needs the RAW bytes, so it comes BEFORE express.json()
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.json({ status: "KaasuPay backend is running" });
});

app.use("/api/v1", rootRouter);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side" });
});

// Only listen when running locally, not on Vercel
if (!process.env.VERCEL) {
  init()
    .then(() => app.listen(3000, () => console.log("Server running on http://localhost:3000")))
    .catch((err) => {
      console.error("Could not start:", err.message);
      process.exit(1);
    });
}

module.exports = app;