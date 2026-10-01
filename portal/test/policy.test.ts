import test from "node:test";
import assert from "node:assert/strict";
import { mergeWrite, sanitizeForRead, validEmployees } from "../src/server/policy.ts";
import { postJournal } from "../src/lib/accounting.ts";

const emps = [
  { id: "001", name: "長尾 晃佑", employment: "役員", job: "代表取締役", scheduled: 7.5, role: "admin" },
  { id: "002", name: "役員 太郎", employment: "役員", job: "取締役", scheduled: 7.5, role: "executive" },
  { id: "003", name: "社員 花子", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee" },
  { id: "004", name: "社員 次郎", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee" },
];
const day = (date: string, over = {}) => ({ date, kind: "出勤", start: "08:30", end: "17:00", brk: 60, ...over });
const wf = (over = {}) => ({ id: "WF-1", type: "経費精算", title: "t", applicantId: "003", amount: 1000, detail: "d", createdAt: "2026-09-01", status: "承認待ち", steps: [{ approverId: "002", label: "役員", state: "承認待ち" }, { approverId: "001", label: "社長", state: "待機" }], ...over });
const base = () => ({ employees: emps, conditions: { holidays: [] }, attendance: { "003": { "2026-09-01": day("2026-09-01") }, "004": {} }, news: [], workflows: [wf()], journal: [], jApprovals: {}, closed: ["2026-08"], audit: [], read: {} });

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

test("workflow: only current approver may approve; applicant cannot self-approve; no step skipping", () => {
  const approve = wf({ steps: [{ approverId: "002", label: "役員", state: "承認", at: "x" }, { approverId: "001", label: "社長", state: "承認待ち" }] });
  assert.ok(mergeWrite(base(), { workflows: [approve] }, "003", "employee").denied.includes("workflows"));
  assert.equal(mergeWrite(base(), { workflows: [approve] }, "002", "executive").denied.length, 0);
  const skip = wf({ status: "承認済", steps: [{ approverId: "002", label: "役員", state: "承認" }, { approverId: "001", label: "社長", state: "承認" }] });
  assert.ok(mergeWrite(base(), { workflows: [skip] }, "002", "executive").denied.includes("workflows"));
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
