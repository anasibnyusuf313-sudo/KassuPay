"use client";

import { FormEvent, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { CreateOrderResponse, VerifyResponse } from "@/lib/types";
import { btnClass, cardClass, inputBase, labelClass, secondaryBtnClass } from "@/lib/ui";
import { useSession } from "@/lib/session";
import Alert, { type AlertKind } from "@/components/Alert";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";

type RazorpayInstance = { open: () => void; on: (event: string, handler: () => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function AddMoneyPage() {
  const { balance, setBalance } = useSession();
  const [amount, setAmount] = useState(""); // in rupees, as typed
  const [message, setMessage] = useState<{ text: string; kind: AlertKind }>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);
  const finished = useRef(false); // true once the payment was handled

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const paise = Math.round(Number(amount) * 100); // rupees -> paise
    finished.current = false;
    setBusy(true);
    setMessage({ text: "Opening the payment window...", kind: "info" });

    try {
      if (!(await loadCheckout()) || !window.Razorpay) {
        throw new Error("Could not load Razorpay. Check your internet and try again.");
      }

      // 1. our server creates the order
      const order = await api<CreateOrderResponse>("/wallet/add-money/order", {
        method: "POST",
        auth: true,
        body: { amount: paise },
      });

      // 2. the person pays inside Razorpay's window
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "KaasuPay",
        description: "Add money to wallet",
        order_id: order.orderId,
        theme: { color: "#0d9488" },
        handler: async (response: Record<string, string>) => {
          finished.current = true;
          setMessage({ text: "Confirming your payment...", kind: "info" });
          try {
            // 3. our server checks the payment proof, then adds the money once
            const v = await api<VerifyResponse>("/wallet/add-money/verify", {
              method: "POST",
              auth: true,
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            setBalance(v.balance);
            setAmount("");
            setMessage({ text: `${rupees(order.amount)} added to your wallet`, kind: "success" });
          } catch (err) {
            setMessage({ text: errorMessage(err), kind: "error" });
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (finished.current) return;
            setBusy(false);
            setMessage({ text: "Payment window closed. No money was taken.", kind: "info" });
          },
        },
      });

      rzp.on("payment.failed", () => {
        setMessage({ text: "Payment failed. You can try again in the window.", kind: "error" });
      });
      rzp.open();
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add money"
        subtitle={`Current balance: ${balance === null ? "..." : rupees(balance)}`}
      />

      <section className={cardClass + " max-w-xl"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="amount">
              Amount
            </label>
            <div className="mt-1.5 flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">₹</span>
              <input
                id="amount"
                className={inputBase + " rounded-l-none"}
                type="number"
                min="10"
                max="10000"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Between ₹10 and ₹10,000 per payment.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <button key={v} type="button" className={secondaryBtnClass} onClick={() => setAmount(String(v))}>
                  ₹{v}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className={btnClass} disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Please wait..." : "Pay with Razorpay"}
          </button>
        </form>

        <div className="mt-3">
          <Alert text={message.text} kind={message.kind} />
        </div>

        <p className="mt-4 text-xs text-gray-400">Test mode: use the Razorpay test card or test UPI details. No real money moves.</p>
      </section>
    </>
  );
}