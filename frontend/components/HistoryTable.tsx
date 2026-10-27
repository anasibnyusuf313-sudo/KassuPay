import { rupees } from "@/lib/format";
import type { HistoryResponse } from "@/lib/types";
import { cardClass, secondaryBtnClass } from "@/lib/ui";

type Props = {
  history: HistoryResponse | null;
  onPage: (page: number) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryTable({ history, onPage }: Props) {
  // loading placeholder
  if (!history) {
    return (
      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">History</h2>
        <div className="space-y-4">
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
      </section>
    );
  }

  return (
    <section className={cardClass}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">History</h2>
        <span className="text-xs text-gray-500">{history.total} total</span>
      </div>

      {history.data.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          <p className="mb-1 text-2xl">🪙</p>
          No transactions yet
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {history.data.map((t) => {
            const debit = t.direction === "DEBIT";
            const label = t.type === "TRANSFER" ? (debit ? "To " : "From ") + t.withWhom : t.withWhom;
            const showNote = t.note && t.note !== t.withWhom;

            return (
              <li key={`${t.transactionId}-${t.direction}`} className="flex items-center gap-3 py-3">
                <div
                  className={
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
                    (debit ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")
                  }
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {debit ? <path d="M7 17L17 7M9 7h8v8" /> : <path d="M17 7L7 17M15 17H7V9" />}
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{label}</p>
                  <p className="truncate text-xs text-gray-500">
                    {formatDate(t.createdAt)}
                    {showNote ? " · " + t.note : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className={"text-sm font-semibold " + (debit ? "text-red-600" : "text-green-600")}>
                    {debit ? "- " : "+ "}
                    {rupees(t.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Bal {rupees(t.balanceAfter)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <button type="button" className={secondaryBtnClass} disabled={history.page <= 1} onClick={() => onPage(history.page - 1)}>
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {history.page} of {Math.max(history.totalPages, 1)}
        </span>
        <button type="button" className={secondaryBtnClass} disabled={history.page >= history.totalPages} onClick={() => onPage(history.page + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}