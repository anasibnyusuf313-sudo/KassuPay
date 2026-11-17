# Day 9: Festive cashback scratch cards

The offer in your guide is called **DIWALI**. Here it is the **Festive cashback** offer, code **`FESTIVE`**.
Wherever the guide says `DIWALI`, use `FESTIVE`. The app shows "Festive cashback".

## Install (3 steps)

1. Unzip `day9.zip` into your **project root**, the folder that contains `backend/` and `frontend/`
   (`kaasupay-tickets`). Say yes if it asks to merge folders. It only adds new files.
2. In that folder run:
   ```
   node apply-day9.js
   ```
   This makes the few small edits that existing files need (see below). It backs up every file it
   changes into `.day9-backup/`, and it is safe to run twice.
3. Restart: type `rs` in the nodemon window, and restart `npm run dev` for the frontend.

Then: `git checkout -b day-9`, test, push to `main`.

## What is in the zip

```
apply-day9.js                         one-time setup script
DAY9_README.md                        this file
DAY9_ANSWERS.md                       the 12 interview questions, for you to answer
backend/
  models/Offer.js                     NEW  offer = rules + budget
  models/RewardCard.js                NEW  the scratch card (unique index on transactionId)
  models/RewardCount.js               NEW  cards earned per person per India day
  services/rewardService.js           NEW  promo wallet, offers, issue card, claim, report
  routes/offersAdmin.js               NEW  POST /admin/offers, GET /admin/offers/:code
  routes/rewardsRoutes.js             NEW  GET /rewards, POST /rewards/:id/claim
frontend/
  lib/rewardTypes.ts                  NEW
  components/ScratchCard.tsx          NEW
  app/(app)/rewards/page.tsx          NEW  "My rewards" page
```

## What `apply-day9.js` changes in your existing files

| File | Change |
| --- | --- |
| `backend/db.js` | adds `"CASHBACK"` to the Transaction `type` list |
| `backend/routes/index.js` | mounts `/admin/offers` (above `/admin`) and `/rewards` |
| `backend/services/money.js` | `transferInSession` calls `maybeIssueCard` after the money moves, inside the same transaction. Transfers and request payments both go through it, so both earn cards |
| `backend/routes/wallet.js` | history shows CASHBACK lines as "Cashback" (if your Day 8 history looks different it tells you) |
| `frontend/components/AppShell.tsx` | adds a Rewards link; the phone bar now has 7 tabs |

### If the script says MANUAL

It prints the exact edit. They are all one line:

- **db.js:** `enum: ["DEPOSIT", "TRANSFER", "TOPUP", "WITHDRAW", "CASHBACK"]`
- **routes/index.js:** add the two requires, and put these **above** `router.use("/admin", adminRouter);`
  ```js
  router.use("/admin/offers", offersAdminRouter);
  router.use("/rewards", rewardsRouter);
  ```
- **money.js:** at the end of `transferInSession`, just before its final `return {`:
  ```js
  await maybeIssueCard({ session, payerId: fromUserId, receiverId: toUser._id, amount, transactionId: txn._id });
  ```
  and at the top: `const { maybeIssueCard } = require("./rewardService");`
- **History label:** wherever your history code sets the name for each line, a `CASHBACK` line should say `"Cashback"`.
  The same goes for your Day 8 CSV export and statements if they print a label per type.

## How to test (the guide's D1 to D7, with FESTIVE)

Use the same users: Arun (PIN 2468, ₹10,000), Bala (1357), Chitra (9024).

| Test | Do | Expect |
| --- | --- | --- |
| D1 | `POST /admin/offers` with `{"code":"FESTIVE","percent":5,"maxCashback":5000,"minPayment":10000,"budget":10000,"days":7}` and your staff key | 201. Same again: 409. `"percent":80`: 400. Reconcile: `moneyIsConserved: true` |
| D2 | Arun sends Bala ₹50, then ₹200. `GET /rewards` | no card for ₹50, one card for ₹200 with `amount: null` |
| D3 | Arun sends ₹1,000, ₹2,000, then ₹300 | cards worth ₹50 and ₹50 (capped). No card for ₹300 (3 a day) |
| D4 | Arun scratches the cards, oldest first | ₹10 (balance 646000), again: 409, Bala on it: 404, ₹50 (651000), third: "Better luck next time", again: 409 |
| D5 | Bala sends Arun ₹500. Chitra (₹1,000 deposit) sends Bala ₹500 | no card for Bala (Arun paid him today). Chitra gets a ₹25 card |
| D6 | In Atlas, set Chitra's card `expiresAt` to yesterday. She scratches it | 410. `GET /rewards` shows `EXPIRED` |
| D7 | `GET /admin/offers/FESTIVE` with your staff key | `budgetLeft:4000, cardsIssued:4, claimed:2, exhausted:1, expired:1, totalPaid:6000, check:true`. Reconcile still `true` |

Then open **Rewards** in the app as Arun and scratch a card there.

Bonus 6 (budget race on Atlas): make an offer with budget ₹30, ten users with ₹10 cards, claim all ten with `Promise.all`.
Exactly 3 should win and `budgetLeft` must end at 0.

## Choices made (good for your interview answers)

- **Errors use `{ "error": ... }`**, like your other routes, not `{ "message": ... }` as the guide's examples show.
  Success replies use `message`.
- **The budget is checked when the card is scratched** (A6), not reserved when it is created. That is why EXHAUSTED exists.
- **The promo wallet** belongs to a user `rewards@kaasupay.system` with a random password hash, created the first time an offer is made.
- **Claiming does not ask for a PIN.** It is money coming in from the company, not the user sending money.
- **`title`** is an optional extra field on an offer (default "Festive cashback"). The app shows it on every card.

## Optional hardening

Someone could sign up with `rewards@kaasupay.system` before the first offer is created. In your signup route in
`routes/user.js`, reject any email ending in `@kaasupay.system`:

```js
if (username.endsWith("@kaasupay.system")) {
  return res.status(400).json({ error: "This email cannot be used" });
}
```

## Not tested

I could not run MongoDB where I built this, so the database parts (transactions, unique indexes, the budget race) are
unproven until you run D1 to D7 and Bonus 6 on your machine. I did replay D1 to D7 against an in-memory stand-in and the
numbers match the guide.
