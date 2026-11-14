import type { LedgerItem } from "@/lib/types";
import { cardClass, secondaryBtnClass } from "@/lib/ui";
import Spinner from "@/components/Spinner";
import TransactionRow from "@/components/TransactionRow";

type Props = {
  items: LedgerItem[] | null; // null while the first page loads
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

export default function HistoryTable({ items, hasMore, loadingMore, onLoadMore }: Props) {
  if (!items) {
    return (
      <section className={cardClass}>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cardClass}>
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <p className="mb-1 text-2xl">🪙</p>
          No transactions found
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((t) => (
            <TransactionRow key={t.id} t={t} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-center">
          <button type="button" className={secondaryBtnClass} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <Spinner />}
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
