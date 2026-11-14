"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { LookupResponse } from "@/lib/types";
import type {
  CreateMandateResponse,
  Mandate,
  MandateRun,
  MandateRunsResponse,
  MandatesResponse,
  MandateRunStatus,
  MandateStatus,
} from "@/lib/autopayTypes";
import { btnClass, cardClass, inputBase, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

const STATUS_BADGE: Record<MandateStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

const RUN_BADGE: Record<MandateRunStatus, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
  MISSED: "bg-slate-100 text-slate-600",
};

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

// "2026-12-05" -> "5 Dec 2026"
function prettyDay(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function AutoPayForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(""); // rupees, as typed
  const [day, setDay] = useState("5");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const paise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(paise) || paise < 100 || paise > 500000) {
      setMessage({ text: "Amount must be between ₹1 and ₹5,000", kind: "error" });
      return;
    }

    setBusy(true);
    setMessage({ text: "Setting up...", kind: "info" });
    try {
      // the form takes an email, the backend wants an id: look the person up first
      const found = await api<LookupResponse>("/requests/lookup?email=" + encodeURIComponent(email.trim()), {
        auth: true,
      });
      const data = await api<CreateMandateResponse>("/autopay", {
        method: "POST",
        auth: true,
        body: { to: found.user.id, amount: paise, dayOfMonth: Number(day), pin },
      });
      setMessage({
        text: `AutoPay set up. First payment of ${rupees(paise)} to ${data.mandate.to} on ${prettyDay(data.mandate.nextRunDay)}`,
        kind: "success",
      });
      setEmail("");
      setAmount("");
      onCreated();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setPin(""); // never keep a PIN on screen after an attempt
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Set up AutoPay</h2>
      <p className="mb-4 text-sm text-gray-500">
        Pay the same person the same amount every month. Your PIN is asked once, now. You can pause or cancel any time.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelClass}>
          Pay to (email)
          <input
            className={inputClass}
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <div>
          <label className={labelClass} htmlFor="autopay-amount">
            Amount every month
          </label>
          <div className="mt-1.5 flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
              ₹
            </span>
            <input
              id="autopay-amount"
              className={inputBase + " rounded-l-none"}
              type="number"
              min="1"
              max="5000"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>

        <label className={labelClass}>
          Day of the month
          <select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Payment PIN
          <input
            className={inputClass + " tracking-[0.5em]"}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(digits(e.target.value))}
            required
          />
        </label>

        <button type="submit" className={btnClass} disabled={busy || pin.length !== 4}>
          {busy && <Spinner />}
          {busy ? "Setting up..." : "Set up AutoPay"}
        </button>
      </form>

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}

function AutoPayCard({ m, onChanged }: { m: Mandate; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<MandateRun[] | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });

  async function act(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setMessage({ text: "", kind: "info" });
    try {
      await api(`/autopay/${m.id}/${action}`, { method: "POST", auth: true });
      onChanged();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleRuns() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const data = await api<MandateRunsResponse>(`/autopay/${m.id}/runs`, { auth: true });
        setRuns(data.runs);
      } catch (err) {
        setMessage({ text: errorMessage(err), kind: "error" });
      }
    }
  }

  return (
    <div className={cardClass + " !p-4"}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">Pay {m.to}</p>
          <p className="text-sm text-slate-500">
            {rupees(m.amount)} on the {m.dayOfMonth}
            {m.dayOfMonth === 1 ? "st" : m.dayOfMonth === 2 ? "nd" : m.dayOfMonth === 3 ? "rd" : "th"} of every month
          </p>
        </div>
        <span className={"shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_BADGE[m.status]}>
          {m.status}
        </span>
      </div>

      {m.status === "ACTIVE" && <p className="mt-2 text-xs text-slate-400">Next payment: {prettyDay(m.nextRunDay)}</p>}
      {m.status === "PAUSED" && m.failedCount >= 3 && (
        <p className="mt-2 text-xs text-amber-700">Paused after 3 failed payments in a row. Add money, then resume.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {m.status === "ACTIVE" && (
          <button type="button" className={secondaryBtnClass} onClick={() => act("pause")} disabled={busy}>
            Pause
          </button>
        )}
        {m.status === "PAUSED" && (
          <button type="button" className={secondaryBtnClass} onClick={() => act("resume")} disabled={busy}>
            Resume
          </button>
        )}
        {m.status !== "CANCELLED" && (
          <button type="button" className={secondaryBtnClass} onClick={() => act("cancel")} disabled={busy}>
            {busy && <Spinner />}
            Cancel
          </button>
        )}
        <button type="button" className={secondaryBtnClass} onClick={toggleRuns}>
          {open ? "Hide history" : "History"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {runs === null ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-slate-500">No payments yet.</p>
          ) : (
            runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700">{prettyDay(r.dueDay)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{r.reason}</span>
                <span className="text-slate-900">{rupees(r.amount)}</span>
                <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + RUN_BADGE[r.status]}>{r.status}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className={message.text ? "mt-3" : ""}>
        <Alert text={message.text} kind={message.kind} />
      </div>
    </div>
  );
}

export default function AutoPayPage() {
  const [list, setList] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<MandatesResponse>("/autopay", { auth: true });
      setList(data.mandates);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AutoPay</h1>
        <p className="text-sm text-slate-500">Monthly payments that run by themselves, exactly once.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AutoPayForm onCreated={load} />

        <div className="space-y-3">
          <Alert text={error} kind="error" />
          {loading ? (
            <div className={cardClass + " text-sm text-slate-500"}>Loading...</div>
          ) : list.length === 0 ? (
            <div className={cardClass + " text-sm text-slate-500"}>You have no AutoPays yet.</div>
          ) : (
            list.map((m) => <AutoPayCard key={m.id} m={m} onChanged={load} />)
          )}
        </div>
      </div>
    </div>
  );
}
