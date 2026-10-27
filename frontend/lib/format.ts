// paise (whole number) -> "₹10.50"
export function rupees(paise: number): string {
  return "₹" + (paise / 100).toFixed(2);
}