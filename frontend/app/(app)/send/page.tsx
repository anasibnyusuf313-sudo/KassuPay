"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import PageHeader from "@/components/PageHeader";
import SendMoneyForm from "@/components/SendMoneyForm";

export default function SendPage() {
  const { hasPin, setBalance } = useSession();

  return (
    <>
      <PageHeader title="Send money" subtitle="Pay anyone on KaasuPay using their email." />
      <div className="max-w-xl">
        <SendMoneyForm onSent={setBalance} hasPin={hasPin} />
        {hasPin === false && (
          <Link href="/settings" className="text-sm font-medium text-teal-700 hover:underline">
            Go to Account to set your PIN →
          </Link>
        )}
      </div>
    </>
  );
}