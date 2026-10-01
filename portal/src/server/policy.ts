// 共有DB（State）の読み書きに対するサーバー側の権限検証。
// クライアントの申告は信用せず、「誰が・どの項目を・どう変えてよいか」をここで強制する。
import { can, type RoleName } from "../lib/perm.ts";
import { append, verifyChain } from "../lib/chain.ts";
import { checkEntry } from "../lib/accounting.ts";
import { KINDS, toMin } from "../lib/work.ts";
import { EVENT_CATEGORIES, REMOTE_KINDS, remoteLink } from "../lib/biz.ts";

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
    out.employees = out.employees.map((e: S) => (e.id === uid ? e : { id: e.id, name: e.name, job: e.job, employment: e.employment, scheduled: e.scheduled, role: e.role, dept: e.dept, bossId: e.bossId }));
  }
  const lead = role !== "employee"; // 役員・管理者
  if (!can.viewAllReports(role) && out.reports) out.reports = { [uid]: out.reports[uid] ?? {} };
  if (!can.viewAllReports(role) && out.docAck) out.docAck = { [uid]: out.docAck[uid] ?? {} };
  if (!lead && out.kpis) out.kpis = out.kpis.filter((k: S) => k.ownerId === "" || k.ownerId === uid);
  if (!lead && out.remotes) out.remotes = out.remotes.filter((r: S) => r.ownerId === uid);
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
    for (const k of ["email", "dept", "bossId", "phone"]) if (e[k] != null && !str(e[k], 120)) return false;
  }
  if (list.some((e) => e.bossId && !ids.has(e.bossId))) return false;
  const pres = list.find((e) => e.id === PRESIDENT_ID);
  return !!pres && pres.role === "admin" && list.some((e) => e.role === "admin");
}

const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const isDate = (v: unknown) => typeof v === "string" && DATE.test(v);
const isMonth = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
const isTime = (v: unknown) => v == null || v === "" || (typeof v === "string" && toMin(v) != null);
export function validDocs(list: S[]): boolean {
  return Array.isArray(list) && list.length <= 300 && list.every((d) => str(d?.id, 40) && d.id && str(d.title, 120) && d.title && str(d.category, 40) && str(d.version, 20) && isDate(d.effective) && str(d.body, 60000) && str(d.updatedAt, 40) && str(d.updatedBy, 60));
}
export function validEvents(list: S[]): boolean {
  return Array.isArray(list) && list.length <= 5000 && list.every((e) => str(e?.id, 40) && e.id && str(e.title, 120) && e.title && isDate(e.date) && (e.endDate == null || (isDate(e.endDate) && e.endDate >= e.date)) && isTime(e.start) && isTime(e.end) && (EVENT_CATEGORIES as readonly string[]).includes(e.category) && (e.note == null || str(e.note, 500)) && str(e.by, 20));
}
const validValues = (v: unknown) => !!v && typeof v === "object" && Object.entries(v as S).length <= 240 && Object.entries(v as S).every(([m, n]) => isMonth(m) && typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e12);
export function validKpis(list: S[]): boolean {
  return Array.isArray(list) && list.length <= 300 && list.every((k) => str(k?.id, 40) && k.id && str(k.name, 80) && k.name && str(k.unit, 20) && typeof k.target === "number" && Number.isFinite(k.target) && str(k.ownerId, 20) && validValues(k.values) && (k.note == null || str(k.note, 300)));
}
export function validRemotes(list: S[]): boolean {
  return Array.isArray(list) && list.length <= 1000 && list.every((r) => str(r?.id, 40) && r.id && str(r.name, 80) && r.name && (REMOTE_KINDS as readonly string[]).includes(r.kind) && str(r.host, 300) && !!remoteLink(r as never) && (r.port == null || (Number.isInteger(r.port) && r.port > 0 && r.port < 65536)) && str(r.ownerId, 20) && (r.note == null || str(r.note, 300)));
}
const validReport = (date: string, r: S) => isDate(date) && r?.date === date && str(r.done, 4000) && str(r.plan, 4000) && str(r.issues, 4000) && (r.hours == null || (typeof r.hours === "number" && r.hours >= 0 && r.hours <= 24)) && ["下書き", "提出済"].includes(r.status);

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

  // 文書・カレンダー・リモート接続先：書き込める役割だけ（形式も検証）
  if (inc.docs !== undefined && !same(inc.docs, base.docs)) { if (can.manageDocs(role) && validDocs(inc.docs)) out.docs = inc.docs; else deny("docs"); }
  if (inc.events !== undefined && !same(inc.events, base.events)) { if (can.editCalendar(role) && validEvents(inc.events)) out.events = inc.events; else deny("events"); }
  if (inc.remotes !== undefined && !same(inc.remotes, base.remotes)) { if (can.manageRemotes(role) && validRemotes(inc.remotes)) out.remotes = inc.remotes; else deny("remotes"); }
  // 文書の確認（既読）：本人分のみ
  if (inc.docAck) {
    out.docAck = { ...(base.docAck ?? {}) };
    for (const [emp, v] of Object.entries(inc.docAck as S)) { if (emp === uid) { if (v && typeof v === "object") out.docAck[emp] = Object.fromEntries(Object.entries(v as S).filter(([k, x]) => str(k, 40) && str(x, 20))); } else if (!same(v, base.docAck?.[emp])) deny("docAck"); }
  }
  // KPI：管理者は全て。担当者は自分のKPIの実績（values）のみ
  if (inc.kpis !== undefined && !same(inc.kpis, base.kpis)) {
    if (can.manageKpis(role)) { if (validKpis(inc.kpis)) out.kpis = inc.kpis; else deny("kpis"); }
    else {
      const next: S[] = [...(base.kpis ?? [])];
      for (const k of inc.kpis as S[]) {
        const i = next.findIndex((x) => x.id === k?.id);
        if (i < 0) { deny("kpis"); continue; }
        if (same(next[i], k)) continue;
        if (next[i].ownerId === uid && same({ ...next[i], values: 0 }, { ...k, values: 0 }) && validValues(k.values)) next[i] = { ...next[i], values: k.values }; else deny("kpis");
      }
      out.kpis = next;
    }
  }
  // 業務日報：本人は自分の日報（コメント欄は触れない）／役員・管理者は他人の日報へのコメントのみ
  if (inc.reports) {
    out.reports = { ...(base.reports ?? {}) };
    for (const [emp, days] of Object.entries(inc.reports as S)) {
      const cur: S = base.reports?.[emp] ?? {};
      if (same(days, cur)) continue;
      if (!days || typeof days !== "object") { deny("reports"); continue; }
      const merged: S = { ...cur };
      for (const [date, r] of Object.entries(days as S)) {
        if (same(r, cur[date])) continue;
        if (emp === uid) {
          if (!validReport(date, r)) { deny("reports"); continue; }
          const { comment, commentBy } = cur[date] ?? {};
          const nr: S = { ...(r as S) }; delete nr.comment; delete nr.commentBy;
          if (comment !== undefined) { nr.comment = comment; nr.commentBy = commentBy; }
          merged[date] = nr;
        } else if (can.viewAllReports(role) && cur[date] && str((r as S).comment, 500) && same({ ...cur[date], comment: 0, commentBy: 0 }, { ...(r as S), comment: 0, commentBy: 0 })) {
          merged[date] = { ...cur[date], comment: (r as S).comment, commentBy: uid };
        } else deny("reports");
      }
      out.reports[emp] = merged;
    }
  }

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
