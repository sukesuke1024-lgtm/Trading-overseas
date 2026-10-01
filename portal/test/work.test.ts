import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONDITIONS as C, calcDay, summarize, holidaySet, isHoliday, toMin, fmtH, overtimeLevel, autoKind, daysOf } from "../src/lib/work.ts";

const hs = holidaySet(C);
const day = (date: string, start: string, end: string, brk = 60, kind: "出勤" | "休日出勤" = "出勤") => ({ date, kind, start, end, brk });

test("time parsing incl. 25:00 and invalid", () => {
  assert.equal(toMin("8:30"), 510); assert.equal(toMin("25:00"), 1500); assert.equal(toMin("48:00"), null); assert.equal(toMin("8:60"), null); assert.equal(toMin(""), null);
  assert.equal(fmtH(7.5), "7:30"); assert.equal(fmtH(0.33), "0:20");
});

test("holiday rule: weekends + holiday master", () => {
  assert.equal(isHoliday("2026-10-03", hs), true); // 土
  assert.equal(isHoliday("2026-10-04", hs), true); // 日
  assert.equal(isHoliday("2026-10-12", hs), true); // スポーツの日（月）
  assert.equal(isHoliday("2026-10-13", hs), false);
  assert.equal(isHoliday("2026-08-13", hs), true); // お盆休み
});

test("standard day 8:30-17:00/60 = 7.5h, no overtime", () => {
  const x = calcDay(day("2026-10-13", "8:30", "17:00"), 7.5, hs);
  assert.deepEqual([x.worked, x.scheduled, x.legalIn, x.legalOut, x.night], [7.5, 7.5, 0, 0, 0]);
});

test("legal-in / legal-out split (8:30-19:00/60 = 9.5h)", () => {
  const x = calcDay(day("2026-10-13", "8:30", "19:00"), 7.5, hs);
  assert.deepEqual([x.worked, x.scheduled, x.legalIn, x.legalOut], [9.5, 7.5, 0.5, 1.5]);
});

test("night work: 22:00-25:00 counted once (Excel formula double-counts 24-25)", () => {
  const x = calcDay(day("2026-10-13", "14:00", "25:00", 60), 7.5, hs);
  assert.equal(x.worked, 10); assert.equal(x.night, 3); assert.equal(x.nightExcel, 4);
  const early = calcDay(day("2026-10-13", "4:00", "13:00", 60), 7.5, hs); assert.equal(early.night, 1);
});

test("overnight shift end<start rolls to next day", () => {
  const x = calcDay(day("2026-10-13", "22:00", "6:00", 60), 7.5, hs);
  assert.equal(x.worked, 7); assert.equal(x.night, 7);
});

test("holiday work: Sunday = legal holiday, Saturday = non-legal; no scheduled/overtime buckets", () => {
  const sun = calcDay(day("2026-10-04", "9:00", "17:00", 60, "休日出勤"), 7.5, hs);
  assert.deepEqual([sun.worked, sun.scheduled, sun.legalIn, sun.legalOut, sun.holidayWork], [7, 0, 0, 0, 7]);
  const s = summarize([day("2026-10-04", "9:00", "17:00", 60, "休日出勤"), day("2026-10-03", "9:00", "13:00", 0, "休日出勤")], 7.5, hs);
  assert.equal(s.legalHoliday, 7); assert.equal(s.nonLegalHoliday, 4); assert.equal(s.holidayWorkDays, 2); assert.equal(s.scheduled, 0);
});

test("non-work kinds and incomplete input give 0; invalid break flagged", () => {
  for (const kind of ["有給休暇", "欠勤", "休み"] as const) assert.equal(calcDay({ date: "2026-10-13", kind, start: "9:00", end: "18:00" }, 7.5, hs).worked, 0);
  assert.equal(calcDay({ date: "2026-10-13", kind: "出勤", start: "9:00" }, 7.5, hs).worked, 0);
  assert.match(calcDay(day("2026-10-13", "9:00", "10:00", 90), 7.5, hs).invalid!, /休憩/);
});

test("monthly summary: counts, over-60h, flows like 月次集計", () => {
  const days = daysOf("2026-10").filter((d) => !isHoliday(d, hs)).map((d) => day(d, "8:30", "20:30", 60)); // 平日 毎日11h
  const s = summarize([...days, { date: "2026-10-05", kind: "有給休暇" } as never, { date: "2026-10-06", kind: "欠勤" } as never], 7.5, hs);
  // 平日 20日（10/12 スポーツの日を除く）→ 有給/欠勤の2日は上で上書きではなく追加なので出勤は日数分
  assert.equal(s.workDays, days.length); assert.equal(s.paidDays, 1); assert.equal(s.absentDays, 1);
  assert.equal(s.legalOut, days.length * 3); assert.equal(s.legalIn, days.length * 0.5); assert.equal(s.scheduled, days.length * 7.5);
  assert.equal(s.over60, Math.max(0, days.length * 3 - 60));
});

test("36 agreement levels and auto kind", () => {
  assert.equal(overtimeLevel(30).level, "ok"); assert.equal(overtimeLevel(40).level, "notice"); assert.equal(overtimeLevel(46).level, "warn");
  assert.equal(overtimeLevel(81).level, "danger"); assert.equal(overtimeLevel(70, 101).level, "danger");
  assert.equal(autoKind("2026-10-04", hs), "休日出勤"); assert.equal(autoKind("2026-10-13", hs), "出勤"); assert.equal(autoKind("2026-10-13", hs, "有給休暇"), "有給休暇");
});
