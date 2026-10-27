import { rupees } from "@/lib/format";

type Props = {
  balance: number | null; // in paise, or null while loading
  onRefresh: () => void;
};

export default function BalanceCard({ balance, onRefresh }: Props) {
  return (
    <section className="rounded-2xl bg-linear-to-br from-teal-600 to-emerald-500 p-6 text-white shadow-md">
      <p className="text-sm text-teal-50">Available balance</p>

      {balance === null ? (
        <div className="mt-3 h-10 w-40 animate-pulse rounded-lg bg-white/30" />
      ) : (
        <p className="mt-1 text-4xl font-bold tracking-tight">{rupees(balance)}</p>
      )}

      <button
        type="button"
        onClick={onRefresh}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/30"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
        Refresh
      </button>
    </section>
  );
}