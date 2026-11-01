import Link from "next/link";
import Icon, { type IconName } from "@/components/Icons";

const ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/send", label: "Send", icon: "send" },
  { href: "/add-money", label: "Add money", icon: "add" },
  { href: "/withdraw", label: "Withdraw", icon: "withdraw" },
  { href: "/banks", label: "Banks", icon: "bank" },
];

export default function QuickActions() {
  return (
    <div className="my-5 grid grid-cols-4 gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-100 transition hover:ring-teal-200 sm:text-sm"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Icon name={a.icon} />
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  );
}