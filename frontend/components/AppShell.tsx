"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "@/components/logo";
import Icon, { type IconName } from "@/components/Icons";
import { useSession } from "@/lib/session";
import { initialsOf } from "@/lib/format";
import { secondaryBtnClass } from "@/lib/ui";

type Item = { href: string; label: string; icon: IconName };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/send", label: "Send", icon: "send" },
  { href: "/add-money", label: "Add money", icon: "add" },
  { href: "/withdraw", label: "Withdraw", icon: "withdraw" },
  { href: "/banks", label: "Bank accounts", icon: "bank" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/settings", label: "Account", icon: "user" },
];

// the phone bar has room for five
const PHONE_ITEMS = ["/dashboard", "/send", "/add-money", "/withdraw", "/settings"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, fullName, logout } = useSession();

  if (!ready) return <div className="min-h-screen" />;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-gray-700 sm:block">{fullName}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
              {initialsOf(fullName)}
            </div>
            <button type="button" className={secondaryBtnClass} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* sidebar, desktop only */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition " +
                  (isActive(item.href) ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-100")
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* tab bar, phones only */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {ITEMS.filter((i) => PHONE_ITEMS.includes(i.href)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium " +
                (isActive(item.href) ? "text-teal-700" : "text-gray-500")
              }
            >
              <Icon name={item.icon} className="h-6 w-6" />
              {item.label === "Add money" ? "Add" : item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}