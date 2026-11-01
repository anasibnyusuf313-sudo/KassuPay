import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}