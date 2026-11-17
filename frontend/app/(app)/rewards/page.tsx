"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { RewardCard, RewardsResponse } from "@/lib/rewardTypes";
import { cardClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import ScratchCard from "@/components/ScratchCard";

export default function RewardsPage() {
  const { setBalance } = useSession();
  const [cards, setCards] = useState<RewardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<RewardsResponse>("/rewards", { auth: true });
      setCards(data.cards);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = cards.filter((c) => c.status === "UNCLAIMED").length;
  const totalWon = cards.reduce((sum, c) => sum + (c.status === "CLAIMED" ? (c.amount ?? 0) : 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My rewards</h1>
        <p className="text-sm text-slate-500">
          Festive cashback: pay a friend during the offer and earn a scratch card.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cardClass + " !p-4"}>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total cashback won</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{rupees(totalWon)}</p>
        </div>
        <div className={cardClass + " !p-4"}>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Cards to scratch</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{waiting}</p>
        </div>
      </div>

      <Alert text={error} kind="error" />

      {loading ? (
        <div className={cardClass + " text-sm text-slate-500"}>Loading...</div>
      ) : cards.length === 0 ? (
        <div className={cardClass + " text-sm text-slate-500"}>
          No scratch cards yet. While an offer is running, a payment of ₹100 or more to a friend earns one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <ScratchCard key={c.id} card={c} onChanged={load} onBalance={setBalance} />
          ))}
        </div>
      )}

      <div className={cardClass + " !p-4"}>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">How scratch cards work</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
          <li>A payment of ₹100 or more can earn you a card, while an offer is running and its budget lasts.</li>
          <li>You can earn up to 3 cards a day.</li>
          <li>No card if the person you paid sent you money in the last 24 hours.</li>
          <li>Scratch within 7 days. After that the card expires.</li>
          <li>If the offer budget runs out before you scratch, the card says "Better luck next time".</li>
        </ul>
      </div>
    </div>
  );
}
