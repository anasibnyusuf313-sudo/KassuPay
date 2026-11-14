// Run: node tools/test-dates.js   (no database needed)
const assert = require("assert");
const { nextMonth, firstRunDay, daysBetween, isValidDay, indiaDay } = require("../lib/dates");

// month roll-over, including December -> January
assert.strictEqual(nextMonth("2026-11-05"), "2026-12-05");
assert.strictEqual(nextMonth("2026-12-05"), "2027-01-05");

// first run day is always AFTER today
assert.strictEqual(firstRunDay("2026-11-09", 5), "2026-12-05"); // day already passed -> next month
assert.strictEqual(firstRunDay("2026-11-09", 10), "2026-11-10"); // still ahead this month
assert.strictEqual(firstRunDay("2026-11-05", 5), "2026-12-05"); // same day -> NOT today
assert.strictEqual(firstRunDay("2026-12-20", 5), "2027-01-05"); // year change

// grace window numbers from test D4
assert.strictEqual(daysBetween("2027-01-05", "2027-02-07"), 33); // > 3 -> MISSED
assert.strictEqual(daysBetween("2027-02-05", "2027-02-07"), 2); // <= 3 -> paid
assert.strictEqual(daysBetween("2027-02-05", "2027-02-05"), 0);

// validation
assert.ok(isValidDay("2026-12-05"));
assert.ok(!isValidDay("2026-12-5"));
assert.ok(!isValidDay("2026-13-05"));
assert.ok(!isValidDay("2026-02-30"));

// string order = date order, so $lte on strings works
assert.ok("2026-12-05" < "2027-01-05");

// India day: 20:00 UTC on 4 Dec is already 5 Dec 01:30 in India
assert.strictEqual(indiaDay(Date.UTC(2026, 11, 4, 20, 0)), "2026-12-05");
assert.strictEqual(indiaDay(Date.UTC(2026, 11, 4, 18, 0)), "2026-12-04");

// replay test D4's chain: Dec 5 paid, Jan 5 missed, Feb 5 paid, next is Mar 5
let due = "2027-01-05";
const today = "2027-02-07";
let missed = 0;
while (due <= today && daysBetween(due, today) > 3) {
  missed++;
  due = nextMonth(due);
}
assert.strictEqual(missed, 1);
assert.strictEqual(due, "2027-02-05");
assert.strictEqual(nextMonth(due), "2027-03-05");

console.log("all date tests passed");
