"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, getToken, saveToken } from "@/lib/api";
import type { SigninResponse } from "@/lib/types";
import { btnClass, inputClass, labelClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import Logo from "@/components/logo";
import Spinner from "@/components/Spinner";

type Mode = "signin" | "signup";
type Message = { text: string; kind: AlertKind };

export default function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", password: "" });
  const [message, setMessage] = useState<Message>({ text: "", kind: "info" });
  const [loading, setLoading] = useState(false);

  // already signed in? go straight to the dashboard
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  function update(e: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setMessage({ text: "", kind: "info" });
  }

  async function signIn(username: string, password: string) {
    const data = await api<SigninResponse>("/user/signin", {
      method: "POST",
      body: { username, password },
    });
    saveToken(data.token);
    router.push("/dashboard");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: mode === "signup" ? "Creating your account..." : "Signing in...", kind: "info" });

    const username = form.username.trim();
    try {
      if (mode === "signup") {
        await api("/user/signup", {
          method: "POST",
          body: {
            username,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            password: form.password,
          },
        });
      }
      await signIn(username, form.password);
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
      setLoading(false);
    }
  }

  const tabClass = (active: boolean) =>
    "flex-1 rounded-md px-4 py-2 text-sm font-medium transition " +
    (active ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700");

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-teal-50 via-white to-emerald-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <Logo large />
          <p className="mt-2 text-sm text-gray-500">Send and receive money, simply.</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-100">
          <div className="mb-5 flex rounded-lg bg-gray-100 p-1">
            <button type="button" className={tabClass(mode === "signin")} onClick={() => switchMode("signin")}>
              Sign in
            </button>
            <button type="button" className={tabClass(mode === "signup")} onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  First name
                  <input className={inputClass} name="firstName" value={form.firstName} onChange={update} required maxLength={20} />
                </label>
                <label className={labelClass}>
                  Last name
                  <input className={inputClass} name="lastName" value={form.lastName} onChange={update} required maxLength={20} />
                </label>
              </div>
            )}

            <label className={labelClass}>
              Email
              <input className={inputClass} name="username" type="email" placeholder="you@example.com" value={form.username} onChange={update} required />
            </label>

            <label className={labelClass}>
              Password {mode === "signup" && <span className="font-normal text-gray-400">(at least 6 characters)</span>}
              <input
                className={inputClass}
                name="password"
                type="password"
                value={form.password}
                onChange={update}
                required
                minLength={mode === "signup" ? 6 : 1}
              />
            </label>

            <button type="submit" className={btnClass} disabled={loading}>
              {loading && <Spinner />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-4">
            <Alert text={message.text} kind={message.kind} />
          </div>
        </div>
      </div>
    </main>
  );
}