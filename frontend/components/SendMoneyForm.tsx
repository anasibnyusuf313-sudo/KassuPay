"use client";

import { FormEvent, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { TransferResponse } from "@/lib/types";
import { btnClass, cardClass, inputBase, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = { onSent: (newBalance: number) => void };

const QUICK_AMOUNTS = [100, 500, 1000];

export default function SendMoneyForm({ onSent }: Props) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(""); // in rupees, as typed
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [sending, setSending] = useState(false);

  // One Idempotency-Key per payment. If the network fails and the user taps Send
  // again with the SAME details, we reuse the key, so money can never move twice.
  const pending = useRef<{ signature: string; key: string | null }>({ signature: "", key: null });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const paise = Math.round(Number(amount) * 100); // rupees -> paise
    const signature = `${to.trim()}|${paise}|${note.trim()}`;
    if (signature !== pending.current.signature) {
      pending.current = { signature, key: crypto.randomUUID() };
    }

    setSending(true);
    setMessage({ text: "Sending...", kind: "info" });

    try {
      const data = await api<TransferResponse>("/wallet/transfer", {
        method: "POST",
        auth: true,
        headers: { "Idempotency-Key": pending.current.key ?? "" },
        body: { to: to.trim(), amount: paise, note: note.trim() },
      });
      pending.current = { signature: "", key: null };
      setMessage({ text: `Sent ${rupees(paise)} to ${to.trim()}`, kind: "success" });
      setTo("");
      setAmount("");
      setNote("");
      onSent(data.balance);
    } catch (err) {
      // A clear refusal (400, 404, 422) is final, so the next try gets a new key.
      // If we are not sure what happened (no answer, 409, 500), keep the key.
      const status = err instanceof ApiError ? err.status : undefined;
      const network = err instanceof ApiError && err.network;
      const sure = status !== undefined && status >= 400 && status < 500 && status !== 409;
      if (sure) pending.current = { signature: "", key: null };

      setMessage({
        text: network ? errorMessage(err) + " Tap Send again. It is safe: the same key is reused." : errorMessage(err),
        kind: "error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Send money</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Send to (email)
          <input className={inputClass} type="email" placeholder="friend@example.com" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>

        <div>
          <label className={labelClass} htmlFor="amount">
            Amount
          </label>
          <div className="mt-1.5 flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">₹</span>
            <input
              id="amount"
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
          <input className={inputClass} type="text" maxLength={50} placeholder="Lunch, rent, chai..." value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button type="submit" className={btnClass} disabled={sending}>
          {sending && <Spinner />}
          {sending ? "Sending..." : "Send money"}
        </button>
      </form>

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}