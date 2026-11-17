const express = require("express");
const userRouter = require("./user");
const walletRouter = require("./wallet");
const adminRouter = require("./admin");
const paymentsRouter = require("./payments");
const pinRouter = require("./pin");
const bankRouter = require("./bank");
const withdrawRouter = require("./withdraw");
const requestsRouter = require("./moneyRequests"); // Day 7
const autopayRouter = require("./autopay");
const cronRouter = require("./cron");
const historyRouter = require("./history");

const offersAdminRouter = require("./offersAdmin"); // Day 9
const rewardsRouter = require("./rewardsRoutes"); // Day 9

const router = express.Router();

router.use("/user", userRouter);
router.use("/pin", pinRouter);
router.use("/requests", requestsRouter); // Day 7
router.use("/autopay", autopayRouter);
router.use("/cron", cronRouter);

// these must come BEFORE "/wallet", otherwise walletRouter catches them first
router.use("/wallet/add-money", paymentsRouter);
router.use("/wallet/bank-accounts", bankRouter);
router.use("/wallet/withdrawals", withdrawRouter);

router.use("/wallet", historyRouter); 
router.use("/wallet", walletRouter);
// Day 9: these must come BEFORE "/admin", or adminRouter catches /admin/offers first
router.use("/admin/offers", offersAdminRouter);
router.use("/rewards", rewardsRouter);

router.use("/admin", adminRouter);

module.exports = router;
