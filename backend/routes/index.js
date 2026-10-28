const express = require("express");
const userRouter = require("./user");
const walletRouter = require("./wallet");
const adminRouter = require("./admin");
const paymentsRouter = require("./payments"); // NEW

const router = express.Router();

router.use("/user", userRouter);
router.use("/wallet/add-money", paymentsRouter); // NEW, before /wallet
router.use("/wallet", walletRouter);
router.use("/bank", require("./bank"));
router.use("/withdraw", require("./withdraw"));
router.use("/admin", adminRouter);

module.exports = router;