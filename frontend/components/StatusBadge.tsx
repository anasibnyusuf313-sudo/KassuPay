import type { WithdrawStatus } from "@/lib/types";

const STYLES: Record<WithdrawStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  SUCCESS: "bg-green-50 text-green-700",
  REVERSED: "bg-gray-100 text-gray-600",
  NEEDS_REVIEW: "bg-red-50 text-red-700",
};

const LABELS: Record<WithdrawStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCESS: "Sent to bank",
  REVERSED: "Refunded",
  NEEDS_REVIEW: "Under review",
};

export default function StatusBadge({ status }: { status: WithdrawStatus }) {
  return (
    <span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-medium " + STYLES[status]}>
      {LABELS[status]}
    </span>
  );
}