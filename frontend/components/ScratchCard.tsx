"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { ClaimResponse, RewardCard } from "@/lib/rewardTypes";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = {
  card: RewardCard;
  onChanged: () => void; // reload the list
  onBalance: (paise: number) => void; // update the balance shown in the app
};

function expiryText(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `Scratch within ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `Scratch within ${hours} hour${hours === 1 ? "" : "s"}`;
}

export default function ScratchCard({ card, onChanged, onBalance }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justScratched, setJustScratched] = useState(false);

  async function scratch() {
    setBusy(true);
    setError("");
    try {
      // The app only says "claim this card". The server already knows what it is worth.
      const data = await api<ClaimResponse>(`/rewards/${card.id}/claim`, { method: "POST", auth: true });
      setJustScratched(true);
      if (typeof data.balance === "number") onBalance(data.balance);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
      onChanged(); // the card may have expired or been used: show its real state
    } finally {
      setBusy(false);
    }
  }

  const unclaimed = card.status === "UNCLAIMED";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* the card face */}
      <div
        className={
          "relative flex h-32 items-center justify-center px-4 text-center transition-all duration-500 " +
          (unclaimed
            ? "bg-linear-to-br from-teal-600 via-emerald-500 to-amber-400 text-white"
            : card.status === "CLAIMED"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-100 text-slate-500") +
          (justScratched ? " scale-[1.02]" : "")
        }
      >
        {unclaimed ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{card.offerTitle}</p>
            <p className="mt-1 text-lg font-semibold">Scratch to win</p>
          </div>
        ) : card.status === "CLAIMED" ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">You won</p>
            <p className="mt-1 text-3xl font-semibold">{rupees(card.amount ?? 0)}</p>
          </div>
        ) : card.status === "EXHAUSTED" ? (
          <div>
            <p className="text-lg font-semibold">Better luck next time</p>
            <p className="mt-1 text-xs">The cashback budget ran out.</p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold">Expired</p>
            <p className="mt-1 text-xs">This card was not scratched in time.</p>
          </div>
        )}
      </div>

      {/* the card footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{card.offerTitle}</p>
          <p className="text-xs text-slate-400">
            {unclaimed ? expiryText(card.expiresAt) : new Date(card.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        {unclaimed && (
          <button
            type="button"
            onClick={scratch}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Spinner />}
            {busy ? "Scratching..." : "Scratch"}
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <Alert text={error} kind="error" />
        </div>
      )}
    </div>
  );
}
