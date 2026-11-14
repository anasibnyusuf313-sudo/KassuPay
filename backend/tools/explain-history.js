// Asks MongoDB HOW it runs the history query, so you can prove the index works.
// Usage:  node tools/explain-history.js USER_ID
// Put the output "before the index" and "after the index" in DAY8_ANSWERS.md.
// GOOD: IXSCAN, no SORT, about 21 documents examined.  BAD: COLLSCAN or SORT.
require("dotenv").config();
const mongoose = require("mongoose");
const { LedgerEntry } = require("../db");

const userId = process.argv[2];
if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
  console.log("Usage: node tools/explain-history.js USER_ID   (the 24 character id)");
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const found = await LedgerEntry.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(21)
    .explain("executionStats");
  const plan = Array.isArray(found) ? found[0] : found;

  // collect the names of all stages in the winning plan
  const stages = [];
  (function walk(stage) {
    if (!stage) return;
    if (stage.stage) stages.push(stage.stage);
    walk(stage.inputStage);
    (stage.inputStages || []).forEach(walk);
    walk(stage.queryPlan); // newer MongoDB versions nest the plan here
  })(plan.queryPlanner.winningPlan);

  console.log("Stages in the winning plan:", stages.join(" -> "));
  console.log("Uses an index (IXSCAN):    ", stages.includes("IXSCAN"));
  console.log("Reads everything (COLLSCAN):", stages.includes("COLLSCAN"));
  console.log("Sorts in memory (SORT):     ", stages.includes("SORT"));
  console.log("totalDocsExamined:", plan.executionStats.totalDocsExamined);
  console.log("nReturned:        ", plan.executionStats.nReturned);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
