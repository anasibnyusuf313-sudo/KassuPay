export type SigninResponse = { message: string; token: string };

export type MeResponse = {
  user: { id: string; username: string; firstName: string; lastName: string; createdAt?: string; hasPin?: boolean };
};

export type BalanceResponse = { balance: number; display: string }; // balance is in paise

// one history row (the old page style, still used by TransactionRow)
export type HistoryItem = {
  transactionId: string | null;
  type: string | null;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  withWhom: string;
  note: string;
  balanceAfter: number;
  createdAt: string;
};

// the old page-number reply (kept so nothing that still uses it breaks)
export type HistoryResponse = {
  data: HistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TransferResponse = {
  message: string;
  transaction: { id: string; to: string; amount: number; note: string; createdAt: string };
  balance: number;
};

// ---- add money (Razorpay) ----
export type CreateOrderResponse = { orderId: string; amount: number; currency: string; keyId: string };
export type VerifyResponse = { message: string; orderId: string; amount: number; balance: number };

// ---- bank accounts and withdrawals ----
export type BankAccount = { id: string; holderName: string; account: string; ifsc: string };
export type BankAccountsResponse = { accounts: BankAccount[] };

export type WithdrawStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "REVERSED" | "NEEDS_REVIEW";

export type Withdrawal = {
  id: string;
  amount: number;
  status: WithdrawStatus;
  bankRef?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

// the list may come back as a plain array or inside a key, so the page accepts both
export type WithdrawalsResponse = Withdrawal[] | { withdrawals?: Withdrawal[]; data?: Withdrawal[] };

export type WithdrawResponse = {
  message: string;
  withdrawal: { id: string; amount: number; status: WithdrawStatus; account: string };
  balance: number;
};

// ---- history with a cursor, and statements (Day 8) ----
export type LedgerItem = {
  id: string;
  transactionId: string | null;
  type: string | null;
  direction: "DEBIT" | "CREDIT";
  amount: number; // paise
  withWhom: string;
  label: string;
  note: string;
  balanceAfter: number; // paise
  createdAt: string;
  at: string;
};

export type HistoryPage = { items: LedgerItem[]; nextCursor: string | null };

export type Statement = {
  month: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  entries: number;
  check: boolean;
};
