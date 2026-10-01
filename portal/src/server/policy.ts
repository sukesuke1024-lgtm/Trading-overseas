// 共有DB（State）の読み書きに対するサーバー側の権限検証。
// クライアントの申告は信用せず、「誰が・どの項目を・どう変えてよいか」をここで強制する。
import { can, type RoleName } from "../lib/perm.ts";
import { append, verifyChain } from "../lib/chain.ts";
import { checkEntry } from "../lib/accounting.ts";
import { KINDS, toMin } from "../lib/work.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = Record<string, any>;
const PRIVATE = ["journal", "jApprovals", "closed", "ipo"] as const;
const PRESIDENT_ID = "001";

/** 読み出し：権限のない項目は返さない（DevTools・APIで直接見られないようにする） */
export function sanitizeForRead(state: S | null, uid: string, role: RoleName): S | null {
  if (!state) return state;
  const out: S = { ...state };
  if (!can.viewAccounting(role)) for (const k of PRIVATE) delete out[k];
  if (!can.viewAllAttendance(role) && out.attendance) out.attendance = { [uid]: out.attendance[uid] ?? {} };
  if (!can.viewEmployees(role) && out.employees) {
    // 従業員には、表示に必要な最小限（番号・氏名・職種・権限）と自分自身の情報だけ返す
    out.employees = out.employees.map((e: S) => (e.id === uid ? e : { id: e.id, name: e.name, job: e.job, employment: e.employment, scheduled: e.scheduled, role: e.role }));
  }
  if (!can.viewAllWorkflows(role) && out.workflows) out.workflows = out.workflows.filter((w: S) => w.applicantId === uid || w.steps?.some((s: S) => s.approverId === uid));
  if (!can.audit(role) && out.audit) out.audit = out.audit.filter((a: S) => a.actor === uid).slice(-50);
  if (!can.viewAllAttendance(role) && out.read) out.read = { [uid]: out.read[uid] ?? [] };
  return out;
}

function validWf(o: S, n: S, uid: string): boolean {
  for (const k of ["id", "applicantId", "type", "title", "amount", "detail", "createdAt", "from", "to", "category", "taxKind", "invoiceNo"]) if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) return false;
  const same = (i: number) => JSON.stringify(o.steps[i]) === JSON.stringify(n.steps[i]);
  if (o.steps.length !== n.steps.length) return false;
  if (n.status === "取下げ" && o.status === "承認待ち" && o.applicantId === uid) return o.steps.every((_: unknown, i: number) => same(i));
  if (o.status !== "承認待ち") return false;
  const idx = o.steps.findIndex((s: S) => s.state === "承認待ち");
  if (idx < 0 || o.steps[idx].approverId !== uid) return false;
  if (o.steps.some((_: unknown, i: number) => i !== idx && i !== idx + 1 && !same(i))) return false;
  const st = n.steps[idx];
  if (st.approverId !== uid || !["承認", "差戻し", "却下"].includes(st.state)) return false;
  if (st.state === "承認") return idx + 1 < o.steps.length ? n.steps[idx + 1].state === "承認待ち" && n.status === "承認待ち" : n.status === "承認済";
  return n.status === st.state && (idx + 1 >= o.steps.length || same(idx + 1));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 勤怠1日分の形式検証。不正なものは取り込まない */
export function validDay(date: string, d: S): boolean {
  if (!DATE.test(date) || d?.date !== date || !KINDS.includes(d.kind)) return false;
  for (const k of ["start", "end"]) if (d[k] != null && d[k] !== "" && toMin(d[k]) == null) return false;
  if (d.brk != null && !(Number.isInteger(d.brk) && d.brk >= 0 && d.brk <= 600)) return false;
  if (d.note != null && (typeof d.note !== "string" || d.note.length > 200)) return false;
  return true;
}

/** 従業員マスタの検証：番号の重複・社長の削除/降格・管理者ゼロを許さない */
export function validEmployees(list: S[]): boolean {
  if (!Array.isArray(list) || list.length > 500) return false;
  const ids = new Set<string>();
  for (const e of list) {
    if (typeof e?.id !== "string" || !/^[A-Za-z0-9]{1,12}$/.test(e.id) || ids.has(e.id) || typeof e.name !== "string" || !e.name.trim() || !["employee", "executive", "admin"].includes(e.role)) return false;
    ids.add(e.id);
  }
  const pres = list.find((e) => e.id === PRESIDENT_ID);
  return !!pres && pres.role === "admin" && list.some((e) => e.role === "admin");
}

