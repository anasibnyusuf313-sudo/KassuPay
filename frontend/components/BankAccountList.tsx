"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { BankAccount } from "@/lib/types";
import { cardClass, secondaryBtnClass } from "@/lib/ui";
import Alert from "@/components/Alert";

type Props = {
  accounts: BankAccount[] | null; // null = still loading
  onDeleted: (id: string) => void;
};

export default function BankAccountList({ accounts, onDeleted }: Props) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function remove(id: string) {
    if (!window.confirm("Remove this bank account?")) return;
    setBusyId(id);
    setError("");
    try {
      await api<{ message: string }>(`/bank/${id}`, { method: "DELETE", auth: true });
      onDeleted(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Your bank accounts</h2>

      {accounts === null && <p className="text-sm text-gray-500">Loading...</p>}

      {accounts !== null && accounts.length === 0 && (
        <p className="text-sm text-gray-500">No bank account yet. Add one to withdraw money.</p>
      )}

      {accounts !== null && accounts.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-gray-900">{a.accountHolderName}</p>
                <p className="text-sm text-gray-500">
                  •••• {a.last4} · {a.ifsc}
                </p>
              </div>
              <button type="button" className={secondaryBtnClass} disabled={busyId === a.id} onClick={() => remove(a.id)}>
                {busyId === a.id ? "Removing..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3">
          <Alert text={error} kind="error" />
        </div>
      )}
    </section>
  );
}
