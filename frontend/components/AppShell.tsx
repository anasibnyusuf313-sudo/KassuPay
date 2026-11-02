"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "@/components/logo";
import Icon, { type IconName } from "@/components/Icons";
import { useSession } from "@/lib/session";
import { initialsOf } from "@/lib/format";

type Item = { href: string; label: string; icon: IconName };

const MAIN: Item[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/send", label: "Send", icon: "send" },
  { href: "/add-money", label: "Add money", icon: "add" },
  { href: "/withdraw", label: "Withdraw", icon: "withdraw" },
];

const MANAGE: Item[] = [
  { href: "/banks", label: "Bank accounts", icon: "bank" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/settings", label: "Account", icon: "user" },
];

// the phone bar has room for five
const PHONE = ["/dashboard", "/send", "/add-money", "/withdraw", "/settings"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, fullName, email, logout } = useSession();

  if (!ready) return <div className="min-h-screen bg-slate-50" />;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const sideLink = (item: Item) => (
    <Link
      key={item.href}
      href={item.href}
      className={
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
        (isActive(item.href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")
      }
    >
      <Icon name={item.icon} className={"h-[18px] w-[18px] " + (isActive(item.href) ? "text-teal-400" : "")} />
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* sidebar, desktop only */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo dark />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Menu</p>
          <div className="space-y-1">{MAIN.map(sideLink)}</div>
          <p className="px-3 pb-1 pt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Manage</p>
          <div className="space-y-1">{MANAGE.map(sideLink)}</div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-sm font-semibold text-teal-300">
              {initialsOf(fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{fullName}</p>
              <p className="truncate text-xs text-slate-400">{email}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-3 text-xs font-medium text-slate-400 transition hover:text-white">
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* thin top bar, phones only */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
            {initialsOf(fullName)}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-8">{children}</main>
      </div>

      {/* tab bar, phones only */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {[...MAIN, ...MANAGE]
            .filter((i) => PHONE.includes(i.href))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium " +
                  (isActive(item.href) ? "text-teal-700" : "text-slate-500")
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