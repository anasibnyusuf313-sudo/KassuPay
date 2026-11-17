#!/usr/bin/env node
// Day 9 setup: makes the few small edits that existing files need.
//
// Run it ONCE from your project root (the folder that contains backend/ and frontend/):
//     node apply-day9.js
//
// - Every file is copied to .day9-backup/ before it is changed.
// - Running it twice is safe: finished edits are skipped.
// - If an edit cannot be made (your file looks different), it tells you the exact
//   change to make by hand. See DAY9_README.md, "If the script says MANUAL".

const fs = require("fs");
const path = require("path");

const root = __dirname;
const backupDir = path.join(root, ".day9-backup");
let needsManual = 0;

const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");

function readFile(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function writeFile(rel, text) {
  const p = path.join(root, rel);
  const b = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(b), { recursive: true });
  if (!fs.existsSync(b)) fs.copyFileSync(p, b);
  fs.writeFileSync(p, text);
}

// fn(text) returns { status: "done", text } | { status: "already" } | { status: "manual", how }
function patch(rel, what, required, fn) {
  const text = readFile(rel);
  if (text === null) {
    console.log(`  [MISSING] ${rel} not found (${what})`);
    if (required) needsManual++;
    return;
  }
  const out = fn(text);
  if (out.status === "done") {
    writeFile(rel, out.text);
    console.log(`  [done]    ${rel}: ${what}`);
  } else if (out.status === "already") {
    console.log(`  [skipped] ${rel}: ${what} (already there)`);
  } else {
    console.log(`  [MANUAL]  ${rel}: ${what}\n            ${out.how}`);
    if (required) needsManual++;
  }
}

console.log("Day 9: Festive cashback scratch cards\n");

// ---- are the new files in place? ----
const must = [
  "backend/services/rewardService.js",
  "backend/routes/offersAdmin.js",
  "backend/routes/rewardsRoutes.js",
  "backend/models/Offer.js",
  "backend/models/RewardCard.js",
  "backend/models/RewardCount.js",
];
const absent = must.filter((f) => !fs.existsSync(path.join(root, f)));
if (absent.length) {
  console.log("These files are missing. Unzip day9.zip into the project root first:");
  absent.forEach((f) => console.log("   " + f));
  process.exit(1);
}

console.log("Backend");

// 1. Transaction type CASHBACK
patch("backend/db.js", 'allow the CASHBACK transaction type', true, (t) => {
  if (/enum:\s*\[[^\]]*"CASHBACK"/.test(t)) return { status: "already" };
  const re = /(enum:\s*\[\s*"DEPOSIT"[^\]]*?)(\s*\])/;
  if (!re.test(t)) {
    return {
      status: "manual",
      how: 'In the Transaction model, add "CASHBACK" to the type enum: ["DEPOSIT", "TRANSFER", "TOPUP", "WITHDRAW", "CASHBACK"]',
    };
  }
  return { status: "done", text: t.replace(re, (m, a, b) => `${a}, "CASHBACK"${b}`) };
});

