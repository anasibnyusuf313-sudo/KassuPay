"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage, getToken } from "@/lib/api";
import type { BankAccount } from "@/lib/types";
import { secondaryBtnClass } from "@/lib/ui";
import Alert from "@/components/Alert";
import Logo from "@/components/logo";
import BankAccountForm from "@/components/BankAccountForm";
import BankAccountList from "@/components/BankAccountList";

export default function BankAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // not signed in? go back to the sign in page
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api<BankAccount[]>("/bank", { auth: true })
      .then(setAccounts)
      .catch((err) => setError(errorMessage(err)));
  }, [router]);

  function handleAdded(account: BankAccount) {
    setAccounts((prev) => [account, ...(prev ?? [])]);
  }

  function handleDeleted(id: string) {
    setAccounts((prev) => (prev ?? []).filter((a) => a.id !== id));
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo />
          <Link href="/dashboard" className={secondaryBtnClass}>
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <h2 className="text-2xl font-semibold text-gray-900">Bank accounts</h2>

        {error && <Alert text={error} kind="error" />}

        <BankAccountList accounts={accounts} onDeleted={handleDeleted} />
        <BankAccountForm onAdded={handleAdded} />
      </main>
    </div>
  );
}
