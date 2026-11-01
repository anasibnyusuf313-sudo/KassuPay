"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HistoryResponse } from "@/lib/types";
import { cardClass } from "@/lib/ui";
import TransactionRow from "@/components/TransactionRow";

export default function RecentActivity() {
  const [data, setData] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    api<HistoryResponse>("/wallet/transactions?page=1&limit=5", { auth: true })
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <section className={cardClass}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
        <Link href="/history" className="text-sm font-medium text-teal-700 hover:underline">
          View all
        </Link>
      </div>

      {!data ? (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : data.data.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <p className="mb-1 text-2xl">🪙</p>
          No transactions yet
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.data.map((t) => (
            <TransactionRow key={`${t.transactionId}-${t.direction}`} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}