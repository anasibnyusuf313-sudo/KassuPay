// Turns one value into a safe CSV cell. Every value goes through this.
//  1. a value with a comma, a quote or a new line is wrapped in double quotes,
//     and each " inside is written twice
//  2. a value that starts with = + - @ (or a tab / return) would be read by Excel as a formula
//     (CSV injection), so we put a ' in front to make it plain text
function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

// paise (a whole number) -> "1105.00" using whole numbers only.
// Never use (p / 100).toFixed(2): decimals in JavaScript are not exact.
function rupees(paise) {
  const p = Math.round(Number(paise)) || 0;
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  return sign + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
}

module.exports = { csvCell, rupees };
