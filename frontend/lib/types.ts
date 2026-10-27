export type SigninResponse = { message: string; token: string };

export type MeResponse = {
  user: { id: string; username: string; firstName: string; lastName: string; createdAt?: string };
};

export type BalanceResponse = { balance: number; display: string }; // balance is in paise

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
  balance: number; // the sender's new balance, in paise
};