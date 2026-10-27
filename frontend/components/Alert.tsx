export type AlertKind = "error" | "success" | "info";

const styles: Record<AlertKind, string> = {
  error: "bg-red-50 text-red-700 ring-red-100",
  success: "bg-green-50 text-green-700 ring-green-100",
  info: "bg-gray-50 text-gray-600 ring-gray-200",
};

export default function Alert({ text, kind }: { text: string; kind: AlertKind }) {
  if (!text) return null;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={"rounded-lg px-3.5 py-2.5 text-sm ring-1 " + styles[kind]}>
      {text}
    </p>
  );
}