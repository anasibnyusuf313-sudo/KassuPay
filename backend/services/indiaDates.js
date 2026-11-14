// India time helpers. India is UTC+5:30 all year (no daylight saving).
// A person types "4 November". We must turn that into the right UTC moment.
// new Date("2026-11-04") is UTC midnight = 5:30 AM in India, which is WRONG for us.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Is "2026-11-04" a real calendar date? ("2026-02-31" is not)
function isValidYmd(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// India midnight at the START of that day, as the real UTC moment
function startOfIndiaDay(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

// India midnight at the start of the NEXT day.
// Use it with $lt for a "to" date, so the whole "to" day is included.
function startOfNextIndiaDay(text) {
  return new Date(startOfIndiaDay(text).getTime() + DAY_MS);
}

function isValidMonth(text) {
  return typeof text === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(text);
}

// "2026-11" -> { start, end }: India midnight of the 1st, and of the 1st of the next month
function monthRange(text) {
  const [y, m] = text.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS), // month 12 rolls into January by itself
  };
}

// A Date -> "2026-11-04 10:15" in India time
function formatIndia(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

module.exports = { isValidYmd, startOfIndiaDay, startOfNextIndiaDay, isValidMonth, monthRange, formatIndia };
