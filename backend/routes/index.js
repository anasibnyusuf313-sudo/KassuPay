const express = require("express");
const userRouter = require("./user");
const walletRouter = require("./wallet");
const adminRouter = require("./admin");
const paymentsRouter = require("./payments");
const pinRouter = require("./pin");
const bankRouter = require("./bank");
const withdrawRouter = require("./withdraw");
const requestsRouter = require("./requests"); // Day 7

const router = express.Router();

router.use("/user", userRouter);
router.use("/pin", pinRouter);
router.use("/requests", requestsRouter); // Day 7

// these must come BEFORE "/wallet", otherwise walletRouter catches them first
router.use("/wallet/add-money", paymentsRouter);
router.use("/wallet/bank-accounts", bankRouter);
router.use("/wallet/withdrawals", withdrawRouter);

router.use("/wallet", walletRouter);
router.use("/admin", adminRouter);

module.exports = router;