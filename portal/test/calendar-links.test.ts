import test from "node:test";
import assert from "node:assert/strict";
import { googleCalendarUrl, icsOf, outlookCalendarUrl } from "../src/lib/calendar-links.ts";

test("Google: 時刻つき・終日", () => {
  const u = new URL(googleCalendarUrl({ title: "商談", date: "2026-10-05", start: "09:30", end: "10:30", note: "メモ" }));
  assert.equal(u.searchParams.get("dates"), "20261005T093000/20261005T103000");
  assert.equal(u.searchParams.get("ctz"), "Asia/Tokyo");
  assert.equal(new URL(googleCalendarUrl({ title: "行事", date: "2026-10-31" })).searchParams.get("dates"), "20261031/20261101"); // 終日の終了は翌日
  assert.equal(new URL(googleCalendarUrl({ title: "出張", date: "2026-10-05", endDate: "2026-10-07" })).searchParams.get("dates"), "20261005/20261008");
});
test("Outlook: 日付と時刻", () => {
  const u = new URL(outlookCalendarUrl({ title: "会議", date: "2026-10-05", start: "13:00", end: "14:00" }));
  assert.equal(u.searchParams.get("startdt"), "2026-10-05T13:00:00");
  assert.equal(u.searchParams.get("enddt"), "2026-10-05T14:00:00");
  assert.equal(u.hostname, "outlook.office.com");
});
test("ics: 必須項目とエスケープ", () => {
  const ics = icsOf([{ id: "e1", title: "A,B;C", date: "2026-10-05", start: "09:00", end: "10:00", note: "1行目\n2行目" }], new Date("2026-10-01T00:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;TZID=Asia\/Tokyo:20261005T090000/);
  assert.match(ics, /SUMMARY:A\\,B\;C/);
  assert.match(ics, /DESCRIPTION:1行目\\n2行目/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
