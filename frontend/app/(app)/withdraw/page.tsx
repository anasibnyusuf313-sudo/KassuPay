"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type {
  BankAccount,
  WithdrawResponse,
  Withdrawal,
  WithdrawalsResponse,
} from "@/lib/types";
import { btnClass, cardClass, inputBase, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import { useSession } from "@/lib/session";
import Alert, { type AlertKind } from "@/components/Alert";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import StatusBadge from "@/components/StatusBadge";

const QUICK_AMOUNTS = [500, 1000, 5000];

function toList(data: WithdrawalsResponse): Withdrawal[] {
  if (Array.isArray(data)) return data;
  return data.withdrawals ?? data.data ?? [];
}

export default function WithdrawPage() {
  const { balance, hasPin, setBalance, reloadBalance } = useSession();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState(""); // in rupees, as typed
  const [pin, setPin] = useState("");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);

  // One Idempotency-Key per withdrawal. Tapping twice never withdraws twice.
  const pending = useRef<{ signature: string; key: string | null }>({ signature: "", key: null });

  const loadWithdrawals = useCallback(async () => {
    try {
      const data = await api<WithdrawalsResponse>("/wallet/withdrawals", { auth: true });
      setWithdrawals(toList(data));
    } catch {
      setWithdrawals([]);
    }
  }, []);

  useEffect(() => {
    // the backend returns a plain array of accounts
    api<BankAccount[]>("/wallet/bank-accounts", { auth: true })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAccounts(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch(() => setAccounts([]));
    loadWithdrawals();
  }, [loadWithdrawals]);

  // while a withdrawal is on its way, check again every 5 seconds
  const inFlight = (withdrawals ?? []).some((w) => w.status === "PENDING" || w.status === "PROCESSING");
  useEffect(() => {
    if (!inFlight) return;
    const id = setInterval(() => {
      loadWithdrawals();
      reloadBalance(); // a failed payout refunds the wallet
    }, 5000);
    return () => clearInterval(id);
  }, [inFlight, loadWithdrawals, reloadBalance]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const paise = Math.round(Number(amount) * 100); // rupees -> paise
    const signature = `${selected}|${paise}`;
    if (signature !== pending.current.signature) {
      pending.current = { signature, key: crypto.randomUUID() };
    }

    setBusy(true);
    setMessage({ text: "Requesting your withdrawal...", kind: "info" });

    try {
      const data = await api<WithdrawResponse>("/wallet/withdrawals", {
        method: "POST",
        auth: true,
        headers: { "Idempotency-Key": pending.current.key ?? "" },
        body: { bankAccountId: selected, amount: paise, pin },
      });
      pending.current = { signature: "", key: null };
      setBalance(data.balance);
      setAmount("");
      setMessage({
        text: `Withdrawal of ${rupees(paise)} requested to ${data.withdrawal.account}. It may take a moment.`,
        kind: "success",
      });
      loadWithdrawals();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const network = err instanceof ApiError && err.network;
      const sure = status !== undefined && status >= 400 && status < 500 && status !== 409;
      if (sure) pending.current = { signature: "", key: null };
      setMessage({
        text: network ? errorMessage(err) + " Tap again. It is safe: the same key is reused." : errorMessage(err),
        kind: "error",
      });
    } finally {
      setPin(""); // never keep a PIN on screen
      setBusy(false);
    }
  }

  const noPin = hasPin === false;
  const noBank = accounts !== null && accounts.length === 0;

  return (
    <>
      <PageHeader
        title="Withdraw to bank"
        subtitle={`Available: ${balance === null ? "..." : rupees(balance)} · ₹100 to ₹25,000 per withdrawal`}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <section className={cardClass + " lg:col-span-3"}>
          {noBank ? (
            <div className="py-8 text-center">
              <p className="mb-1 text-2xl">🏦</p>
              <p className="mb-4 text-sm text-gray-500">Add a bank account first.</p>
              <Link href="/banks" className={btnClass + " w-auto"}>
                Add bank account
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {noPin && (
                <Alert text="Set your payment PIN in Account before you can withdraw." kind="info" />
              )}

              <fieldset>
                <legend className={labelClass}>To bank account</legend>
                <div className="mt-1.5 space-y-2">
                  {(accounts ?? []).map((a) => (
                    <label
                      key={a.id}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm " +
                        (selected === a.id ? "border-teal-600 bg-teal-50" : "border-gray-200")
                      }
                    >
                      <input type="radio" name="bank" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900">{a.accountHolderName}</span>
                        <span className="block text-xs text-gray-500">
                          •••• {a.last4} · {a.ifsc}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <Link href="/banks" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">
                  + Add another account
                </Link>
              </fieldset>

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
                    min="100"
                    max="25000"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    disabled={noPin}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((v) => (
                    <button key={v} type="button" className={secondaryBtnClass} onClick={() => setAmount(String(v))} disabled={noPin}>
                      ₹{v}
                    </button>
                  ))}
                </div>
              </div>

              <label className={labelClass}>
                Payment PIN
                <input
                  className={inputClass + " tracking-[0.5em]"}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  disabled={noPin}
                />
              </label>

              <button type="submit" className={btnClass} disabled={busy || noPin || !selected}>
                {busy && <Spinner />}
                {busy ? "Please wait..." : "Withdraw"}
              </button>
            </form>
          )}

          <div className="mt-3">
            <Alert text={message.text} kind={message.kind} />
          </div>
        </section>

        <section className={cardClass + " lg:col-span-2"}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your withdrawals</h2>
            <button type="button" className="text-sm font-medium text-teal-700 hover:underline" onClick={() => { loadWithdrawals(); reloadBalance(); }}>
              Refresh
            </button>
          </div>

          {withdrawals === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No withdrawals yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {withdrawals.map((w) => (
                <li key={w.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{rupees(w.amount)}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(w.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {w.status === "REVERSED" && w.failureReason ? " · " + w.failureReason : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}