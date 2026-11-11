"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { MoneyRequest, RequestsResponse } from "@/lib/types";
import { cardClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import RequestCard from "@/components/RequestCard";
import RequestMoneyForm from "@/components/RequestMoneyForm";

type Tab = "INCOMING" | "OUTGOING";

export default function RequestsPage() {
  const { hasPin, setBalance } = useSession();
  const [tab, setTab] = useState<Tab>("INCOMING");
  const [incoming, setIncoming] = useState<MoneyRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([
        api<RequestsResponse>("/requests/incoming", { auth: true }),
        api<RequestsResponse>("/requests/outgoing", { auth: true }),
      ]);
      setIncoming(inc.requests);
      setOutgoing(out.requests);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = incoming.filter((r) => r.status === "PENDING").length;
  const list = tab === "INCOMING" ? incoming : outgoing;

  const tabClass = (t: Tab) =>
    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition " +
    (tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Requests</h1>
        <p className="text-sm text-slate-500">Ask someone for money, or pay a request sent to you.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestMoneyForm
          onCreated={() => {
            setTab("OUTGOING");
            load();
          }}
        />

        <div className="space-y-3">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button type="button" className={tabClass("INCOMING")} onClick={() => setTab("INCOMING")}>
              Incoming
              {waiting > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {waiting}
                </span>
              )}
            </button>
            <button type="button" className={tabClass("OUTGOING")} onClick={() => setTab("OUTGOING")}>
              Sent
            </button>
          </div>

          <Alert text={error} kind="error" />

          {loading ? (
            <div className={cardClass + " text-sm text-slate-500"}>Loading...</div>
          ) : list.length === 0 ? (
            <div className={cardClass + " text-sm text-slate-500"}>
              {tab === "INCOMING" ? "No one has asked you for money." : "You have not asked anyone for money yet."}
            </div>
          ) : (
            list.map((r) => (
              <RequestCard key={r.id} request={r} hasPin={hasPin} onChanged={load} onPaid={setBalance} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
