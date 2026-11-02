"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import Alert from "@/components/Alert";
import BalanceCard from "@/components/BalanceCard";
import PageHeader from "@/components/PageHeader";
import RecentActivity from "@/components/RecentActivity";

export default function HomePage() {
  const { firstName, balance, reloadBalance, hasPin, error } = useSession();

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName || "there"}`}
        subtitle="Here is what is happening with your wallet."
      />

      {error && (
        <div className="mb-4">
          <Alert text={error} kind="error" />
        </div>
      )}

      {hasPin === false && (
        <Link
          href="/settings"
          className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100"
        >
          <span>Set a payment PIN to start sending money.</span>
          <span className="font-semibold">Set PIN →</span>
        </Link>
      )}

      <BalanceCard balance={balance} onRefresh={reloadBalance} />

      <div className="mt-6">
        <RecentActivity />
      </div>
    </>
  );
}