"use client";

import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { btnClass, cardClass, inputClass, labelClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Spinner from "@/components/Spinner";

type Props = {
  hasPin: boolean | null; // null while we do not know yet
  onChanged: () => void;
};

type Mode = "change" | "reset";

// keep only digits, at most 4
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

export default function PinCard({ hasPin, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>("change");
  const [oldPin, setOldPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);

  if (hasPin === null) return null;

  const firstTime = !hasPin;
  const usePassword = firstTime || mode === "reset"; // password proves it is really you

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      setMessage({ text: "The PIN must be exactly 4 digits", kind: "error" });
      return;
    }
    if (pin !== confirm) {
      setMessage({ text: "The two PINs do not match", kind: "error" });
      return;
    }

    setBusy(true);
    setMessage({ text: "Saving...", kind: "info" });
    try {
      if (usePassword) {
        await api("/pin/set", { method: "POST", auth: true, body: { pin, password } });
      } else {
        await api("/pin/change", { method: "POST", auth: true, body: { oldPin, newPin: pin } });
      }
      setMessage({ text: firstTime ? "PIN set. You can now send money." : "PIN updated.", kind: "success" });
      setOldPin("");
      setPin("");
      setConfirm("");
      setPassword("");
      setMode("change");
      onChanged();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const pinInput = (value: string, set: (v: string) => void, label: string) => (
    <label className={labelClass}>
      {label}
      <input
        className={inputClass + " tracking-[0.5em]"}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="••••"
        value={value}
        onChange={(e) => set(digits(e.target.value))}
        required
      />
    </label>
  );

  return (
    <section className={cardClass}>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        {firstTime ? "Set your payment PIN" : mode === "reset" ? "Reset your PIN" : "Change your PIN"}
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        {firstTime
          ? "Choose a 4-digit PIN. You will enter it every time you send money."
          : mode === "reset"
            ? "Forgot your PIN? Confirm with your account password and choose a new one."
            : "Enter your current PIN and choose a new one."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!usePassword && pinInput(oldPin, setOldPin, "Current PIN")}
        {usePassword && (
          <label className={labelClass}>
            Account password
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        )}
        {pinInput(pin, setPin, usePassword ? "New PIN" : "New PIN")}
        {pinInput(confirm, setConfirm, "Confirm new PIN")}

        <button type="submit" className={btnClass} disabled={busy}>
          {busy && <Spinner />}
          {firstTime ? "Set PIN" : "Save PIN"}
        </button>
      </form>

      {!firstTime && (
        <button
          type="button"
          className="mt-3 text-sm text-teal-700 hover:underline"
          onClick={() => {
            setMode(mode === "change" ? "reset" : "change");
            setMessage({ text: "", kind: "info" });
          }}
        >
          {mode === "change" ? "Forgot your PIN?" : "Back to change PIN"}
        </button>
      )}

      <div className="mt-3">
        <Alert text={message.text} kind={message.kind} />
      </div>
    </section>
  );
}