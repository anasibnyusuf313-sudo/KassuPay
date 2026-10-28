"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, errorMessage, getToken } from "@/lib/api";
import type { BalanceResponse, HistoryResponse, MeResponse } from "@/lib/types";
import { secondaryBtnClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import Logo from "@/components/logo";
import BalanceCard from "@/components/BalanceCard";
import SendMoneyForm from "@/components/SendMoneyForm";
import HistoryTable from "@/components/HistoryTable";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState<number | null>(null); // in paise
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");

  const loadBalance = useCallback(async () => {
    const data = await api<BalanceResponse>("/wallet/balance", { auth: true });
    setBalance(data.balance);
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    const data = await api<HistoryResponse>(`/wallet/transactions?page=${page}&limit=10`, { auth: true });
    setHistory(data);
  }, []);

  useEffect(() => {
    // not signed in? go back to the sign in page
    if (!getToken()) {
      router.replace("/");
      return;
    }

    api<MeResponse>("/user/me", { auth: true })
      .then((data) => setName(`${data.user.firstName} ${data.user.lastName}`))
      .catch(() => {});
    loadBalance().catch((err) => setError(errorMessage(err)));
    loadHistory(1).catch((err) => setError(errorMessage(err)));
  }, [router, loadBalance, loadHistory]);

  function refreshAll() {
    setError("");
    loadBalance().catch((err) => setError(errorMessage(err)));
    loadHistory(history ? history.page : 1).catch((err) => setError(errorMessage(err)));
  }

  function handleSent(newBalance: number) {
    setBalance(newBalance); // the transfer reply carries the new balance
    loadHistory(1).catch(() => {});
  }

  function logout() {
    clearToken();
    router.replace("/");
  }

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-gray-700 sm:block">{name}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
              {initials}
            </div>
            <button type="button" className={secondaryBtnClass} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Hi, {name.split(" ")[0] || "there"} 👋</h2>

        {error && (
          <div className="mb-4">
            <Alert text={error} kind="error" />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-2">
            <BalanceCard balance={balance} onRefresh={refreshAll} />
               <div className="flex flex-wrap gap-2">
              <Link href="/add-money" className={secondaryBtnClass}>Add money</Link>
              <Link href="/withdraw" className={secondaryBtnClass}>Withdraw</Link>
              <Link href="/bank-accounts" className={secondaryBtnClass}>Bank accounts</Link>
            </div>
            <SendMoneyForm onSent={handleSent} />
          </div>
          <div className="lg:col-span-3">
            <HistoryTable
              history={history}
              onPage={(page) => loadHistory(page).catch((err) => setError(errorMessage(err)))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}