"use client";

import { FormEvent, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { initialsOf, rupees } from "@/lib/format";
import type { MoneyRequest, PayRequestResponse, RequestStatus } from "@/lib/types";
import { btnClass, cardClass, inputClass, labelClass, secondaryBtnClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = {
  request: MoneyRequest;
  hasPin: boolean | null;
  onChanged: () => void; // reload the lists
  onPaid: (newBalance: number) => void; // update the balance shown in the app
};

const BADGE: Record<RequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-slate-100 text-slate-600",
};

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

function expiryText(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
}

export default function RequestCard({ request, hasPin, onChanged, onPaid }: Props) {
  const [asking, setAsking] = useState(false); // PIN box open
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });

  // One Idempotency-Key per payment attempt. The PIN is never part of it.
  const payKey = useRef<string | null>(null);

  const incoming = request.direction === "INCOMING";
  const pending = request.status === "PENDING";
  const other = incoming ? request.from : request.to;

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payKey.current) payKey.current = crypto.randomUUID();

    setBusy(true);
    setMessage({ text: "Paying...", kind: "info" });
    try {
      const data = await api<PayRequestResponse>(`/requests/${request.id}/pay`, {
        method: "POST",
        auth: true,
        headers: { "Idempotency-Key": payKey.current },
        body: { pin },
      });
      payKey.current = null;
      onPaid(data.balance);
      onChanged();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const network = err instanceof ApiError && err.network;
      // a clear answer from the server (not "still processing") means a retry needs a new key
      const sure = status !== undefined && status >= 400 && status < 500 && status !== 409;
      if (sure) payKey.current = null;

      setMessage({
        text: network ? errorMessage(err) + " Tap Pay again. It is safe: the same key is reused." : errorMessage(err),
        kind: "error",
      });
      // the request may have changed (expired, cancelled): refresh the list
      if (status === 409 || status === 410 || status === 404) onChanged();
    } finally {
      setPin(""); // never keep a PIN on screen after an attempt
      setBusy(false);
    }
  }

  // decline (payer) or cancel (requester): one POST, no PIN, no money
  async function simple(action: "decline" | "cancel") {
    setBusy(true);
    setMessage({ text: "", kind: "info" });
    try {
      await api(`/requests/${request.id}/${action}`, { method: "POST", auth: true });
      onChanged();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cardClass + " !p-4"}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
          {initialsOf(other)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {incoming ? `${other} asked you` : `You asked ${other}`}
              </p>
              {request.note && <p className="truncate text-sm text-slate-500">{request.note}</p>}
            </div>
            <p className="shrink-0 text-base font-semibold text-slate-900">{rupees(request.amount)}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + BADGE[request.status]}>
              {request.status}
            </span>
            <span className="text-xs text-slate-400">
              {pending ? expiryText(request.expiresAt) : new Date(request.createdAt).toLocaleDateString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {pending && !asking && (
        <div className="mt-3 flex gap-2">
          {incoming ? (
            <>
              <button
                type="button"
                className={btnClass + " !w-auto flex-1"}
                onClick={() => setAsking(true)}
                disabled={busy || hasPin === false}
              >
                Pay {rupees(request.amount)}
              </button>
              <button type="button" className={secondaryBtnClass} onClick={() => simple("decline")} disabled={busy}>
                Decline
              </button>
            </>
          ) : (
            <button type="button" className={secondaryBtnClass} onClick={() => simple("cancel")} disabled={busy}>
              {busy && <Spinner />}
              Cancel request
            </button>
          )}
        </div>
      )}

      {pending && incoming && hasPin === false && (
        <p className="mt-2 text-xs text-slate-500">Set your payment PIN in Account before you can pay.</p>
      )}

      {pending && incoming && asking && (
        <form onSubmit={pay} className="mt-3 space-y-3">
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
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={btnClass + " !w-auto flex-1"} disabled={busy || pin.length !== 4}>
              {busy && <Spinner />}
              {busy ? "Paying..." : `Confirm ${rupees(request.amount)}`}
            </button>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setAsking(false);
                setPin("");
                setMessage({ text: "", kind: "info" });
              }}
              disabled={busy}
            >
              Back
            </button>
          </div>
        </form>
      )}

      <div className={message.text ? "mt-3" : ""}>
        <Alert text={message.text} kind={message.kind} />
      </div>
    </div>
  );
}
