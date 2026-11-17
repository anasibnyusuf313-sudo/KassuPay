// Types for the cashback scratch cards (Day 9).
// Kept in their own file so your lib/types.ts does not need to change.

export type CardStatus = "UNCLAIMED" | "CLAIMED" | "EXHAUSTED" | "EXPIRED";

export type RewardCard = {
  id: string;
  offer: string; // the offer code, like FESTIVE
  offerTitle: string; // what people see: "Festive cashback"
  amount: number | null; // paise. null until the card is scratched
  status: CardStatus;
  expiresAt: string;
  createdAt: string;
};

export type RewardsResponse = { cards: RewardCard[] };

// won: { message, amount, balance }   budget gone: { message, amount: 0 }
export type ClaimResponse = { message: string; amount: number; balance?: number };
