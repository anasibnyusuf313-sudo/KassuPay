import { rupees } from "@/lib/format";
import type { HistoryItem } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionRow({ t }: { t: HistoryItem }) {
  const debit = t.direction === "DEBIT";
  const label = t.type === "TRANSFER" ? (debit ? "To " : "From ") + t.withWhom : t.withWhom;
  const showNote = t.note && t.note !== t.withWhom;

  return (
    <li className="flex items-center gap-3 py-3">
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
}