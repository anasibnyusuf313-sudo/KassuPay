"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { BankAccount, BankAccountsResponse } from "@/lib/types";
import { btnClass, cardClass, inputClass, labelClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Icon from "@/components/Icons";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";

export default function BanksPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({ accountHolderName: "", accountNumber: "", ifsc: "" });
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<BankAccount[]>("/wallet/bank-accounts", { auth: true });
        setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setAccounts([]);
      setMessage({ text: errorMessage(err), kind: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    let next = value;
    if (name === "accountNumber") next = value.replace(/\D/g, "").slice(0, 18); // digits only
    if (name === "ifsc") next = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    setForm({ ...form, [name]: next });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage({ text: "Saving...", kind: "info" });
    try {
      await api("/wallet/bank-accounts", {
        method: "POST",
        auth: true,
        body: {
          accountHolderName: form.accountHolderName.trim(),
          accountNumber: form.accountNumber,
          ifsc: form.ifsc,
        },
      });
      setForm({ accountHolderName: "", accountNumber: "", ifsc: "" });
      setMessage({ text: "Bank account added", kind: "success" });
      await load();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Bank accounts" subtitle="Add the accounts you want to withdraw money to." />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Add a bank account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className={labelClass}>
              Account holder name
              <input className={inputClass} name="accountHolderName" value={form.accountHolderName} onChange={update} minLength={2} maxLength={60} required />
            </label>
            <label className={labelClass}>
              Account number
              <input className={inputClass} name="accountNumber" inputMode="numeric" placeholder="9 to 18 digits" value={form.accountNumber} onChange={update} required />
            </label>
            <label className={labelClass}>
              IFSC code
              <input className={inputClass} name="ifsc" placeholder="SBIN0001234" value={form.ifsc} onChange={update} required />
            </label>
            <button type="submit" className={btnClass} disabled={busy}>
              {busy && <Spinner />}
              Add account
            </button>
          </form>
          <div className="mt-3">
            <Alert text={message.text} kind={message.kind} />
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Your accounts</h2>

          {accounts === null ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              <p className="mb-1 text-2xl">🏦</p>
              No bank accounts yet. Add one on the left.
            </div>
          ) : (
            <ul className="space-y-3">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                    <Icon name="bank" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{a.accountHolderName}</p>
                    <p className="text-xs text-gray-500">
                      {a.last4} · {a.ifsc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {accounts && accounts.length > 0 && (
            <Link href="/withdraw" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline">
              Withdraw to a bank account →
            </Link>
          )}
        </section>
      </div>
    </>
  );
}