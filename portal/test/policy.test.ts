import test from "node:test";
import assert from "node:assert/strict";
import { mergeWrite, sanitizeForRead, validEmployees } from "../src/server/policy.ts";
import { postJournal } from "../src/lib/accounting.ts";
import { DEFAULT_AUTHORITY, routeFor } from "../src/lib/authority.ts";

const emps = [
  { id: "001", name: "長尾 晃佑", employment: "役員", job: "代表取締役", scheduled: 7.5, role: "admin" },
  { id: "002", name: "役員 太郎", employment: "役員", job: "取締役", scheduled: 7.5, role: "executive", dept: "経営", bossId: "001" },
  { id: "003", name: "社員 花子", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", dept: "営業部", bossId: "002" },
  { id: "004", name: "社員 次郎", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", dept: "営業部", bossId: "002" },
];
const day = (date: string, over = {}) => ({ date, kind: "出勤", start: "08:30", end: "17:00", brk: 60, ...over });
const wf = (over = {}) => ({ id: "WF-1", type: "経費精算", title: "t", applicantId: "003", amount: 1000, detail: "d", createdAt: "2026-09-01", status: "承認待ち", steps: routeFor(emps as never, DEFAULT_AUTHORITY, "経費精算", 1000, "003"), history: [{ at: "2026-09-01T00:00:00.000Z", by: "003", action: "申請" }], ...over });
const base = () => ({ employees: emps, conditions: { holidays: [] }, authority: DEFAULT_AUTHORITY, clients: [{ code: "C001", name: "A社", dept: "営業部", active: true }], files: [], mails: [], checks: [], assets: [], attendance: { "003": { "2026-09-01": day("2026-09-01") }, "004": {} }, news: [], workflows: [wf()], journal: [], jApprovals: {}, closed: ["2026-08"], audit: [], read: {} });

test("employee: no accounting/master; only own attendance; others' rows are minimal", () => {
  const r = sanitizeForRead(base(), "003", "employee")!;
  assert.equal(r.journal, undefined); assert.equal(r.closed, undefined);
  assert.deepEqual(Object.keys(r.attendance), ["003"]);
  assert.equal(Object.keys(r.employees.find((e: { id: string }) => e.id === "004")).includes("joined"), false);
  assert.equal(r.workflows.length, 1);
  const x = sanitizeForRead(base(), "004", "employee")!;
  assert.equal(x.workflows.length, 0); // 無関係の申請は見えない
});

test("executive sees everything read-only; admin same", () => {
  const e = sanitizeForRead(base(), "002", "executive")!;
  assert.deepEqual(Object.keys(e.attendance).sort(), ["003", "004"]);
  assert.ok(e.journal);
});

test("executive/employee cannot edit others' attendance, master, news; admin can", () => {
  const inc = { ...base(), attendance: { "003": {}, "004": { "2026-09-02": day("2026-09-02") } }, news: [{ id: "n" }], employees: [...emps].reverse() };
  for (const [uid, role] of [["003", "employee"], ["002", "executive"]] as const) {
    const r = mergeWrite(base(), inc, uid, role);
    assert.deepEqual(r.state.attendance["004"], {});
    assert.deepEqual(r.state.news, []);
    for (const k of ["attendance", "news", "employees"]) assert.ok(r.denied.includes(k), `${role}:${k}`);
  }
  const a = mergeWrite(base(), { attendance: { "004": { "2026-09-02": day("2026-09-02") } }, news: [{ id: "n" }] }, "001", "admin");
  assert.equal(a.denied.length, 0); assert.ok(a.state.attendance["004"]["2026-09-02"]);
});

test("employee can write own attendance but malformed days are rejected", () => {
  const ok = mergeWrite(base(), { attendance: { "003": { "2026-09-02": day("2026-09-02") } } }, "003", "employee");
  assert.equal(ok.denied.length, 0);
  for (const bad of [day("2026-09-03", { start: "99:99" }), day("2026-09-03", { kind: "謎" }), day("2026-09-03", { brk: -5 }), day("2026-09-04")]) {
    const r = mergeWrite(base(), { attendance: { "003": { "2026-09-03": bad } } }, "003", "employee");
    assert.ok(r.denied.includes("attendance"));
  }
});

test("employee master: president must stay admin, at least one admin, no duplicate ids", () => {
  assert.ok(validEmployees(emps));
  assert.ok(!validEmployees(emps.map((e) => (e.id === "001" ? { ...e, role: "employee" } : e))));
  assert.ok(!validEmployees(emps.filter((e) => e.id !== "001")));
  assert.ok(!validEmployees([...emps, { ...emps[2] }]));
});

test("accounting: admin only writes; append-only; closed month locked; SoD", () => {
  const b = base();
  const core = (date: string) => ({ date, memo: "m", source: "manual" as const, createdBy: "001", lines: [{ account: "6250", side: "D" as const, amount: 100 }, { account: "1110", side: "C" as const, amount: 100 }] });
  const ok = postJournal(b.journal as never, core("2026-09-30"));
  assert.ok(mergeWrite(b, { journal: ok }, "002", "executive").denied.includes("journal")); // 役員は閲覧のみ
  const r1 = mergeWrite(b, { journal: ok }, "001", "admin"); assert.equal(r1.denied.length, 0); assert.equal(r1.state.journal.length, 1);
  const closed = postJournal(b.journal as never, core("2026-08-15"));
  assert.ok(mergeWrite(b, { journal: closed }, "001", "admin").denied.includes("journal"));
  const id = r1.state.journal[0].id;
  assert.ok(mergeWrite(r1.state, { jApprovals: { [id]: { by: "001", at: "x" } } }, "001", "admin").denied.includes("jApprovals")); // 起票者本人
});

test("audit is server-appended with forced actor; closed months only grow", () => {
  const b = base();
  assert.deepEqual(mergeWrite(b, { closed: [] }, "001", "admin").state.closed, ["2026-08"]);
  const a = mergeWrite(b, { auditOutbox: [{ at: "t", actor: "001", action: "x" }], audit: [{ fake: 1 }] }, "003", "employee").state;
  assert.equal(a.audit.length, 1); assert.equal(a.audit[0].actor, "003"); assert.equal(a.audit[0].seq, 1);
});

const lead = (over = {}) => ({ ...base(), docs: [], events: [], remotes: [{ id: "r1", name: "A", kind: "RDP", host: "a.example", ownerId: "003" }, { id: "r2", name: "B", kind: "RDP", host: "b.example", ownerId: "004" }], kpis: [{ id: "k0", name: "全社", unit: "件", target: 10, ownerId: "", values: {} }, { id: "k1", name: "個人", unit: "件", target: 10, ownerId: "003", values: {} }, { id: "k2", name: "他人", unit: "件", target: 10, ownerId: "004", values: {} }], reports: { "003": { "2026-09-01": { date: "2026-09-01", done: "x", plan: "", issues: "", status: "提出済", lines: [{ clientCode: "C001", clientName: "A社", task: "訪問", hours: 2 }] } }, "004": {} }, docAck: {}, ...over });

test("read: employee sees only own reports/remotes and company+own KPIs; executive sees all", () => {
  const e = sanitizeForRead(lead(), "003", "employee")!;
  assert.deepEqual(Object.keys(e.reports), ["003"]); assert.deepEqual(e.remotes.map((r: { id: string }) => r.id), ["r1"]); assert.deepEqual(e.kpis.map((k: { id: string }) => k.id), ["k0", "k1"]);
  const x = sanitizeForRead(lead(), "002", "executive")!;
  assert.equal(x.remotes.length, 2); assert.equal(x.kpis.length, 3); assert.deepEqual(Object.keys(x.reports).sort(), ["003", "004"]);
});

test("write: docs admin-only, events exec/admin, remotes admin-only", () => {
  const doc = { id: "d", title: "t", category: "就業規則", version: "v1", effective: "2026-09-01", body: "b", updatedAt: "2026-09-01", updatedBy: "x" };
  assert.ok(mergeWrite(lead(), { docs: [doc] }, "002", "executive").denied.includes("docs"));
  assert.equal(mergeWrite(lead(), { docs: [doc] }, "001", "admin").denied.length, 0);
  const ev = { id: "e", title: "会議", date: "2026-09-10", start: "10:00", category: "会議", by: "002" };
  assert.ok(mergeWrite(lead(), { events: [ev] }, "003", "employee").denied.includes("events"));
  assert.equal(mergeWrite(lead(), { events: [ev] }, "002", "executive").denied.length, 0);
  assert.ok(mergeWrite(lead(), { events: [{ ...ev, date: "bad" }] }, "001", "admin").denied.includes("events"));
  assert.ok(mergeWrite(lead(), { remotes: [] }, "002", "executive").denied.includes("remotes"));
  assert.ok(mergeWrite(lead(), { remotes: [{ id: "r", name: "x", kind: "RDP", host: "bad host;", ownerId: "" }] }, "001", "admin").denied.includes("remotes"));
});

test("write: KPI owner may edit only own values; reports: own only, comments by leads", () => {
  const own = lead().kpis.map((k) => (k.id === "k1" ? { ...k, values: { "2026-09": 5 } } : k));
  const r = mergeWrite(lead(), { kpis: own.filter((k) => k.ownerId === "003") }, "003", "employee");
  assert.equal(r.denied.length, 0); assert.deepEqual(r.state.kpis.find((k: { id: string }) => k.id === "k1").values, { "2026-09": 5 });
  const tamper = lead().kpis.map((k) => (k.id === "k1" ? { ...k, target: 1 } : k.id === "k2" ? { ...k, values: { "2026-09": 1 } } : k));
  assert.ok(mergeWrite(lead(), { kpis: tamper }, "003", "employee").denied.includes("kpis"));
  // 日報：本人は自分の分のみ、コメント欄は触れない
  const rep = { date: "2026-09-02", done: "y", plan: "", issues: "", status: "提出済", lines: [{ clientCode: "C001", clientName: "A社", task: "訪問", hours: 2 }] };
  const w = mergeWrite(lead(), { reports: { "003": { "2026-09-02": { ...rep, comment: "自分で書いた", commentBy: "003" } }, "004": { "2026-09-02": rep } } }, "003", "employee");
  assert.ok(w.denied.includes("reports")); assert.equal(w.state.reports["003"]["2026-09-02"].comment, undefined); assert.equal(w.state.reports["004"]["2026-09-02"], undefined);
  // 役員は他人の日報にコメントのみ可（本文の改ざん不可）
  const ok = mergeWrite(lead(), { reports: { "003": { "2026-09-01": { ...lead().reports["003"]["2026-09-01"], comment: "確認しました" } } } }, "002", "executive");
  assert.equal(ok.denied.length, 0); assert.equal(ok.state.reports["003"]["2026-09-01"].commentBy, "002");
  const bad = mergeWrite(lead(), { reports: { "003": { "2026-09-01": { ...lead().reports["003"]["2026-09-01"], done: "改ざん", comment: "c" } } } }, "002", "executive");
  assert.ok(bad.denied.includes("reports")); assert.equal(bad.state.reports["003"]["2026-09-01"].done, "x");
});
