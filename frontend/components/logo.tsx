export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "flex items-center justify-center rounded-xl bg-teal-600 font-bold text-white " +
          (large ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg")
        }
      >
        ₹
      </div>
      <span className={"font-bold tracking-tight text-gray-900 " + (large ? "text-3xl" : "text-xl")}>
        Kaasu<span className="text-teal-600">Pay</span>
      </span>
    </div>
  );
}