const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.error("NEXT_PUBLIC_API_URL is not set");
}
// ---- token helpers (localStorage only exists in the browser) ----
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function saveToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

// An error that carries the status code, so the screen can decide what to do
export class ApiError extends Error {
  status?: number;
  network: boolean;

  constructor(message: string, status?: number, network = false) {
    super(message);
    this.status = status;
    this.network = network;
  }
}

// Turns anything thrown into a message we can show
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

// The only function that talks to the backend.
// T is the shape of the reply we expect, for example api<BalanceResponse>("/wallet/balance")
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, auth = false, headers = {} } = options;

  const settings: RequestInit = { method, headers: { ...headers } };
  const settingsHeaders = settings.headers as Record<string, string>;

  if (body !== undefined) {
    settingsHeaders["Content-Type"] = "application/json";
    settings.body = JSON.stringify(body);
  }
  if (auth) {
    settingsHeaders["Authorization"] = "Bearer " + getToken();
  }

  let res: Response;
  try {
      res = await fetch((API_URL ?? "") + path, settings);  } catch {
    // no answer at all: server off, or no internet
    throw new ApiError("Cannot reach the server. Is the backend running?", undefined, true);
  }

  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    // the reply had no JSON body
  }

  // missing or expired token: back to the sign in page
  if (res.status === 401 && auth) {
    clearToken();
    window.location.href = "/";
    throw new ApiError("Please sign in again", 401);
  }

  if (!res.ok) {
    const message = (data as { error?: string }).error ?? "Something went wrong";
    throw new ApiError(message, res.status);
  }

  return data as T;
}