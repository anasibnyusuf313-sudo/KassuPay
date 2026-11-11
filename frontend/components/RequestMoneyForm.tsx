"use client";

import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { CreateRequestResponse, LookupResponse } from "@/lib/types";
import { btnClass, cardClass, inputBase, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = {
  onCreated: () => void;
};

const QUICK_AMOUNTS = [100, 500, 1000];

export default function RequestMoneyForm({ onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(""); // in rupees, as typed
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const paise = Math.round(Number(amount) * 100); // rupees -> paise
    if (!Number.isFinite(paise) || paise < 100 || paise > 1000000) {
      setMessage({ text: "Amount must be between ₹1 and ₹10,000", kind: "error" });
      return;
    }

    setBusy(true);
    setMessage({ text: "Sending request...", kind: "info" });
    try {
      // 1. the form takes an email, the backend wants an id: look the person up first
      const found = await api<LookupResponse>("/requests/lookup?email=" + encodeURIComponent(email.trim()), {
        auth: true,
      });

      // 2. create the request
      await api<CreateRequestResponse>("/requests", {
        method: "POST",
        auth: true,
        body: { to: found.user.id, amount: paise, note: note.trim() },
      });

      setMessage({ text: `Asked ${found.user.name} for ${rupees(paise)}`, kind: "success" });
      setEmail("");
      setAmount("");
      setNote("");
      onCreated();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Request money</h2>
      <p className="mb-4 text-sm text-gray-500">
        They will see it in their Incoming list and can pay or decline. Nothing moves until they pay.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Request from (email)
          <input
            className={inputClass}
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <div>
          <label className={labelClass} htmlFor="request-amount">
            Amount
          </label>
          <div className="mt-1.5 flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
              ₹
            </span>
            <input
              id="request-amount"
              className={inputBase + " rounded-l-none"}
              type="number"
              min="1"
              max="10000"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="mt-2 flex gap-2">
            {QUICK_AMOUNTS.map((v) => (
              <button key={v} type="button" className={secondaryBtnClass} onClick={() => setAmount(String(v))}>
                ₹{v}
              </button>
            ))}
          </div>
        </div>

        <label className={labelClass}>
          Note <span className="font-normal text-gray-400">(optional)</span>
          <input
            className={inputClass}
            type="text"
            maxLength={100}
            placeholder="Dinner, rent share, tickets..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button type="submit" className={btnClass} disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Sending..." : "Send request"}
        </button>
      </form>

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}
