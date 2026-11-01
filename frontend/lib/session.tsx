"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, errorMessage, getToken } from "@/lib/api";
import type { BalanceResponse, MeResponse } from "@/lib/types";

type Session = {
  ready: boolean;
  fullName: string;
  firstName: string;
  email: string;
  hasPin: boolean | null; // null = not known yet
  balance: number | null; // paise, null while loading
  error: string;
  setBalance: (paise: number) => void;
  setHasPin: (value: boolean) => void;
  reloadBalance: () => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");

  const reloadBalance = useCallback(async () => {
    try {
      const data = await api<BalanceResponse>("/wallet/balance", { auth: true });
      setBalance(data.balance);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    router.replace("/");
  }, [router]);

  useEffect(() => {
    // not signed in? go back to the sign in page
    if (!getToken()) {
      router.replace("/");
      return;
    }
    setReady(true);

    api<MeResponse>("/user/me", { auth: true })
      .then((data) => {
        setFullName(`${data.user.firstName} ${data.user.lastName}`);
        setFirstName(data.user.firstName);
        setEmail(data.user.username);
        setHasPin(Boolean(data.user.hasPin));
      })
      .catch(() => {});
    reloadBalance();
  }, [router, reloadBalance]);

  const value = useMemo(
    () => ({ ready, fullName, firstName, email, hasPin, balance, error, setBalance, setHasPin, reloadBalance, logout }),
    [ready, fullName, firstName, email, hasPin, balance, error, reloadBalance, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}