// 2. mount the new routes (BEFORE "/admin")
patch("backend/routes/index.js", "mount /admin/offers and /rewards", true, (t) => {
  if (t.includes("offersAdmin") && t.includes("rewardsRoutes")) return { status: "already" };
  const eol = eolOf(t);
  const routerDef = /^const router = express\.Router\(\);?/m;
  const adminMount = /^[ \t]*router\.use\(\s*["']\/admin["']\s*,\s*adminRouter\s*\)\s*;?/m;
  if (!routerDef.test(t) || !adminMount.test(t)) {
    return {
      status: "manual",
      how:
        'Add  const offersAdminRouter = require("./offersAdmin");  and  const rewardsRouter = require("./rewardsRoutes");  at the top,\n' +
        '            and add  router.use("/admin/offers", offersAdminRouter);  router.use("/rewards", rewardsRouter);  ABOVE the line  router.use("/admin", adminRouter);',
    };
  }
  let out = t.replace(
    routerDef,
    (m) =>
      `const offersAdminRouter = require("./offersAdmin"); // Day 9${eol}` +
      `const rewardsRouter = require("./rewardsRoutes"); // Day 9${eol}${eol}${m}`
  );
  out = out.replace(
    adminMount,
    (m) =>
      `// Day 9: these must come BEFORE "/admin", or adminRouter catches /admin/offers first${eol}` +
      `router.use("/admin/offers", offersAdminRouter);${eol}` +
      `router.use("/rewards", rewardsRouter);${eol}${eol}${m}`
  );
  return { status: "done", text: out };
});

// 3. issue a card inside the payment's transaction
patch("backend/services/money.js", "issue a scratch card inside transferInSession", true, (t) => {
  if (t.includes("maybeIssueCard")) return { status: "already" };
  const eol = eolOf(t);
  const fnStart = t.indexOf("async function transferInSession");
  const reqLine = /^const mongoose = require\(["']mongoose["']\);?/m;
  if (fnStart === -1 || !reqLine.test(t)) {
    return {
      status: "manual",
      how:
        'Top of file: const { maybeIssueCard } = require("./rewardService");\n' +
        "            In transferInSession, right before its final  return {  add:\n" +
        "              await maybeIssueCard({ session, payerId: fromUserId, receiverId: toUser._id, amount, transactionId: txn._id });",
    };
  }
  const rest = t.slice(fnStart);
  const ret = /^([ \t]*)return \{/m.exec(rest);
  if (!ret) {
    return { status: "manual", how: "Could not find the final return in transferInSession. Add the maybeIssueCard call before it." };
  }
  const indent = ret[1];
  const call =
    `${indent}// Day 9: a payment may earn a scratch card. Same transaction. It never fails the payment.${eol}` +
    `${indent}await maybeIssueCard({${eol}` +
    `${indent}  session,${eol}` +
    `${indent}  payerId: fromUserId,${eol}` +
    `${indent}  receiverId: toUser._id,${eol}` +
    `${indent}  amount,${eol}` +
    `${indent}  transactionId: txn._id,${eol}` +
    `${indent}});${eol}${eol}`;
  const at = fnStart + ret.index;
  let out = t.slice(0, at) + call + t.slice(at);
  out = out.replace(reqLine, (m) => `${m}${eol}const { maybeIssueCard } = require("./rewardService"); // Day 9`);
  return { status: "done", text: out };
});

// 4. history label "Cashback" (best effort: Day 8 may have rewritten history)
{
  const dirs = ["backend/routes", "backend/services"];
  const files = [];
  for (const d of dirs) {
    const full = path.join(root, d);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) if (f.endsWith(".js")) files.push(`${d}/${f}`);
  }
  const candidates = files.filter((f) => (readFile(f) || "").includes("Withdrawn to bank"));
  const label = /(\}\s*else if \(\s*t\s*&&\s*t\.type === "WITHDRAW"\s*\)\s*\{\s*withWhom = "Withdrawn to bank";\s*\})/;
  if (candidates.length === 0) {
    console.log(
      '  [MANUAL]  history: could not find where history labels each line.\n' +
        '            Wherever a CASHBACK transaction is shown, label it "Cashback" (see DAY9_README.md).'
    );
  }
  for (const f of candidates) {
    patch(f, 'label CASHBACK lines "Cashback" in history', false, (t) => {
      if (t.includes('"CASHBACK"')) return { status: "already" };
      if (!label.test(t)) {
        return {
          status: "manual",
          how: 'Where withWhom is set, add:  else if (t && t.type === "CASHBACK") { withWhom = "Cashback"; }',
        };
      }
      return { status: "done", text: t.replace(label, (m) => `${m} else if (t && t.type === "CASHBACK") { withWhom = "Cashback"; }`) };
    });
  }
}

console.log("\nFrontend");

// 5. nav link: Rewards
patch("frontend/components/AppShell.tsx", "add the Rewards link", false, (t) => {
  if (t.includes('href: "/rewards"')) return { status: "already" };
  const eol = eolOf(t);
  const after = /^([ \t]*)\{ href: "\/requests"[^\n]*\n/m.exec(t) || /^([ \t]*)\{ href: "\/withdraw"[^\n]*\n/m.exec(t);
  if (!after) {
    return {
      status: "manual",
      how: 'Add  { href: "/rewards", label: "Rewards", icon: "add" },  to the MAIN list, and "/rewards" to the PHONE list.',
    };
  }
  const item = `${after[1]}{ href: "/rewards", label: "Rewards", icon: "add" }, // Day 9. Swap the icon if Icons.tsx has a better one${eol}`;
  let out = t.slice(0, after.index + after[0].length) + item + t.slice(after.index + after[0].length);
  out = out.replace(/(const PHONE = \[[^\]]*?)("\/settings")(\s*\])/, (m, a, b, c) => `${a}"/rewards", ${b}${c}`);
  // the phone bar now has seven tabs
  out = out.replace(/grid grid-cols-\d+/, "grid grid-cols-7");
  out = out.replace("text-[11px] font-medium", "text-[10px] font-medium");
  return { status: "done", text: out };
});

console.log("");
if (needsManual > 0) {
  console.log(`${needsManual} step(s) need a manual edit. The lines above marked MANUAL say exactly what to change.`);
  process.exit(1);
}
console.log("All set. Restart the backend (type rs in the nodemon window) and the frontend (npm run dev).");
console.log("Backups of every changed file are in .day9-backup/");
