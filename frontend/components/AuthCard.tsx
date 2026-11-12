"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, getToken, saveToken } from "@/lib/api";
import type { SigninResponse } from "@/lib/types";
import { btnClass, inputClass, labelClass } from "@/lib/ui";
import Alert, { type AlertKind } from "@/components/Alert";
import AuthShowcase from "@/components/authshowcase";
import Logo from "@/components/logo";
import Spinner from "@/components/Spinner";

type Mode = "signin" | "signup";

export default function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", password: "" });
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
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
    (active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");

  return (
    <div className="flex min-h-screen">
      {/* brand panel, desktop only */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-y-auto bg-linear-to-br from-slate-900 via-slate-800 to-teal-900 p-10 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative">
          <Logo dark large />
        </div>
        <div className="relative my-8">
          <AuthShowcase />
        </div>
        <p className="relative text-xs text-slate-400">Test mode: no real money moves.</p>
      </aside>

      {/* form */}
      <main className="flex w-full flex-1 items-center justify-center bg-white px-6 py-10 lg:max-w-xl">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "signin" ? "Sign in to your wallet." : "It takes less than a minute."}
          </p>

          <div className="mb-6 mt-6 flex rounded-lg bg-slate-100 p-1">
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
              Password {mode === "signup" && <span className="font-normal text-slate-400">(at least 6 characters)</span>}
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
      </main>
    </div>
  );
}