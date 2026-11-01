"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { HistoryResponse } from "@/lib/types";
import Alert from "@/components/Alert";
import HistoryTable from "@/components/HistoryTable";
import PageHeader from "@/components/PageHeader";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (page: number) => {
    try {
      const data = await api<HistoryResponse>(`/wallet/transactions?page=${page}&limit=10`, { auth: true });
      setHistory(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <>
      <PageHeader title="History" subtitle="Every rupee that came in or went out, newest first." />
      {error && (
        <div className="mb-4">
          <Alert text={error} kind="error" />
        </div>
      )}
      <HistoryTable history={history} onPage={load} />
    </>
  );
}