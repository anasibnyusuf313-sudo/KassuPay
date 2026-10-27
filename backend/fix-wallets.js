require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // use the raw collection so Mongoose doesn't auto-cast the query
  const wallets = mongoose.connection.collection("wallets");
  const docs = await wallets.find({ userId: { $type: "string" } }).toArray();
  console.log("Found", docs.length, "wallets with string userId");

 for (const w of docs) {
  const oid = new mongoose.Types.ObjectId(w.userId);
  const dup = await wallets.findOne({ userId: oid });

  if (dup) {
    if (dup.balance === 0) {
      await wallets.deleteOne({ _id: dup._id }); // remove the empty one
    } else {
      console.log("SKIPPED (both wallets have data):", w.userId);
      continue;
    }
  }

  await wallets.updateOne({ _id: w._id }, { $set: { userId: oid } });
}

  console.log("Done");
  await mongoose.disconnect();
})();