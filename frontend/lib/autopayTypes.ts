// Types for the AutoPay page (Day 10). Kept in their own file so lib/types.ts stays untouched.

export type MandateStatus = "ACTIVE" | "PAUSED" | "CANCELLED";

export type Mandate = {
  id: string;
  to: string; // payee display name
  amount: number; // paise
  dayOfMonth: number;
  status: MandateStatus;
  nextRunDay: string; // "YYYY-MM-DD" (India date)
  failedCount: number;
};

export type MandatesResponse = { mandates: Mandate[] };

export type MandateRunStatus = "SUCCESS" | "FAILED" | "MISSED";

export type MandateRun = {
  id: string;
  dueDay: string;
  status: MandateRunStatus;
  amount: number; // paise
  reason: string;
  transactionId: string | null;
};

export type MandateRunsResponse = { runs: MandateRun[] };

export type CreateMandateResponse = { message: string; mandate: Mandate };
