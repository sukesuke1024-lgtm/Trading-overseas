// 共有DB（State）の読み書きに対するサーバー側の権限検証。
// クライアントの申告は信用せず、「誰が・どの項目を・どう変えてよいか」をここで強制する。
import { can, type RoleName } from "../lib/perm.ts";
import { append, verifyChain } from "../lib/chain.ts";
import { checkEntry, postJournal, workflowJournal } from "../lib/accounting.ts";
import { KINDS, toMin } from "../lib/work.ts";
import { EVENT_CATEGORIES, REMOTE_KINDS, remoteLink } from "../lib/biz.ts";
import { APPROVERS, routeFor } from "../lib/authority.ts";
import { ORDER_CATEGORIES, ORDER_STATUS, orderMoveOk, creditStatementIssue, isFiscalPeriod, statementPeriods, ASSET_CATEGORIES, ASSET_STATUS, BENEFIT_CATEGORIES, CHECK_KINDS, CHECK_RESULTS, EXT_KINDS, FILE_KINDS, FILE_SCOPES, MAIL_CATEGORIES, MAIL_STATUS, PAY_KINDS, canSeeFile, canSeeMail, deptOf, isClientCode, isHttps, maskMail, viewerOf, type Viewer } from "../lib/ops.ts";

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
  if (out.workflows) {
    // 異動・変更届は個人情報を含むため、届出者・承認者・管理者だけ（役員でも他人の届出は見えない）
    const mine = (w: S) => w.applicantId === uid || w.steps?.some((s: S) => s.approverId === uid);
    out.workflows = out.workflows.filter((w: S) => (w.type === "異動変更届" ? role === "admin" || mine(w) : can.viewAllWorkflows(role) || mine(w)));
  }
  if (!can.audit(role) && out.audit) out.audit = out.audit.filter((a: S) => a.actor === uid).slice(-50);
  if (!can.viewAllAttendance(role) && out.read) out.read = { [uid]: out.read[uid] ?? [] };

  // ---- 追加機能：閲覧できるものだけを返す ----
  const me = (state.employees ?? []).find((e: S) => e.id === uid);
  const v: Viewer = me ? viewerOf(me as never) : { id: uid, role, dept: "", lead: role !== "employee" };
  const wfOf = (id?: string) => (state.workflows ?? []).find((w: S) => w.id === id);
  if (out.files) out.files = out.files.filter((f: S) => canSeeFile(f as never, v, f.wfId ? wfOf(f.wfId) : undefined));
  if (out.mails) out.mails = out.mails.filter((m: S) => canSeeMail(m as never, v)).map((m: S) => maskMail(m as never, uid));
  if (role === "employee") {
    const myClients = (out.clients ?? []).filter((c: S) => c.dept === v.dept);
    out.clients = myClients;
    const codes = new Set(myClients.map((c: S) => c.code));
    if (out.checks) out.checks = out.checks.filter((c: S) => codes.has(c.clientCode));
    if (out.assets) out.assets = out.assets.filter((a: S) => a.assigneeId === uid);
    if (out.orders) out.orders = out.orders.filter((o: S) => o.dept === v.dept || o.requesterId === uid);
  }
  if (role !== "admin") {
    if (out.extLinks) out.extLinks = out.extLinks.filter((l: S) => !l.dept || l.dept === v.dept || role === "executive");
    delete out.retention; delete out.archiveMeta;
  }
  return out;
}

type Ctx = { now: string; blob: (id: string) => { owner: string; name: string; size: number; mime: string } | undefined };
const WF_EDITABLE = ["title", "amount", "detail", "category", "taxKind", "invoiceNo", "from", "to"];
const WF_FIXED = ["id", "applicantId", "type", "createdAt"];
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pending = (steps: S[]) => steps.map((s, i) => ({ approverId: s.approverId, label: s.label, state: i === 0 ? "承認待ち" : "待機" }));

