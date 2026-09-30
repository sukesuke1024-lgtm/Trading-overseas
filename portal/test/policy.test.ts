import test from "node:test";
import assert from "node:assert/strict";
import { mergeWrite, sanitizeForRead } from "../src/server/policy.ts";
import { append } from "../src/lib/chain.ts";
import { buildSeedJournal, postJournal } from "../src/lib/accounting.ts";

const wf = (over = {}) => ({ id: "WF-1", type: "経費精算", title: "t", applicantId: "E1012", amount: 1000, detail: "d", createdAt: "2026-09-01", status: "承認待ち", steps: [{ approverId: "E1007", label: "所属長", state: "承認待ち" }, { approverId: "E1004", label: "経理", state: "待機" }], ...over });
const base = () => ({ news: [], workflows: [wf()], punches: { E1012: { "2026-09-01": { in: "09:00" } }, E1007: {} }, journal: buildSeedJournal(), jApprovals: {}, payroll: { "2026-09": { status: "確定", rows: [{ id: "E1012" }, { id: "E1007" }] } }, closed: ["2026-08"], audit: [], tickets: [], bookings: [], read: {}, progress: {} });

test("employee cannot read accounting; sees only own punches & own confirmed payslip", () => {
  const r = sanitizeForRead(base(), "E1012", "employee")!;
  assert.equal(r.journal, undefined); assert.equal(r.closed, undefined);
  assert.deepEqual(Object.keys(r.punches), ["E1012"]);
  assert.deepEqual(r.payroll["2026-09"].rows, [{ id: "E1012" }]);
  const f = sanitizeForRead(base(), "E1004", "finance")!;
  assert.ok(f.journal.length > 100); assert.equal(f.payroll["2026-09"].rows.length, 2);
});

test("employee cannot write accounting, others' punches or news", () => {
  const inc = { ...base(), journal: [], payroll: {}, closed: [], news: [{ id: "x" }], punches: { E1012: {}, E1007: { "2026-09-01": { in: "01:00" } } } };
  const { state, denied } = mergeWrite(base(), inc, "E1012", "employee");
  assert.ok(state.journal.length > 100); assert.deepEqual(state.punches.E1007, {}); assert.deepEqual(state.news, []);
  for (const k of ["journal", "punches", "news"]) assert.ok(denied.includes(k), k);
});

test("workflow: only current approver may approve; applicant cannot self-approve", () => {
  const approve = wf({ status: "承認待ち", steps: [{ approverId: "E1007", label: "所属長", state: "承認", at: "x" }, { approverId: "E1004", label: "経理", state: "承認待ち" }] });
  assert.equal(mergeWrite(base(), { workflows: [approve] }, "E1012", "employee").denied.includes("workflows"), true); // applicant
  assert.equal(mergeWrite(base(), { workflows: [approve] }, "E1007", "approver").denied.length, 0);
  const skip = wf({ status: "承認済", steps: [{ approverId: "E1007", label: "所属長", state: "承認" }, { approverId: "E1004", label: "経理", state: "承認" }] });
  assert.equal(mergeWrite(base(), { workflows: [skip] }, "E1007", "approver").denied.includes("workflows"), true); // 段階飛ばし
});

test("journal: append-only, balanced, not in closed month; SoD on approval", () => {
  const b = base();
  const ok = postJournal(b.journal, { date: "2026-09-30", memo: "m", source: "manual", createdBy: "E1013", lines: [{ account: "6250", side: "D", amount: 100 }, { account: "1110", side: "C", amount: 100 }] });
  const r1 = mergeWrite(b, { journal: ok }, "E1013", "finance"); assert.equal(r1.denied.length, 0); assert.equal(r1.state.journal.length, b.journal.length + 1);
  const closed = postJournal(b.journal, { date: "2026-08-15", memo: "m", source: "manual", createdBy: "E1013", lines: [{ account: "6250", side: "D", amount: 100 }, { account: "1110", side: "C", amount: 100 }] });
  assert.ok(mergeWrite(b, { journal: closed }, "E1013", "finance").denied.includes("journal"));
  const tampered = structuredClone(b.journal); tampered[3].memo = "改ざん";
  assert.ok(mergeWrite(b, { journal: tampered }, "E1013", "finance").denied.includes("journal"));
  const removed = b.journal.slice(0, -1);
  assert.ok(mergeWrite(b, { journal: removed }, "E1013", "finance").denied.includes("journal"));
  const id = r1.state.journal[r1.state.journal.length - 1].id;
  assert.ok(mergeWrite(r1.state, { jApprovals: { [id]: { by: "E1013", at: "x" } } }, "E1013", "finance").denied.includes("jApprovals")); // 起票者本人
  assert.equal(mergeWrite(r1.state, { jApprovals: { [id]: { by: "E1004", at: "x" } } }, "E1004", "finance").denied.length, 0);
});

test("closed months can only grow; confirmed payroll immutable; audit is server-appended with forced actor", () => {
  const b = base();
  assert.deepEqual(mergeWrite(b, { closed: [] }, "E1004", "finance").state.closed, ["2026-08"]);
  const r = mergeWrite(b, { payroll: { "2026-09": { status: "計算済", rows: [] } } }, "E1004", "finance");
  assert.equal(r.state.payroll["2026-09"].status, "確定");
  const a = mergeWrite(b, { auditOutbox: [{ at: "t", actor: "E1001", action: "x" }], audit: [{ fake: 1 }] }, "E1012", "employee").state;
  assert.equal(a.audit.length, 1); assert.equal(a.audit[0].actor, "E1012"); assert.equal(a.audit[0].seq, 1);
  void append;
});
