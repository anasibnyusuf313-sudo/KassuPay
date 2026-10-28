"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage, getToken } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { BalanceResponse, BankAccount } from "@/lib/types";
import { cardClass, secondaryBtnClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import Logo from "@/components/logo";
import WithdrawForm from "@/components/WithdrawForm";

export default function WithdrawPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null); // in paise
  const [error, setError] = useState("");

  const loadBalance = useCallback(async () => {
    const data = await api<BalanceResponse>("/wallet/balance", { auth: true });
    setBalance(data.balance);
  }, []);

  useEffect(() => {
    // not signed in? go back to the sign in page
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api<BankAccount[]>("/bank", { auth: true })
      .then(setAccounts)
      .catch((err) => setError(errorMessage(err)));
    loadBalance().catch((err) => setError(errorMessage(err)));
  }, [router, loadBalance]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo />
          <Link href="/dashboard" className={secondaryBtnClass}>
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <h2 className="text-2xl font-semibold text-gray-900">Withdraw</h2>

        {error && <Alert text={error} kind="error" />}

        <section className={cardClass}>
          <p className="text-sm text-gray-500">Available balance</p>
          <p className="text-3xl font-semibold text-gray-900">{balance === null ? "..." : rupees(balance)}</p>
        </section>

        {accounts === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <WithdrawForm
            accounts={accounts}
            balance={balance}
            onWithdrawn={() => loadBalance().catch((err) => setError(errorMessage(err)))}
          />
        )}
      </main>
    </div>
  );
}
