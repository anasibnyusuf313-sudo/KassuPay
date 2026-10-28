"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage, getToken } from "@/lib/api";
import Alert from "@/components/Alert";
import { secondaryBtnClass } from "@/lib/ui";

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

// CHANGE: must match what your create-order route returns
type CreateOrderResponse = { orderId: string; amount: number; currency: string; keyId: string };
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function AddMoneyPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/");
  }, [router]);

  async function pay() {
    setError("");
    setDone("");
    const rupees = Number(amount);
    if (!rupees || rupees < 1) {
      setError("Enter an amount of at least ₹1");
      return;
    }

    setBusy(true);
    try {
      if (!(await loadRazorpay())) throw new Error("Could not load Razorpay");

      // 1. ask OUR backend to create the order
      // CHANGE: the path, and the body if your route expects rupees instead of paise
      const order = await api<CreateOrderResponse>("/wallet/add-money/order", {
        method: "POST",
        auth: true,
        body: { amount: Math.round(rupees * 100) },
      });

      // 2. open the Razorpay popup
      const rz = new window.Razorpay!({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "KaasuPay",
        description: "Add money to wallet",
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 3. ask OUR backend to verify the payment
            // CHANGE: the path if your verify route is named differently
            await api("/wallet/add-money/verify", { method: "POST", auth: true, body: resp });
            setDone("Payment received. Your balance is updated.");
          } catch (err) {
            // the webhook may still credit it
            setError(errorMessage(err) + " (if money was taken, it will be credited shortly)");
          }
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/dashboard" className="text-sm text-teal-700">← Back to dashboard</Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold text-gray-900">Add money</h1>

      {error && (
        <div className="mb-3">
          <Alert text={error} kind="error" />
        </div>
      )}
      {done && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{done}</p>}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2"
        />
        <div className="mb-4 flex gap-2">
          {[100, 500, 1000].map((v) => (
            <button key={v} type="button" className={secondaryBtnClass} onClick={() => setAmount(String(v))}>
              ₹{v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Please wait..." : "Pay with Razorpay"}
        </button>
      </div>
    </main>
  );
}