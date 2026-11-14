// Gives a user lots of history using your real staff deposit route, so every ledger row
// and every balance stays correct.
// Usage:  node tools/seed-history.js meena@example.com 45
//         API=https://YOUR-BACKEND.vercel.app/api/v1 node tools/seed-history.js meena@example.com 5000
// Deposits are Rs 1, Rs 2, Rs 3 ... (the deposit route takes the EMAIL in "to")
require("dotenv").config();

const API = process.env.API || "http://localhost:3000/api/v1";
const [email, count = "45"] = process.argv.slice(2);

if (!email || !process.env.ADMIN_KEY) {
  console.log("Usage: node tools/seed-history.js USER_EMAIL COUNT   (ADMIN_KEY must be in .env)");
  process.exit(1);
}

(async () => {
  const total = Number(count);
  for (let i = 1; i <= total; i++) {
    const res = await fetch(`${API}/admin/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": process.env.ADMIN_KEY },
      body: JSON.stringify({ to: email, amount: i * 100 }), // paise: Rs 1, Rs 2, Rs 3 ...
    });
    if (!res.ok) {
      console.log("Failed at", i, await res.text());
      process.exit(1);
    }
    if (i % 100 === 0) console.log("...", i);
  }
  console.log("Added", total, "deposits to", email);
})();
