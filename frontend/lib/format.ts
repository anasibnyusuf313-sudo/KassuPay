// paise (whole number) -> "₹10.50"
export function rupees(paise: number): string {
  return "₹" + (paise / 100).toFixed(2);
}

export function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}