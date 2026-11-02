export default function Logo({ large = false, dark = false }: { large?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={
          "flex items-center justify-center rounded-xl bg-teal-500 font-bold text-white shadow-sm " +
          (large ? "h-11 w-11 text-xl" : "h-8 w-8 text-base")
        }
      >
        ₹
      </div>
      <span className={"font-semibold tracking-tight " + (large ? "text-2xl " : "text-lg ") + (dark ? "text-white" : "text-slate-900")}>
        Kaasu<span className={dark ? "text-teal-300" : "text-teal-600"}>Pay</span>
      </span>
    </div>
  );
}