/** 申請の新規作成：本人名義・職務権限規程どおりの承認ルート・申請の記録が1件 */
function validNewWf(w: S, uid: string, employees: S[], authority: S[]): boolean {
  if (w.applicantId !== uid || w.status !== "承認待ち" || !Array.isArray(w.steps) || !str(w.type, 40) || !str(w.title, 200) || !str(w.detail, 8000)) return false;
  const route = routeFor(employees as never, authority as never, w.type, w.amount, uid);
  if (!sameJson(w.steps.map((s: S) => [s.approverId, s.label, s.state, s.at, s.comment]), pending(route).map((s) => [s.approverId, s.label, s.state, undefined, undefined]))) return false;
  const h = w.history;
  return Array.isArray(h) && h.length === 1 && h[0].action === "申請" && h[0].by === uid;
}

/** 既存の申請の更新：取下げ／現在の承認者の承認・差戻し・却下／差戻し後の修正再申請。全て「誰が・理由」を履歴に1件追加する */
function validWf(o: S, n: S, uid: string, employees: S[], authority: S[]): boolean {
  for (const k of WF_FIXED) if (!sameJson(o[k], n[k])) return false;
  const oh: S[] = o.history ?? [], nh: S[] = n.history ?? [];
  if (nh.length !== oh.length + 1 || !oh.every((h, i) => sameJson(h, nh[i]))) return false;
  const ev = nh[nh.length - 1];
  if (ev.by !== uid || typeof ev.action !== "string") return false;
  const reason = typeof ev.reason === "string" ? ev.reason.trim() : "";
  if (reason.length > 500) return false;
  const editableSame = WF_EDITABLE.every((k) => sameJson(o[k], n[k]));
  const same = (i: number) => sameJson(o.steps[i], n.steps[i]);
  if (o.steps.length !== n.steps.length && n.status !== "承認待ち") return false;

  if (n.status === "取下げ" && o.status === "承認待ち" && o.applicantId === uid) return ev.action === "取下げ" && !!reason && editableSame && o.steps.every((_: unknown, i: number) => same(i));

  if (o.status === "差戻し" && n.status === "承認待ち" && o.applicantId === uid) { // 修正再申請
    if (ev.action !== "修正再申請" || !reason) return false;
    const route = routeFor(employees as never, authority as never, n.type, n.amount, uid);
    return sameJson(n.steps.map((s: S) => [s.approverId, s.label, s.state, s.at, s.comment]), pending(route).map((s) => [s.approverId, s.label, s.state, undefined, undefined])) && str(n.title, 200) && str(n.detail, 8000) && !!n.title;
  }

  if (o.status !== "承認待ち" || !editableSame) return false;
  const idx = o.steps.findIndex((s: S) => s.state === "承認待ち");
  if (idx < 0 || o.steps[idx].approverId !== uid) return false;
  if (o.applicantId === uid && o.steps.length > 1) return false; // 自己承認は不可（他に承認者がいない代表者のみ）
  if (o.steps.some((_: unknown, i: number) => i !== idx && i !== idx + 1 && !same(i))) return false;
  const st = n.steps[idx];
  if (st.approverId !== uid || !["承認", "差戻し", "却下"].includes(st.state) || ev.action !== st.state) return false;
  if (st.state !== "承認" && !reason) return false; // 差戻し・却下は理由が必須
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

const employeesOf = (out: S, base: S): S[] => out.employees ?? base.employees ?? [];
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
/** 日報：提出済みには「業務内容・時間・関与先コード」の明細が1行以上必須。関与先コードは関与先マスタに存在するもの */
const validReport = (date: string, r: S, clients: S[]) => {
  if (!(isDate(date) && r?.date === date && str(r.done, 4000) && str(r.plan, 4000) && str(r.issues, 4000) && (r.hours == null || (typeof r.hours === "number" && r.hours >= 0 && r.hours <= 24)) && ["下書き", "提出済"].includes(r.status))) return false;
  const lines: S[] = r.lines ?? [];
  if (!Array.isArray(lines) || lines.length > 30) return false;
  for (const l of lines) if (!(str(l?.task, 500) && str(l.clientCode, 16) && str(l.clientName, 100) && typeof l.hours === "number" && l.hours > 0 && l.hours <= 24)) return false;
  if (lines.reduce((s, l) => s + l.hours, 0) > 24) return false;
  if (r.status === "提出済") {
    if (lines.length === 0 || lines.some((l) => !l.task.trim() || !clients.some((c) => c.code === l.clientCode && c.active !== false))) return false;
  }
  return true;
};
const fixClientNames = (r: S, clients: S[]): S => (r.lines ? { ...r, lines: r.lines.map((l: S) => ({ ...l, clientName: clients.find((c) => c.code === l.clientCode)?.name ?? l.clientName })) } : r);

/** 書き込み：サーバーの現状（cur）に、許可された変更だけを取り込む。拒否した項目は denied に列挙 */
export function mergeWrite(cur: S | null, inc: S, uid: string, role: RoleName, ctx: Partial<Ctx> = {}): { state: S; denied: string[] } {
  const now = ctx.now ?? new Date().toISOString();
  const blob = ctx.blob ?? (() => undefined);
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
          if (!validReport(date, r as S, base.clients ?? [])) { deny("reports"); continue; }
          const { comment, commentBy } = cur[date] ?? {};
          const nr: S = fixClientNames({ ...(r as S) }, base.clients ?? []); delete nr.comment; delete nr.commentBy;
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
  // ワークフロー：新規は本人名義・職務権限規程どおりのルール／既存は「取下げ」「現在の承認者の承認・差戻し・却下」「差戻し後の修正再申請」のみ。
  // どの操作も、時刻はサーバーが付け、実行者（誰が）と理由を履歴に残す（社長・役員も同じ）
  if (inc.workflows) {
    const byId = new Map<string, S>((base.workflows ?? []).map((w: S) => [w.id, w]));
    const employees: S[] = out.employees ?? base.employees ?? [], authority: S[] = base.authority ?? [];
    const next: S[] = [];
    const stamp = (w: S, o?: S): S => {
      const history = (w.history ?? []).map((h: S, i: number) => (i === (w.history.length - 1) ? { ...h, at: now } : h));
      const steps = w.steps.map((s: S, i: number) => (o && !same(s, o.steps[i]) && s.at ? { ...s, at: now } : s));
      return { ...w, history, steps };
    };
    for (const w of inc.workflows as S[]) {
      const o = byId.get(w.id);
      if (!o) { if (validNewWf(w, uid, employees, authority)) next.push(stamp(w)); else deny("workflows"); }
      else if (same(o, w)) next.push(o);
      else if (validWf(o, w, uid, employees, authority)) next.push(stamp(w, o));
      else { next.push(o); deny("workflows"); }
    }
    for (const o of byId.values()) if (!next.some((x) => x.id === o.id)) next.push(o); // 削除は不可
    out.workflows = next.sort((a, b) => (b.id > a.id ? 1 : -1));
    // 経費・出張の最終承認：サーバーが仕訳を自動作成（締め済みの月は計上しない）
    for (const w of out.workflows as S[]) {
      const o = byId.get(w.id);
      if (!o || o.status === "承認済" || w.status !== "承認済") continue;
      const core = workflowJournal(w as never, employees.find((e: S) => e.id === w.applicantId)?.job, now.slice(0, 10));
      if (core && !(out.closed ?? base.closed ?? []).includes(core.date.slice(0, 7)) && !checkEntry(core)) out.journal = postJournal((out.journal ?? base.journal ?? []) as never, core as never);
    }
  }

  // ---- 関与先・外部リンク・固定資産・福利厚生・職務権限規程・保存期間：管理者のみ ----
  const adminList = (key: string, ok: (list: S[]) => boolean, visible: (list: S[]) => S[] = (l) => l) => {
    if (inc[key] === undefined || same(inc[key], visible(base[key] ?? []))) return;
    if (can.manageAuthority(role) && ok(inc[key])) out[key] = inc[key]; else deny(key);
  };
  const str2 = (v: unknown, n: number) => str(v, n);
  adminList("clients", (l) => Array.isArray(l) && l.length <= 5000 && new Set(l.map((c) => c.code)).size === l.length && l.every((c) => isClientCode(c?.code) && str2(c.name, 100) && c.name && str2(c.dept, 40) && (c.kana == null || str2(c.kana, 100)) && (c.corpNo == null || /^\d{13}$/.test(c.corpNo) || c.corpNo === "") && (c.contact == null || str2(c.contact, 200)) && (c.note == null || str2(c.note, 300)) && typeof c.active === "boolean"));
  adminList("extLinks", (l) => Array.isArray(l) && l.length <= 300 && l.every((x) => str2(x?.id, 40) && str2(x.name, 80) && x.name && isHttps(x.url) && (EXT_KINDS as readonly string[]).includes(x.kind) && str2(x.dept, 40) && (x.accountId == null || str2(x.accountId, 80)) && (x.note == null || str2(x.note, 300))));
  adminList("assets", (l) => Array.isArray(l) && l.length <= 5000 && new Set(l.map((a) => a.id)).size === l.length && l.every((a) => str2(a?.id, 20) && a.id && str2(a.name, 100) && a.name && (ASSET_CATEGORIES as readonly string[]).includes(a.category) && isDate(a.purchaseDate) && typeof a.cost === "number" && a.cost >= 0 && a.cost < 1e11 && Number.isInteger(a.usefulLife) && a.usefulLife >= 1 && a.usefulLife <= 60 && (ASSET_STATUS as readonly string[]).includes(a.status) && ["maker", "model", "serial", "mgmtId", "assigneeId", "dept", "location", "note"].every((k) => a[k] == null || str2(a[k], 200)) && (a.disposedAt == null || isDate(a.disposedAt))), (l) => (role === "employee" ? l.filter((a) => a.assigneeId === uid) : l));
  adminList("benefits", (l) => Array.isArray(l) && l.length <= 200 && l.every((b) => str2(b?.id, 40) && str2(b.title, 100) && b.title && (BENEFIT_CATEGORIES as readonly string[]).includes(b.category) && str2(b.summary, 300) && str2(b.body, 10000) && (b.link == null || b.link === "" || isHttps(b.link)) && (b.contact == null || str2(b.contact, 100))));
  adminList("authority", (l) => Array.isArray(l) && l.length <= 100 && l.every((r) => r && typeof r.type === "string" && typeof r.min === "number" && r.min >= 0 && r.min < 1e11 && Array.isArray(r.steps) && r.steps.length >= 1 && r.steps.length <= 5 && r.steps.every((s: string) => (APPROVERS as readonly string[]).includes(s))) && ["経費精算", "休暇申請", "出張申請", "稟議", "IT機器・アカウント申請", "異動変更届"].every((ty) => l.some((r) => r.type === ty && r.min === 0)));
  if (inc.retention !== undefined && !same(inc.retention, base.retention)) {
    const r = inc.retention as S;
    if (can.manageAuthority(role) && r && ["attendance", "reports", "mails", "workflows", "audit"].every((k) => Number.isInteger(r[k]) && r[k] >= 1 && r[k] <= 240) && r.attendance >= 36 && r.audit >= 36) out.retention = r; else deny("retention");
  }

  // ---- 備品・名刺の注文：依頼は自分の名義・自事業部で。承認〜納品は管理者、取消は依頼者（依頼中のみ）も可 ----
  if (inc.orders) {
    const me = employeesOf(out, base).find((e: S) => e.id === uid);
    const baseOrders: S[] = base.orders ?? [];
    let orders = [...baseOrders];
    let seq = baseOrders.length;
    for (const o of (inc.orders as S[]).slice(0, 500)) {
      const cur = baseOrders.find((x) => x.id === o?.id);
      if (!cur) {
        const ok = str(o?.id, 40) && o.id && (ORDER_CATEGORIES as readonly string[]).includes(o.category) && str(o.vendor, 40) && o.vendor && str(o.item, 120) && o.item
          && Number.isInteger(o.qty) && o.qty >= 1 && o.qty <= 9999 && (o.unitPrice == null || (Number.isFinite(o.unitPrice) && o.unitPrice >= 0 && o.unitPrice <= 100_000_000))
          && (o.url == null || o.url === "" || isHttps(o.url)) && (o.reason == null || str(o.reason, 300))
          && o.requesterId === uid && o.status === "依頼中" && (role === "admin" || o.dept === deptOf(me as never));
        if (!ok) { deny("orders"); continue; }
        seq += 1;
        orders = [{ id: o.id, no: `ORD-${now.slice(0, 4)}-${String(seq).padStart(4, "0")}`, category: o.category, vendor: o.vendor, item: o.item, qty: o.qty, ...(o.unitPrice != null ? { unitPrice: o.unitPrice } : {}), ...(o.url ? { url: o.url } : {}), ...(o.reason ? { reason: o.reason } : {}), dept: o.dept, requesterId: uid, status: "依頼中", history: [{ at: now, by: uid, status: "依頼中" }], at: now }, ...orders];
      } else if (o.status !== cur.status) {
        if (orderMoveOk(cur.status, o.status, role === "admin", cur.requesterId === uid) && (ORDER_STATUS as readonly string[]).includes(o.status)) orders = orders.map((x) => (x.id === cur.id ? { ...x, status: o.status, history: [...x.history, { at: now, by: uid, status: o.status }] } : x));
        else deny("orders");
      } else if (!same({ ...o, history: undefined }, { ...cur, history: undefined })) deny("orders");
    }
    out.orders = orders;
  }

  // ---- 問い合わせ・ヘルプデスク ----
  if (inc.mails) {
    const emps = employeesOf(out, base), me = emps.find((e: S) => e.id === uid);
    const v: Viewer = me ? viewerOf(me as never) : { id: uid, role, dept: "", lead: role !== "employee" };
    const depts = new Set(emps.map((e: S) => deptOf(e as never)));
    let mails: S[] = [...(base.mails ?? [])];
    for (const m of inc.mails as S[]) {
      const i = mails.findIndex((x) => x.id === m?.id);
      if (i < 0) {
        const okTo = m.toType === "個人" ? emps.some((e: S) => e.id === m.toId) && m.toId !== uid : m.toType === "事業部" ? depts.has(m.toId) : m.toType === "窓口" ? str(m.toId, 20) && !!m.toId : false;
        if (m.from === uid && str(m.id, 40) && m.id && typeof m.anon !== "string" && okTo && (MAIL_CATEGORIES as readonly string[]).includes(m.category) && str(m.subject, 120) && m.subject && str(m.body, 8000) && m.body && m.status === "未対応" && Array.isArray(m.thread) && m.thread.length === 0 && (!m.anon || m.toType === "窓口")) mails = [{ id: m.id, from: uid, anon: !!m.anon, toType: m.toType, toId: m.toId, category: m.category, subject: m.subject, body: m.body, at: now, status: "未対応", thread: [] }, ...mails];
        else deny("mails");
        continue;
      }
      const o = mails[i];
      if (!canSeeMail(o as never, v)) { deny("mails"); continue; }
      const view = maskMail(o as never, uid) as S;
      if (same(view, m)) continue;
      const t0: S[] = view.thread, t1: S[] = m.thread ?? [];
      const prefix = t0.every((x, k) => same(x, t1[k]));
      const added = t1.slice(t0.length);
      const okAdded = added.every((x) => (x.by === uid || (o.anon && o.from === uid && x.by === "匿名")) && str(x.body, 8000) && x.body.trim());
      const metaSame = same({ ...view, thread: 0, status: 0 }, { ...m, thread: 0, status: 0 });
      const statusOk = m.status === view.status || ((MAIL_STATUS as readonly string[]).includes(m.status));
      if (prefix && okAdded && metaSame && statusOk) mails[i] = { ...o, status: m.status, thread: [...o.thread, ...added.map((x) => ({ by: uid, at: now, body: x.body }))] };
      else deny("mails");
    }
    out.mails = mails;
  }

  // ---- ファイルの台帳 ----
  if (inc.files || inc.filesDel) {
    const emps = employeesOf(out, base), me = emps.find((e: S) => e.id === uid);
    const v: Viewer = me ? viewerOf(me as never) : { id: uid, role, dept: "", lead: role !== "employee" };
    const wfOf = (id?: string) => (out.workflows ?? base.workflows ?? []).find((w: S) => w.id === id);
    const baseFiles: S[] = base.files ?? [];
    const visible = baseFiles.filter((f) => canSeeFile(f as never, v, f.wfId ? wfOf(f.wfId) : undefined));
    let files = [...baseFiles];
    // 削除は、明示した依頼（filesDel）だけ。画面に無いからといって消さない（古い画面からの上書きでデータが消えないように）
    for (const id of Array.isArray(inc.filesDel) ? (inc.filesDel as string[]).slice(0, 200) : []) {
      const f = visible.find((x) => x.id === id);
      if (!f) continue;
      const own = f.uploadedBy === uid && !PAY_KINDS.includes(f.kind) && f.kind !== "アーカイブ";
      if ((own || role === "admin") && f.kind !== "アーカイブ") files = files.filter((x) => x.id !== id); else deny("files"); // 書き出したCSVは消せない
    }
    const visIds = new Set(visible.map((f) => f.id));
    for (const f of (inc.files ?? []) as S[]) {
      if (visIds.has(f.id)) { if (!same(f, visible.find((x) => x.id === f.id))) deny("files"); continue; }
      if (baseFiles.some((x) => x.id === f.id)) { deny("files"); continue; }
      const b = blob(f?.id);
      const sizeOk = !!b && b.owner === uid && b.name === f.name && b.size === f.size && b.mime === f.mime;
      const isPay = PAY_KINDS.includes(f?.kind);
      let ok = sizeOk && f.uploadedBy === uid && /^[a-f0-9]{24,40}$/.test(f.id) && (FILE_KINDS as readonly string[]).includes(f.kind) && (FILE_SCOPES as readonly string[]).includes(f.scope) && str(f.name, 200) && (f.note == null || str(f.note, 300));
      if (ok && isPay) ok = can.managePay(role) && f.scope === "本人" && emps.some((e: S) => e.id === f.ownerId) && typeof f.period === "string" && /^\d{4}(-\d{2})?$/.test(f.period);
      else if (ok && f.kind === "申請添付") { const w = wfOf(f.wfId); ok = !!w && f.scope === "申請" && (w.applicantId === uid || role === "admin"); }
      else if (ok && f.kind === "規程添付") ok = can.manageDocs(role) && (out.docs ?? base.docs ?? []).some((d: S) => d.id === f.docId) && ["全社", "役員・部長"].includes(f.scope);
      else if (ok && f.kind === "決算書") { const cl = (out.clients ?? base.clients ?? []).find((x: S) => x.code === f.clientCode); ok = !!cl && typeof f.period === "string" && isFiscalPeriod(f.period) && f.scope === "事業部" && f.dept === cl.dept && (role !== "employee" || cl.dept === v.dept); }
      else if (ok && f.kind === "共有") ok = ["全社", "事業部", "役員・部長"].includes(f.scope) && f.dept === v.dept && (f.scope !== "役員・部長" || v.lead);
      else if (ok) ok = false; // アーカイブはサーバーだけが作る
      if (ok) files = [{ id: f.id, name: f.name, size: f.size, mime: f.mime, kind: f.kind, scope: f.scope, dept: f.dept, ownerId: f.ownerId, wfId: f.wfId, docId: f.docId, clientCode: f.clientCode, period: f.period, note: f.note, uploadedBy: uid, at: now }, ...files]; else deny("files");
    }
    out.files = files;
  }

  // ---- 与信・反社の確認記録：追記のみ。自分の名義で、見える関与先についてだけ ----
  if (inc.checks) {
    const baseIds = new Set<string>((base.checks ?? []).map((c: S) => c.id));
    const clients: S[] = base.checks ? (base.clients ?? []) : (base.clients ?? []);
    const me = employeesOf(out, base).find((e: S) => e.id === uid);
    const added: S[] = [];
    for (const c of inc.checks as S[]) {
      if (baseIds.has(c.id)) { if (!same(c, (base.checks ?? []).find((x: S) => x.id === c.id))) deny("checks"); continue; }
      const cl = clients.find((x) => x.code === c?.clientCode);
      const okClient = !!cl && (role !== "employee" || cl.dept === deptOf(me as never));
      if (okClient && str(c.id, 40) && c.id && c.checkedBy === uid && (CHECK_KINDS as readonly string[]).includes(c.kind) && (CHECK_RESULTS as readonly string[]).includes(c.result) && str(c.source, 80) && (c.note == null || str(c.note, 500)) && (c.limit == null || (typeof c.limit === "number" && c.limit >= 0)) && (c.stmtReason == null || str(c.stmtReason, 200))) {
        // 与信は決算書3期分（または受領できない理由）が必要。期はサーバー側のファイル台帳から数える
        const periods = c.kind === "与信" ? statementPeriods(out.files ?? base.files ?? [], c.clientCode) : undefined;
        if (periods && creditStatementIssue(c.kind, c.result, periods, c.stmtReason)) deny("checks");
        else added.push({ ...c, ...(periods ? { periods } : { periods: undefined }), at: now });
      } else deny("checks");
    }
    if (added.length) out.checks = [...added, ...(base.checks ?? [])];
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
