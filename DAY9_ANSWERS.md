# Day 9 Answers: Festive Cashback Scratch Cards

Write each answer in your own words. You must be able to explain them out loud, without notes.
Hints point at the guide section to re-read. They are not answers.

## 1. Why can't cashback just be `$inc` on the user's wallet? Where does the money come from in your design?
Hint: A1. Think about what Day 3's reconcile checks.

Your answer:

## 2. How does reconcile stay correct with cashback, without changing the reconcile code?
Hint: A1, the promo wallet is "a normal wallet". What happens to the total when money only moves?

Your answer:

## 3. Show the race that overspends a budget when you read `budgetLeft` first. How does your claim stop it?
Hint: A2, the "200 bookings" example. Look at the filter in the `Offer.findOneAndUpdate` inside `claimCard`.

Your answer:

## 4. Why is the card created inside the payment's transaction? What goes wrong if it is created after the payment, outside it?
Hint: A3, and Part F: "A card exists for a payment that failed".

Your answer:

## 5. Your idempotency key already stops double payments. Why also put a unique index on the card's `transactionId`?
Hint: A3, "two locks again, like Day 7".

Your answer:

## 6. Why must the server decide the reward amount, and when does it decide?
Hint: A4. What can someone do in Postman, and what does the app send when it claims?

Your answer:

## 7. Why do we round cashback down? Work out 5% of ₹137.05 in paise.
Hint: A4. Start from 13705 paise and use `Math.floor`.

Your answer:

## 8. When the budget is empty, why does the claim commit and return 200 instead of throwing an error?
Hint: A5, the orange box "Not every no is an error". What happens to the card if the transaction rolls back?

Your answer:

## 9. Reserve the budget when the card is created, or check it when the card is claimed? Give one advantage of each.
Hint: A6, the table. Which one did you build, and what state does it need?

Your answer:

## 10. Describe the ping pong trick. How does your rule stop it, and what honest payment might it block by mistake?
Hint: A7, "No ping pong". Look at the `Transaction.exists` query in `maybeIssueCard`.

Your answer:

## 11. Why is "3 cards a day" an atomic counter, when Day 7's "5 pending requests" was a simple count?
Hint: A7, and what the worst case is if two payments slip through at the same moment. Compare with Day 7, Q11.

Your answer:

## 12. What does `budget - budgetLeft = totalPaid` prove? What would you do if `check` were false in production?
Hint: A8, and Day 8's statement check.

Your answer:

## Bonus 7: random rewards
If the average reward should be ₹10 and you pick amounts from ₹1 to ₹50 with `crypto.randomInt`, how should you choose them?
Why `crypto.randomInt` and never `Math.random`?

Your answer:

## Bonus 8: stopping an offer early
What should happen to unclaimed cards, and to the money left in the promo wallet? Why?

Your answer:
