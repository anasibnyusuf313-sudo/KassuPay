import type { HistoryResponse } from "@/lib/types";
import { cardClass, secondaryBtnClass } from "@/lib/ui";
import TransactionRow from "@/components/TransactionRow";

type Props = {
  history: HistoryResponse | null;
  onPage: (page: number) => void;
};

export default function HistoryTable({ history, onPage }: Props) {
  if (!history) {
    return (
      <section className={cardClass}>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((n) => (
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
      <p className="mb-2 text-xs text-gray-500">{history.total} total</p>

      {history.data.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          <p className="mb-1 text-2xl">🪙</p>
          No transactions yet
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {history.data.map((t) => (
            <TransactionRow key={`${t.transactionId}-${t.direction}`} t={t} />
          ))}
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