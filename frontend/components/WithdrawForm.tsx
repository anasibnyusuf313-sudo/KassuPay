"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { BankAccount, WithdrawResponse } from "@/lib/types";
import { btnClass, cardClass, inputBase, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = {
  accounts: BankAccount[];
  balance: number | null; // in paise
  onWithdrawn: () => void;
};

const QUICK_AMOUNTS = [100, 500, 1000];

export default function WithdrawForm({ accounts, balance, onWithdrawn }: Props) {
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState(""); // in rupees, as typed
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [sending, setSending] = useState(false);

  // use the chosen account, or the first one if nothing is chosen yet
  const selected = accounts.find((a) => a.id === bankId) ?? accounts[0];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;

    const paise = Math.round(Number(amount) * 100); // rupees -> paise
    if (balance !== null && paise > balance) {
      setMessage({ text: "Insufficient balance", kind: "error" });
      return;
    }

    setSending(true);
    setMessage({ text: "Withdrawing...", kind: "info" });

    try {
      await api<WithdrawResponse>("/withdraw", {
        method: "POST",
        auth: true,
        body: { bankAccountId: selected.id, amount: paise },
      });
      setMessage({ text: `Withdrew ${rupees(paise)} to bank account •••• ${selected.last4}`, kind: "success" });
      setAmount("");
      onWithdrawn();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setSending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <section className={cardClass}>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Withdraw money</h2>
        <p className="mb-4 text-sm text-gray-500">Add a bank account first, then you can withdraw.</p>
        <Link href="/bank-accounts" className={btnClass}>
          Add bank account
        </Link>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Withdraw money</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          To bank account
          <select className={inputClass} value={selected.id} onChange={(e) => setBankId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountHolderName} •••• {a.last4}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label className={labelClass} htmlFor="withdraw-amount">
            Amount
          </label>
          <div className="mt-1.5 flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">₹</span>
            <input
              id="withdraw-amount"
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

        <button type="submit" className={btnClass} disabled={sending}>
          {sending && <Spinner />}
          {sending ? "Withdrawing..." : "Withdraw"}
        </button>
      </form>

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}
