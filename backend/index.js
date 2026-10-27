require("dotenv").config(); // must be the very first line


const path = require("path");
const express = require("express");
const rootRouter = require("./routes/index");
const webhooksRouter = require("./routes/webhooks");
const { connectDB } = require("./db");
const { connectRedis } = require("./redis");
const cors = require("cors");   // with your other requires

const app = express();
app.use(cors());                // right after this line, before the routes

// NEW: the webhook needs the RAW bytes, so it comes BEFORE express.json()
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.use(express.json());

// NEW: serves public/add-money.html
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

async function start() {
  await connectDB();
  connectRedis(); // no await
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
}

start().catch((err) => {
  console.error("Could not start:", err.message);
  process.exit(1);
});
   if (!process.env.VERCEL) {
     app.listen(3000, () => console.log("Server running on http://localhost:3000"));
   }
   module.exports = app;