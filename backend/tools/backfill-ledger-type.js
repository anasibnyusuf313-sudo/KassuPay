// One time fix for OLD ledger rows: copies the type from the Transaction onto the row.
// Safe to run twice: it only touches rows that are still missing the type.
// Run it on every database you use (local, and Atlas):
//    node tools/backfill-ledger-type.js
require("dotenv").config();
const mongoose = require("mongoose");
const { LedgerEntry, Transaction } = require("../db");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  let fixed = 0;
  let orphans = 0;

  // { type: null } matches rows where type is missing or null
  const cursor = LedgerEntry.find({ type: null }).select("_id transactionId").lean().cursor();

  for await (const row of cursor) {
    const txn = await Transaction.findById(row.transactionId).select("type").lean();
    if (!txn) {
      orphans++; // a ledger row whose transaction is gone: leave it alone
      continue;
    }
    await LedgerEntry.updateOne({ _id: row._id }, { $set: { type: txn.type } });
    fixed++;
  }

  console.log(`Fixed ${fixed} rows` + (orphans ? ` (${orphans} rows had no transaction)` : ""));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
