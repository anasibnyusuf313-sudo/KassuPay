"use client";

import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { BankAccount } from "@/lib/types";
import { btnClass, cardClass, inputClass, labelClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = { onAdded: (account: BankAccount) => void };

export default function BankAccountForm({ onAdded }: Props) {
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "Saving...", kind: "info" });

    try {
      const account = await api<BankAccount>("/bank", {
        method: "POST",
        auth: true,
        body: {
          accountHolderName: name.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
        },
      });
      setMessage({ text: "Bank account added", kind: "success" });
      setName("");
      setAccountNumber("");
      setIfsc("");
      onAdded(account);
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Add bank account</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Account holder name
          <input
            className={inputClass}
            type="text"
            maxLength={60}
            placeholder="Name as in your bank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className={labelClass}>
          Account number
          <input
            className={inputClass}
            type="text"
            inputMode="numeric"
            maxLength={18}
            placeholder="9 to 18 digits"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
            required
          />
        </label>

        <label className={labelClass}>
          IFSC code
          <input
            className={inputClass}
            type="text"
            maxLength={11}
            placeholder="SBIN0001234"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            required
          />
        </label>

        <button type="submit" className={btnClass} disabled={saving}>
          {saving && <Spinner />}
          {saving ? "Saving..." : "Add bank account"}
        </button>
      </form>

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}
