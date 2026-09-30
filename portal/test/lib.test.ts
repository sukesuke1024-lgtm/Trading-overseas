import test from "node:test";
import assert from "node:assert/strict";
import { calcDay, grantDays, overtimeLevel, statutoryBreak, summarize, leaveBalance, nightMinutes, dayKind, workdaysBetween } from "../src/lib/attendance-calc.ts";
import { hotp, verifyTotp, base32Encode } from "../src/lib/totp.ts";

test("RFC 6238 test vectors (SHA-1, secret '12345678901234567890')", async () => {
  const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
  assert.equal(await hotp(secret, Math.floor(59 / 30)), "287082");
  assert.equal(await hotp(secret, Math.floor(1111111109 / 30)), "081804");
  assert.equal(await verifyTotp(secret, "287082", 59_000), true);
  assert.equal(await verifyTotp(secret, "287082", 200_000), false);
  assert.equal(await verifyTotp(secret, "12345", 59_000), false);
});

test("statutory break", () => {
  assert.equal(statutoryBreak(6 * 60), 0);
  assert.equal(statutoryBreak(6 * 60 + 1), 45);
  assert.equal(statutoryBreak(8 * 60 + 1), 60);
});

test("weekday overtime & break (Tue 2026-09-29)", () => {
  const c = calcDay("2026-09-29", { in: "09:00", out: "20:00" });
  assert.equal(c.span, 660); assert.equal(c.breakMin, 60); assert.equal(c.work, 600);
  assert.equal(c.overtime, 120); assert.equal(c.scheduled, 480); assert.equal(c.night, 0);
  assert.equal(c.late, false); assert.equal(c.early, false);
});

test("late/early flags and manual break cannot go below statutory", () => {
  const c = calcDay("2026-09-29", { in: "09:30", out: "17:00", break: 15 });
  assert.equal(c.late, true); assert.equal(c.early, true);
  assert.equal(c.breakMin, 45); // 7.5h span → 45min minimum
});

test("night minutes 22-5", () => {
  assert.equal(nightMinutes(9 * 60, 23 * 60), 60);
  assert.equal(nightMinutes(4 * 60, 6 * 60), 60);
  const c = calcDay("2026-09-29", { in: "10:00", out: "23:30" });
  assert.equal(c.night, 90);
});

test("holiday kinds", () => {
  assert.equal(dayKind("2026-09-27"), "legal-off"); // Sun
  assert.equal(dayKind("2026-09-26"), "prescribed-off"); // Sat
  assert.equal(dayKind("2026-09-22"), "prescribed-off"); // 国民の休日
  assert.equal(dayKind("2026-09-29"), "workday");
  assert.equal(calcDay("2026-09-27", { in: "10:00", out: "15:00" }).legalHoliday, 300);
  assert.equal(calcDay("2026-09-26", { in: "10:00", out: "15:00" }).overtime, 300);
});

test("overtime levels (36 agreement)", () => {
  assert.equal(overtimeLevel(30 * 60).level, "ok");
  assert.equal(overtimeLevel(40 * 60).level, "notice");
  assert.equal(overtimeLevel(46 * 60).level, "warn");
  assert.equal(overtimeLevel(81 * 60).level, "danger");
  assert.equal(overtimeLevel(70 * 60, 30 * 60).level, "danger");
});

test("paid leave grant table", () => {
  assert.equal(grantDays("2026-04-01", "2026-09-30"), 0);
  assert.equal(grantDays("2026-04-01", "2026-10-01"), 10);
  assert.equal(grantDays("2025-04-01", "2026-10-01"), 11);
  assert.equal(grantDays("2017-04-01", "2026-09-30"), 20);
  assert.equal(grantDays("2020-04-01", "2026-09-30"), 18);
});

test("leave balance and 5-day obligation", () => {
  const b = leaveBalance("2017-04-01", "2026-09-30", 2, 0);
  assert.equal(b.granted, 20); assert.equal(b.remaining, 18); assert.equal(b.mustTake, 3);
});

test("summarize month", () => {
  const dates = ["2026-09-28", "2026-09-29", "2026-09-30"];
  const s = summarize(dates, { "2026-09-28": { in: "09:00", out: "19:00" }, "2026-09-29": { in: "09:00", out: "18:00" } }, new Set(["2026-09-30"]), "2026-09-30");
  assert.equal(s.days, 2); assert.equal(s.overtime, 60); assert.equal(s.leaveDays, 1);
});

test("workdays between excludes weekends/holidays", () => {
  assert.deepEqual(workdaysBetween("2026-09-18", "2026-09-24"), ["2026-09-18", "2026-09-24"]);
});
