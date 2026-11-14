"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { HistoryPage, LedgerItem, Statement } from "@/lib/types";
import { cardClass, inputBase, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import HistoryTable from "@/components/HistoryTable";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "TRANSFER", label: "Transfers" },
  { value: "DEPOSIT", label: "Deposits" },
  { value: "TOPUP", label: "Top ups" },
  { value: "WITHDRAWAL", label: "Withdrawals" },
  { value: "REVERSAL", label: "Refunds" },
];

// this month, in India time (YYYY-MM)
function currentMonth(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export default function HistoryPageView() {
  // filters
  const [direction, setDirection] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // list
  const [items, setItems] = useState<LedgerItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0); // ignores an old answer that arrives late

  // statement
  const [month, setMonth] = useState(currentMonth());
  const [statement, setStatement] = useState<Statement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams({ limit: "20" });
      if (direction) p.set("direction", direction);
      if (type) p.set("type", type);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (cursor) p.set("cursor", cursor);
      return p.toString();
    },
    [direction, type, from, to]
  );

  // first page, every time a filter changes
  useEffect(() => {
    const id = ++requestId.current;
    setItems(null);
    setError("");
    api<HistoryPage>(`/wallet/history?${buildQuery()}`, { auth: true })
      .then((data) => {
        if (id !== requestId.current) return;
        setItems(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setItems([]);
        setNextCursor(null);
        setError(errorMessage(err));
      });
  }, [buildQuery]);

  // Load more: send the same filters again, plus the cursor
  async function loadMore() {
    if (!nextCursor) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const data = await api<HistoryPage>(`/wallet/history?${buildQuery(nextCursor)}`, { auth: true });
      if (id !== requestId.current) return;
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  // the monthly summary
  useEffect(() => {
    if (!month) return;
    setStatement(null);
    api<Statement>(`/wallet/statement?month=${month}`, { auth: true })
      .then(setStatement)
      .catch(() => setStatement(null));
  }, [month]);

  async function handleDownload() {
    if (!month) return;
    setDownloading(true);
    setError("");
    try {
      await downloadFile(`/wallet/statement/csv?month=${month}`, `kaasupay-${month}.csv`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  function clearFilters() {
    setDirection("");
    setType("");
    setFrom("");
    setTo("");
  }

  const filtered = Boolean(direction || type || from || to);

  return (
    <>
      <PageHeader title="History" subtitle="Every rupee that came in or went out, newest first." />

      {/* monthly statement */}
      <section className={cardClass + " mb-6"}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly statement</h2>
            <p className="text-sm text-slate-500">Opening + money in − money out = closing</p>
          </div>
          <div className="flex items-end gap-2">
            <label className={labelClass}>
              Month
              <input className={inputBase + " mt-1.5"} type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <button type="button" className={secondaryBtnClass + " h-[42px]"} onClick={handleDownload} disabled={downloading || !month}>
              {downloading && <Spinner />}
              Download CSV
            </button>
          </div>
        </div>

        {statement ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Opening" value={rupees(statement.openingBalance)} />
              <Stat label="Money in" value={"+ " + rupees(statement.totalIn)} tone="text-green-600" />
              <Stat label="Money out" value={"- " + rupees(statement.totalOut)} tone="text-red-600" />
              <Stat label="Closing" value={rupees(statement.closingBalance)} />
            </div>
            <p className={"mt-4 text-xs " + (statement.check ? "text-green-700" : "text-red-700")}>
              {statement.check
                ? `✓ Verified · ${statement.entries} entries`
                : "The numbers do not add up. Something is wrong in the ledger."}
            </p>
          </>
        ) : (
          <div className="mt-5 h-16 animate-pulse rounded-lg bg-slate-100" />
        )}
      </section>

      {/* filters */}
      <section className={cardClass + " mb-4"}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label className={labelClass}>
            Direction
            <select className={inputBase + " mt-1.5"} value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">In and out</option>
              <option value="CREDIT">Money in</option>
              <option value="DEBIT">Money out</option>
            </select>
          </label>
          <label className={labelClass}>
            Type
            <select className={inputBase + " mt-1.5"} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            From
            <input className={inputBase + " mt-1.5"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={labelClass}>
            To
            <input className={inputBase + " mt-1.5"} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button type="button" className={secondaryBtnClass + " h-[42px] w-full"} onClick={clearFilters} disabled={!filtered}>
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <Alert text={error} kind="error" />
        </div>
      )}

      <HistoryTable items={items} hasMore={nextCursor !== null} loadingMore={loadingMore} onLoadMore={loadMore} />
    </>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={"mt-1 text-lg font-semibold tabular-nums " + tone}>{value}</p>
    </div>
  );
}
