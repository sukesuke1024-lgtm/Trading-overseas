import test from "node:test";
import assert from "node:assert/strict";
import { validatePin } from "../src/lib/pin.ts";
import { addDays, addMonths, buildOrg, eventsOn, groupByDept, monthGrid, paidLeave, rdpFile, remoteLink, kpiAttainment, weekStart } from "../src/lib/biz.ts";
import type { Employee } from "../src/lib/data.ts";

const emp = (over: Partial<Employee> & { id: string }): Employee => ({ name: over.id, employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", ...over });

test("PIN: 4-8 digits, rejects trivial", () => {
  assert.equal(validatePin("135790"), null);
  assert.equal(validatePin("8264"), null);
  for (const bad of ["123", "123456789", "abcd", "1234", "0000", "111111", "123456", "654321", "2468a", "", 1234, null]) assert.notEqual(validatePin(bad), null, String(bad));
});

test("calendar helpers: week/month grid and multi-day events", () => {
  assert.equal(weekStart("2026-10-01"), "2026-09-27"); // 木曜 → 日曜
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  const g = monthGrid("2026-10");
  assert.equal(g.length % 7, 0); assert.equal(g[0], "2026-09-27"); assert.ok(g.includes("2026-10-31"));
  const ev = [{ id: "a", title: "出張", date: "2026-10-05", endDate: "2026-10-07", category: "その他", by: "001" }, { id: "b", title: "会議", date: "2026-10-06", start: "10:00", category: "会議", by: "001" }];
  assert.deepEqual(eventsOn(ev, "2026-10-06").map((e) => e.id), ["a", "b"]);
  assert.equal(eventsOn(ev, "2026-10-08").length, 0);
});

test("org chart: boss hierarchy, orphan roots, cycles do not hang", () => {
  const list = [emp({ id: "001" }), emp({ id: "002", bossId: "001" }), emp({ id: "003", bossId: "002" }), emp({ id: "004", bossId: "999" }), emp({ id: "005", bossId: "006" }), emp({ id: "006", bossId: "005" })];
  const tree = buildOrg(list);
  const flat = (n: ReturnType<typeof buildOrg>): string[] => n.flatMap((x) => [x.emp.id, ...flat(x.children)]);
  assert.deepEqual(new Set(flat(tree)), new Set(list.map((e) => e.id))); // 全員が一度だけ現れる
  assert.equal(flat(tree).length, list.length);
  assert.deepEqual(tree.find((n) => n.emp.id === "001")?.children[0].children[0].emp.id, "003");
  assert.deepEqual(groupByDept([emp({ id: "1", dept: "営業部" }), emp({ id: "2" })]).map((g) => g.dept), ["（部署未設定）", "営業部"]);
});

test("paid leave: statutory grant, carry-over, 5-day obligation, manual override", () => {
  const att = (dates: string[]) => Object.fromEntries(dates.map((d) => [d, { date: d, kind: "有給休暇" as const }]));
  // 入社 2024-04-01 → 2024-10-01 に10日、2025-10-01 に11日（繰越=前期の未消化）
  const e = emp({ id: "1", joined: "2024-04-01" });
  assert.equal(paidLeave(e, undefined, "2024-09-30"), null); // 6か月未満
  const p1 = paidLeave(e, att(["2024-11-01", "2024-12-02", "2025-01-06"]), "2025-02-01")!;
  assert.equal(p1.statutory, 10); assert.equal(p1.used, 3); assert.equal(p1.remaining, 7); assert.equal(p1.grantDate, "2024-10-01"); assert.equal(p1.nextGrant, "2025-10-01"); assert.equal(p1.needMore, 2); assert.equal(p1.obligation, true);
  const p2 = paidLeave(e, att(["2024-11-01", "2024-12-02", "2025-01-06"]), "2025-10-02")!;
  assert.equal(p2.statutory, 11); assert.equal(p2.carry, 7); assert.equal(p2.granted, 18); assert.equal(p2.used, 0);
  const m = paidLeave(emp({ id: "2", joined: "2024-04-01", paidGranted: 5 }), undefined, "2025-02-01")!;
  assert.equal(m.manual, true); assert.equal(m.granted, 5); assert.equal(m.obligation, false);
  assert.equal(paidLeave(emp({ id: "3" }), undefined, "2025-02-01"), null);
});

test("KPI attainment: normal and lower-is-better", () => {
  const k = { id: "1", name: "売上", unit: "万円", target: 100, ownerId: "", values: { "2026-10": 80 } };
  assert.equal(kpiAttainment(k, "2026-10").rate, 0.8); assert.equal(kpiAttainment(k, "2026-10").ok, false);
  assert.equal(kpiAttainment(k, "2026-09").rate, null);
  const lo = { ...k, target: 20, lowerIsBetter: true, values: { "2026-10": 10 } };
  assert.equal(kpiAttainment(lo, "2026-10").ok, true);
});

test("remote links: validates hosts, builds rdp file", () => {
  const r = { id: "1", name: "PC", kind: "RDP" as const, host: "pc-01.example.internal", port: 3390, ownerId: "003" };
  assert.deepEqual(remoteLink(r), { href: "pc-01.example.internal:3390", kind: "rdp" });
  assert.match(rdpFile(r, "003"), /full address:s:pc-01.example.internal:3390/);
  assert.equal(remoteLink({ ...r, host: "x; rm -rf /" }), null);
  assert.equal(remoteLink({ ...r, kind: "WEB", host: "javascript:alert(1)" }), null);
  assert.equal(remoteLink({ ...r, kind: "WEB", host: "https://remote.example.com/a" })?.kind, "url");
  assert.equal(remoteLink({ ...r, kind: "VNC", port: undefined })?.href, "vnc://pc-01.example.internal");
});
