// 共有DB（State）の読み書きに対するサーバー側の権限検証。
// クライアントの申告は信用せず、「誰が・どの項目を・どう変えてよいか」をここで強制する。
import { can, type RoleName } from "../lib/perm.ts";
import { append, verifyChain } from "../lib/chain.ts";
import { checkEntry } from "../lib/accounting.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = Record<string, any>;

const base_payroll = (s: S) => !!s.payroll;
function ownConfirmedPayroll(p: S, uid: string): S {
  const o: S = {};
  for (const [m, run] of Object.entries(p as S)) if (run.status === "確定") o[m] = { ...run, rows: run.rows.filter((r: S) => r.id === uid) };
  return o;
}
const PRIVATE = ["journal", "jApprovals", "payroll", "closed", "ipo"] as const;

/** 読み出し：権限のない項目は返さない（DevTools・APIで直接見られないようにする） */
export function sanitizeForRead(state: S | null, uid: string, role: RoleName): S | null {
  if (!state) return state;
  const out: S = { ...state };
  if (!can.viewAccounting(role)) { for (const k of PRIVATE) delete out[k]; }
  else if (!can.viewPayroll(role)) delete out.payroll;
  if (!can.viewPayroll(role) && base_payroll(state)) out.payroll = ownConfirmedPayroll(state.payroll, uid); // 一般社員には自分の確定済み明細だけ返す
  const seeAll = can.viewPayroll(role);
  if (!seeAll && out.punches) out.punches = { [uid]: out.punches[uid] ?? {} };
  if (out.logs) out.logs = out.logs.filter((l: S) => l.by === uid); // 5W1H記録は本人のみ
  if (!can.audit(role) && out.audit) out.audit = out.audit.filter((a: S) => a.actor === uid).slice(-50);
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

/** 書き込み：サーバーの現状（cur）に、許可された変更だけを取り込む。拒否した項目は deniedFields に列挙 */
export function mergeWrite(cur: S | null, inc: S, uid: string, role: RoleName): { state: S; denied: string[] } {
  const base: S = cur ?? {};
  const out: S = { ...base };
  const denied: string[] = [];
  const deny = (k: string) => { if (!denied.includes(k)) denied.push(k); };

  // お知らせ・上場準備：管理者のみ
  if (inc.news !== undefined) { if (can.admin(role)) out.news = inc.news; else if (JSON.stringify(inc.news) !== JSON.stringify(base.news)) deny("news"); }

  // 勤怠：本人分のみ
  if (inc.punches) {
    out.punches = { ...(base.punches ?? {}) };
    for (const [emp, days] of Object.entries(inc.punches as S)) {
      if (emp === uid) out.punches[emp] = days;
      else if (JSON.stringify(days) !== JSON.stringify(base.punches?.[emp])) deny("punches");
    }
  }
  // 既読・研修進捗：本人分のみ
  for (const k of ["read", "progress"]) if (inc[k]) {
    out[k] = { ...(base[k] ?? {}) };
    for (const [emp, v] of Object.entries(inc[k] as S)) { if (emp === uid) out[k][emp] = v; else if (JSON.stringify(v) !== JSON.stringify(base[k]?.[emp])) deny(k); }
  }
  // 会議室予約・問い合わせ：自分の分のみ増減、他人の分は変更不可
  if (inc.logs) out.logs = [...(base.logs ?? []).filter((l: S) => l.by !== uid), ...inc.logs.filter((l: S) => l.by === uid)];
  if (inc.bookings) out.bookings = [...(base.bookings ?? []).filter((b: S) => b.by !== uid), ...inc.bookings.filter((b: S) => b.by === uid)];
  if (inc.tickets) {
    const mine = inc.tickets.filter((t: S) => !(base.tickets ?? []).some((x: S) => x.id === t.id) && t.by === uid);
    const existing = (base.tickets ?? []).map((t: S) => (can.admin(role) ? inc.tickets.find((x: S) => x.id === t.id) ?? t : t));
    out.tickets = [...mine, ...existing];
  }
  // ワークフロー：新規は本人名義のみ／既存は「取下げ」「現在の承認者の承認・差戻し・却下」のみ
  if (inc.workflows) {
    const byId = new Map<string, S>((base.workflows ?? []).map((w: S) => [w.id, w]));
    const next: S[] = [];
    for (const w of inc.workflows as S[]) {
      const o = byId.get(w.id);
      if (!o) { if (w.applicantId === uid && w.status === "承認待ち" && w.steps?.[0]?.state === "承認待ち" && w.steps.slice(1).every((s: S) => s.state === "待機")) next.push(w); else deny("workflows"); }
      else if (JSON.stringify(o) === JSON.stringify(w)) next.push(o);
      else if (validWf(o, w, uid)) next.push(w);
      else { next.push(o); deny("workflows"); }
    }
    for (const o of byId.values()) if (!next.some((x) => x.id === o.id)) next.push(o); // 削除は不可
    out.workflows = next.sort((a, b) => (b.id > a.id ? 1 : -1));
  }

  // 会計・給与：経理担当/管理者のみ。仕訳は追記のみ・貸借一致・締め済み月への計上不可
  const w = can.writeAccounting(role);
  for (const k of PRIVATE) if (inc[k] !== undefined && JSON.stringify(inc[k]) !== JSON.stringify(base[k]) && !w) deny(k);
  if (w) {
    if (inc.journal) {
      const cur = (base.journal ?? []) as S[], nj = inc.journal as S[], closed: string[] = base.closed ?? [];
      const prefixOk = cur.every((e, i) => nj[i]?.hash === e.hash);
      const added = nj.slice(cur.length);
      const okSrc = (e: S) => ["reversal", "payroll", "workflow", "manual"].includes(e.source) || (cur.length === 0 && ["seed", "opening"].includes(e.source)); // 初回のみ期首・デモデータの投入を許可
      const okAdded = added.every((e) => !checkEntry(e as never) && (cur.length === 0 || !closed.includes(String(e.date).slice(0, 7))) && okSrc(e));
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
    if (inc.payroll) {
      const merged: S = { ...(base.payroll ?? {}) };
      for (const [m, run] of Object.entries(inc.payroll as S)) { if (merged[m]?.status === "確定") continue; merged[m] = run; } // 確定済みは不変
      out.payroll = merged;
    }
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
