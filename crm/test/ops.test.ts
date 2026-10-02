import test from "node:test";
import assert from "node:assert/strict";
import { applyOps, sanitizeForRead } from "../src/server/ops.ts";
import { diffData } from "../src/lib/sync.ts";
import { makeSeed } from "../src/lib/seed.ts";

const d = makeSeed();
const sales = d.users.find((u) => u.role === "sales")!, mgr = d.users.find((u) => u.role === "manager")!, adm = d.users.find((u) => u.role === "admin")!;
const mine = d.organizations.find((o) => o.ownerId === sales.id)!;
const other = d.organizations.find((o) => o.ownerId !== sales.id)!;

test("diff → apply で同じ結果になる", () => {
  const next = { ...d, organizations: d.organizations.map((o) => (o.id === mine.id ? { ...o, memo: "x" } : o)), audit: [{ id: "a1", at: "", userId: "?", action: "更新", entity: "顧客", label: "t" }, ...d.audit] };
  const ops = diffData(d, next);
  const r = applyOps(d, ops, { id: sales.id, role: "sales" });
  assert.equal(r.denied.length, 0);
  assert.equal(r.data.organizations.find((o) => o.id === mine.id)!.memo, "x");
  assert.equal(r.data.audit[0].userId, sales.id); // 監査ログの操作者はサーバーが決める
});
test("Sales は他人の顧客を変更・削除できない", () => {
  const r = applyOps(d, [{ k: "organizations", up: [{ ...other, memo: "hack" }] }, { k: "organizations", del: [mine.id] }], { id: sales.id, role: "sales" });
  assert.equal(r.denied.length, 2);
  assert.equal(r.data.organizations.find((o) => o.id === other.id)!.memo, other.memo);
  assert.ok(r.data.organizations.some((o) => o.id === mine.id));
});
test("Sales は担当を自分以外にして作れない／名簿・与信方針は変更不可", () => {
  const r = applyOps(d, [{ k: "organizations", up: [{ ...mine, id: "new1", ownerId: mgr.id }] }, { k: "users", up: [{ ...sales, role: "admin" }] }, { k: "creditPolicy", set: { ...d.creditPolicy, floorLimitJPY: 1 } }], { id: sales.id, role: "sales" });
  assert.equal(r.denied.length, 3);
  assert.equal(r.data.users.find((u) => u.id === sales.id)!.role, "sales");
});
test("与信審査の承認は Manager 以上で、承認者はサーバーが本人に確定する", () => {
  const rv = d.creditReviews.find((x) => x.status === "submitted")!;
  const s = applyOps(d, [{ k: "creditReviews", up: [{ ...rv, status: "approved", approverId: sales.id }] }], { id: sales.id, role: "sales" });
  assert.equal(s.denied.length, 1);
  const m = applyOps(d, [{ k: "creditReviews", up: [{ ...rv, status: "approved", approverId: "someone-else" }] }], { id: mgr.id, role: "manager" });
  assert.equal(m.denied.length, 0);
  assert.equal(m.data.creditReviews.find((x) => x.id === rv.id)!.approverId, mgr.id);
});
test("最後の管理者は降格・削除できない", () => {
  const onlyAdmin = { ...d, users: d.users.map((u) => (u.role === "admin" && u.id !== adm.id ? { ...u, role: "manager" as const } : u)) };
  const r = applyOps(onlyAdmin, [{ k: "users", up: [{ ...adm, role: "sales" }] }, { k: "users", del: [adm.id] }], { id: adm.id, role: "admin" });
  assert.equal(r.denied.length, 2);
});
test("Sales への配信では仕入原価・売上・仕訳を渡さない", () => {
  const s = sanitizeForRead(d, "sales");
  assert.equal(s.journals.length + s.sales.length, 0);
  assert.ok(s.products.every((p) => p.costJPY === 0));
  assert.equal(sanitizeForRead(d, "manager"), d);
});
