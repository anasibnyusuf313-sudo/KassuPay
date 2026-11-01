"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { initialsOf } from "@/lib/format";
import { cardClass, secondaryBtnClass } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";
import PinCard from "@/components/PinCard";

export default function SettingsPage() {
  const { fullName, email, hasPin, setHasPin, logout } = useSession();

  return (
    <>
      <PageHeader title="Account" subtitle="Your profile and security." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section className={cardClass + " flex items-center gap-4"}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-lg font-semibold text-teal-700">
              {initialsOf(fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-900">{fullName}</p>
              <p className="truncate text-sm text-gray-500">{email}</p>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Shortcuts</h2>
            <div className="divide-y divide-gray-100 text-sm">
              <Link href="/banks" className="flex items-center justify-between py-3 text-gray-700 hover:text-teal-700">
                Bank accounts <span>→</span>
              </Link>
              <Link href="/history" className="flex items-center justify-between py-3 text-gray-700 hover:text-teal-700">
                Transaction history <span>→</span>
              </Link>
            </div>
            <button type="button" className={secondaryBtnClass + " mt-3"} onClick={logout}>
              Log out
            </button>
          </section>
        </div>

        <PinCard hasPin={hasPin} onChanged={() => setHasPin(true)} />
      </div>
    </>
  );
}