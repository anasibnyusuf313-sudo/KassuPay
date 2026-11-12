// The left side of the sign in / sign up screen: what KaasuPay does and how to use it.
// Pure content, no state, no API calls. Put it where the headline and the three
// check marks are now (keep the logo at the top and the "Test mode" line at the bottom).

const FEATURES = [
  { title: "Add money", text: "Top up your wallet with UPI or a card." },
  { title: "Send money", text: "Pay anyone with their email, protected by your 4-digit PIN." },
  { title: "Request money", text: "Ask a friend to pay you. They can pay or decline." },
  { title: "Withdraw to bank", text: "Move money from your wallet to your bank account." },
  { title: "Bank accounts", text: "Save your accounts once and reuse them." },
  { title: "History", text: "Every rupee in and out, in one passbook." },
];

const STEPS = [
  { title: "Create your account", text: "Use Sign up with your name, email and a password." },
  { title: "Set your payment PIN", text: "Open Account and choose a 4-digit PIN. You need it for every payment." },
  { title: "Add money", text: "Go to Add money, enter an amount and pay with UPI or card." },
  { title: "Send, request or withdraw", text: "Use the menu to pay a friend, ask for money, or cash out to your bank." },
];

const GOOD_TO_KNOW = [
  "Each payment can be from ₹1 to ₹10,000.",
  "5 wrong PIN tries lock payments for 5 minutes.",
  "A money request expires after 7 days if nobody answers it.",
  "Pressed Send twice by mistake? You are only charged once.",
];

export default function AuthShowcase() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-white">Your money, in your hands.</h2>
        <p className="mt-2 text-sm text-slate-300">
          A simple wallet to add money, pay friends, request money and withdraw to your bank.
        </p>
      </div>

      {/* what you can do */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-300">What you can do</h2>
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[11px] text-teal-300">
                ✓
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{f.title}</span>
                <span className="block text-xs leading-5 text-slate-400">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* user guide */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-300">Get started in 4 steps</h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{s.title}</span>
                <span className="block text-xs leading-5 text-slate-400">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* small rules people ask about */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">Good to know</h2>
        <ul className="space-y-1.5 text-xs leading-5 text-slate-300">
          {GOOD_TO_KNOW.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-teal-300">•</span>
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}