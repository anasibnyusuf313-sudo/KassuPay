// Date helpers for AutoPay. All days are India date strings: "YYYY-MM-DD".
// Strings in this form sort in the same order as the dates, so $lte works on them.

const RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");

// India is UTC+05:30, so add 330 minutes before reading the date.
function indiaDay(now = Date.now()) {
  return new Date(now + 330 * 60000).toISOString().slice(0, 10);
}

// true only for real dates: "2026-02-30" and "2026-13-05" are rejected
function isValidDay(s) {
  if (typeof s !== "string" || !RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// "2026-12-05" -> "2027-01-05" (rolls over the year).
// Safe because dayOfMonth is limited to 1..28, so every month has that day.
function nextMonth(day) {
  let [y, m, d] = day.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

// The first run day: the next date AFTER today with that day of month.
// Never today, so nothing is charged on the day it was created.
function firstRunDay(today, dayOfMonth) {
  const [y, m, d] = today.split("-").map(Number);
  if (d < dayOfMonth) return `${y}-${pad(m)}-${pad(dayOfMonth)}`;
  return nextMonth(`${y}-${pad(m)}-${pad(dayOfMonth)}`);
}

// whole days from a to b (b later than a gives a positive number)
function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

module.exports = { indiaDay, isValidDay, nextMonth, firstRunDay, daysBetween };
