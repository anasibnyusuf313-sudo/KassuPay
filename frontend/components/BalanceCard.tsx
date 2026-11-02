import Link from "next/link";
import Icon from "@/components/Icons";
import { rupees } from "@/lib/format";

type Props = {
  balance: number | null; // in paise, or null while loading
  onRefresh: () => void;
};

const secondary =
  "inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20";

export default function BalanceCard({ balance, onRefresh }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Available balance</p>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh balance"
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </svg>
          </button>
        </div>

        {balance === null ? (
          <div className="mt-3 h-12 w-56 animate-pulse rounded-lg bg-white/20" />
        ) : (
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{rupees(balance)}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/add-money"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            <Icon name="add" className="h-4 w-4" />
            Add money
          </Link>
          <Link href="/send" className={secondary}>
            <Icon name="send" className="h-4 w-4" />
            Send
          </Link>
          <Link href="/withdraw" className={secondary}>
            <Icon name="withdraw" className="h-4 w-4" />
            Withdraw
          </Link>
        </div>
      </div>
    </section>
  );
}