/** 書き込み：サーバーの現状（cur）に、許可された変更だけを取り込む。拒否した項目は denied に列挙 */
export function mergeWrite(cur: S | null, inc: S, uid: string, role: RoleName): { state: S; denied: string[] } {
  const base: S = cur ?? {};
  const out: S = { ...base };
  const denied: string[] = [];
  const deny = (k: string) => { if (!denied.includes(k)) denied.push(k); };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // 従業員マスタ・勤怠の条件設定・お知らせ：管理者のみ
  if (inc.employees !== undefined && !same(inc.employees, base.employees)) { if (can.manageEmployees(role) && validEmployees(inc.employees)) out.employees = inc.employees; else deny("employees"); }
  if (inc.conditions !== undefined && !same(inc.conditions, base.conditions)) { if (can.manageEmployees(role)) out.conditions = inc.conditions; else deny("conditions"); }
  if (inc.news !== undefined && !same(inc.news, base.news)) { if (can.admin(role)) out.news = inc.news; else deny("news"); }

  // 勤怠：本人分は本人が、他人分は管理者のみ（役員は閲覧のみ）。形式が不正な日は取り込まない
  if (inc.attendance) {
    out.attendance = { ...(base.attendance ?? {}) };
    const known = new Set<string>((out.employees ?? base.employees ?? []).map((e: S) => e.id));
    for (const [emp, days] of Object.entries(inc.attendance as S)) {
      if (same(days, base.attendance?.[emp])) continue;
      const allowed = emp === uid || can.editAttendanceOfOthers(role);
      const ok = allowed && known.has(emp) && days && Object.entries(days as S).every(([date, d]) => validDay(date, d));
      if (ok) out.attendance[emp] = days; else deny("attendance");
    }
  }
  // 既読：本人分のみ
  if (inc.read) {
    out.read = { ...(base.read ?? {}) };
    for (const [emp, v] of Object.entries(inc.read as S)) { if (emp === uid) out.read[emp] = v; else if (!same(v, base.read?.[emp])) deny("read"); }
  }
  // ワークフロー：新規は本人名義のみ／既存は「取下げ」「現在の承認者の承認・差戻し・却下」のみ
  if (inc.workflows) {
    const byId = new Map<string, S>((base.workflows ?? []).map((w: S) => [w.id, w]));
    const next: S[] = [];
    for (const w of inc.workflows as S[]) {
      const o = byId.get(w.id);
      if (!o) { if (w.applicantId === uid && w.status === "承認待ち" && w.steps?.[0]?.state === "承認待ち" && w.steps.slice(1).every((s: S) => s.state === "待機")) next.push(w); else deny("workflows"); }
      else if (same(o, w)) next.push(o);
      else if (validWf(o, w, uid)) next.push(w);
      else { next.push(o); deny("workflows"); }
    }
    for (const o of byId.values()) if (!next.some((x) => x.id === o.id)) next.push(o); // 削除は不可
    out.workflows = next.sort((a, b) => (b.id > a.id ? 1 : -1));
  }

  // 経理：閲覧は役員・管理者、編集は管理者のみ。仕訳は追記のみ・貸借一致・締め済み月への計上不可
  const w = can.writeAccounting(role);
  for (const k of PRIVATE) if (inc[k] !== undefined && !same(inc[k], base[k]) && !w) deny(k);
  if (w) {
    if (inc.journal) {
      const cur = (base.journal ?? []) as S[], nj = inc.journal as S[], closed: string[] = base.closed ?? [];
      const prefixOk = cur.every((e, i) => nj[i]?.hash === e.hash);
      const added = nj.slice(cur.length);
      const okSrc = (e: S) => ["reversal", "workflow", "manual"].includes(e.source);
      const okAdded = added.every((e) => !checkEntry(e as never) && !closed.includes(String(e.date).slice(0, 7)) && okSrc(e));
      if (prefixOk && okAdded && verifyChain(nj as never).ok) out.journal = nj; else deny("journal");
    }
    if (inc.jApprovals) {
      const merged: S = { ...(base.jApprovals ?? {}) };
      for (const [id, a] of Object.entries(inc.jApprovals as S)) {
        if (merged[id]) continue; // 承認は上書き不可
        const j = (out.journal ?? base.journal ?? []).find((e: S) => e.id === id);
        if (j && a.by === uid && j.createdBy !== uid) merged[id] = a; else deny("jApprovals"); // 起票者本人は承認不可（職務分掌）
      }
      out.jApprovals = merged;
    }
    if (inc.closed) out.closed = Array.from(new Set([...(base.closed ?? []), ...inc.closed])).sort(); // 締めの追加のみ（再オープン不可）
    if (inc.ipo && can.admin(role)) out.ipo = inc.ipo;
  }

  // 監査ログ：サーバーが連鎖を計算して追記する（クライアントからの上書きは受け付けない）。actor は認証済みの本人に固定
  out.audit = [...(base.audit ?? [])];
  if (Array.isArray(inc.auditOutbox)) {
    for (const e of (inc.auditOutbox as S[]).slice(0, 200)) {
      if (typeof e?.action !== "string") continue;
      out.audit = append(out.audit as never, { at: String(e.at ?? new Date().toISOString()).slice(0, 40), actor: uid, action: e.action.slice(0, 300) } as never);
    }
  }
  return { state: out, denied };
}
