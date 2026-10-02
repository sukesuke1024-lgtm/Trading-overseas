// サーバー側の書き込み規則（権限）。画面側の制限は“見せないだけ”なので、ここで同じ規則を必ず強制する。
//  admin：すべて ／ manager：業務データすべて（従業員名簿・与信方針は除く）／ sales：自分の担当分のみ
import type { AuditEntry, Data, Role } from "../lib/types.ts";
import { LIST_KEYS, type ListKey, type Op } from "../lib/sync.ts";

export interface Actor { id: string; role: Role }
type Rec = Record<string, unknown> & { id: string };
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && typeof (x as Rec).id === "string" && (x as Rec).id.length > 0 && (x as Rec).id.length < 80;
const mgr = (a: Actor) => a.role === "admin" || a.role === "manager";

type Verdict = true | string;
/** レコード単位の許可判定。old: 現在のレコード（なければ undefined）、nu: 新しいレコード（削除なら undefined） */
function allowed(k: ListKey, a: Actor, old: Rec | undefined, nu: Rec | undefined, d: Data): Verdict {
  if (a.role === "admin") return true;
  const m = mgr(a);
  switch (k) {
    case "users": case "teams": return "従業員名簿・チームの変更は管理者のみです";
    case "products": case "notices": case "forwards": case "sales": case "journals": return m ? true : "この操作は Manager 以上のみです";
    case "organizations": case "deals": {
      if (m) return nu ? true : true;
      if (!nu) return "削除は Manager 以上のみです";
      if (nu.ownerId !== a.id || (old && old.ownerId !== a.id)) return "自分の担当ではないため変更できません";
      return true;
    }
    case "contacts": {
      if (m) return true;
      const orgId = (nu ?? old)?.orgId as string | undefined;
      const org = d.organizations.find((o) => o.id === orgId);
      return org && org.ownerId === a.id ? true : "自分の担当顧客の担当者のみ変更できます";
    }
    case "tasks": {
      if (m) return true;
      if (nu && nu.assigneeId !== a.id) return "自分のTask以外は変更できません";
      if (old && old.assigneeId !== a.id) return "自分のTask以外は変更できません";
      return true;
    }
    case "activities": {
      if (m) return true;
      if (nu && nu.userId !== a.id) return "自分の活動のみ記録・変更できます";
      if (old && old.userId !== a.id) return "自分の活動のみ記録・変更できます";
      return true;
    }
    case "mailLogs": return old ? (m ? true : "配信記録の変更はできません") : nu && nu.userId === a.id ? true : "配信記録の送信者が一致しません";
    case "creditReviews": {
      if (!nu) return m ? true : "削除は Manager 以上のみです";
      const decided = nu.status === "approved" || nu.status === "rejected";
      if (m) return decided && nu.approverId !== a.id && (!old || old.status !== nu.status) ? "承認者は操作した本人である必要があります" : true;
      if (decided) return "承認・否認は Manager 以上のみです";
      if (old && (old.status === "approved" || old.status === "rejected")) return "承認済みの審査は Manager 以上のみ変更できます";
      return true;
    }
  }
}

export interface ApplyResult { data: Data; denied: string[] }
/** 変更を現在のデータに適用する。許可されない変更は無視して理由を返す */
export function applyOps(cur: Data, ops: Op[], a: Actor, now = new Date().toISOString()): ApplyResult {
  const d: Data = { ...cur };
  const denied: string[] = [];
  for (const op of ops) {
    if (op.k === "creditPolicy") {
      if (a.role !== "admin") { denied.push("与信方針の変更は管理者のみです"); continue; }
      if (typeof op.set === "object" && op.set) d.creditPolicy = op.set as Data["creditPolicy"];
      continue;
    }
    if (op.k === "audit") {
      const add: AuditEntry[] = (Array.isArray(op.add) ? op.add : []).slice(0, 50).filter(isRec).map((x) => ({ id: x.id, at: now, userId: a.id, action: String(x.action ?? "").slice(0, 80), entity: String(x.entity ?? "").slice(0, 40), label: String(x.label ?? "").slice(0, 300) }));
      d.audit = [...add, ...d.audit].slice(0, 500);
      continue;
    }
    if (!(LIST_KEYS as readonly string[]).includes(op.k)) { denied.push(`不明な項目: ${String(op.k)}`); continue; }
    const k = op.k;
    let list = [...(d[k] as unknown as Rec[])];
    for (const nu0 of Array.isArray(op.up) ? op.up : []) {
      if (!isRec(nu0)) continue;
      let nu: Rec = nu0;
      const i = list.findIndex((x) => x.id === nu.id), old = i >= 0 ? list[i] : undefined;
      if (k === "mailLogs" && !old) nu = { ...nu, userId: a.id, at: now };
      if (k === "activities" && !old && a.role === "sales") nu = { ...nu, userId: a.id };
      if (k === "creditReviews" && nu.approverId !== undefined && (nu.status === "approved" || nu.status === "rejected") && mgr(a) && (!old || old.status !== nu.status)) nu = { ...nu, approverId: a.id, decidedAt: now };
      const v = allowed(k, a, old, nu, d);
      if (v !== true) { denied.push(`${k}: ${v}`); continue; }
      if (k === "users") { // 最後の管理者を降格できない
        const admins = list.filter((x) => x.role === "admin" && x.id !== nu.id).length + (nu.role === "admin" ? 1 : 0);
        if (admins === 0) { denied.push("users: 最後の管理者は変更できません"); continue; }
      }
      if (i >= 0) list[i] = nu; else list = [nu, ...list];
    }
    for (const id of Array.isArray(op.del) ? op.del : []) {
      const old = list.find((x) => x.id === id);
      if (!old) continue;
      const v = allowed(k, a, old, undefined, d);
      if (v !== true) { denied.push(`${k}: ${v}`); continue; }
      if (k === "users" && (id === a.id || list.filter((x) => x.role === "admin" && x.id !== id).length === 0)) { denied.push("users: 自分自身・最後の管理者は削除できません"); continue; }
      list = list.filter((x) => x.id !== id);
    }
    (d as unknown as Record<string, unknown>)[k] = list;
  }
  return { data: d, denied };
}

/** 読み取り時の絞り込み。Sales には、仕入原価・売上と仕訳を渡さない（画面で隠すだけでなく、そもそも送らない） */
export function sanitizeForRead(d: Data, role: Role): Data {
  if (role !== "sales") return d;
  return { ...d, sales: [], journals: [], products: d.products.map((p) => ({ ...p, costJPY: 0 })) };
}
