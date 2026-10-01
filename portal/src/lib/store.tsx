"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PRESIDENT_ID, defaultRole, type Employee, type News, type Role, type WfEvent, type WfStep, type WfType, type Workflow } from "./data";
import { BASE, STATIC } from "./auth";
import { append, type Chained } from "./chain";
import { can } from "./perm";
import { seedState } from "./seed";
import { checkEntry, isPosted, postJournal, reversal, workflowJournal, type Approvals, type Journal, type JournalCore, type TaxKind } from "./accounting";
import { holidaySet, workdaysBetween, type Conditions, type DayInput } from "./work";
import type { CalEvent, Doc, Kpi, Remote, Report, Reports } from "./biz";
import { canSeeFile, canSeeMail, maskMail, viewerOf, type Asset, type Benefit, type Client, type CreditCheck, type ExtLink, type FileRec, type Mail, type Retention } from "./ops";
import { routeFor, type AuthorityRule } from "./authority";

export type AuditBody = { at: string; actor: string; action: string };
export type Audit = AuditBody & Chained;

export type State = {
  employees: Employee[];
  conditions: Conditions;
  attendance: Record<string, Record<string, DayInput>>; // 従業員番号 → 日付 → 勤怠（日別勤怠）
  news: News[];
  read: Record<string, string[]>;
  workflows: Workflow[];
  audit: Audit[]; // 古い順・ハッシュチェーン
  auditOutbox: AuditBody[]; // server モード：サーバーへ送って連鎖に追記してもらう未送信の操作
  journal: Journal[];
  jApprovals: Approvals;
  closed: string[]; // 月次締め済み（YYYY-MM）
  ipo: Record<string, boolean>;
  docs: Doc[]; // 文書管理（社内規程など）
  docAck: Record<string, Record<string, string>>; // 従業員番号 → 文書ID → 確認した版
  events: CalEvent[]; // 業務カレンダー（全社共通）
  reports: Reports; // 業務日報
  kpis: Kpi[];
  remotes: Remote[]; // リモート接続先
  files: FileRec[]; // アップロードされたファイルの台帳（本体は別保管）
  filesDel: string[]; // 削除の依頼（サーバーへ送る未送信分。省略されたものを削除とはみなさない）
  clients: Client[]; // 関与先マスタ
  checks: CreditCheck[]; // 与信・反社確認の記録
  extLinks: ExtLink[]; // 外部調査サービス・公的サイトへのリンク
  mails: Mail[]; // 問い合わせ・ヘルプデスク
  assets: Asset[]; // 固定資産台帳
  authority: AuthorityRule[]; // 職務権限規程（承認ルート）
  benefits: Benefit[]; // 福利厚生の案内
  retention: Retention; // 履歴の保存期間（月）
  archiveMeta: { at: string; auditUpTo: string };
};

const KEY = "hlink-portal-v1";

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 承認済み休暇申請の日付（所定労働日のみ）。申請者ごと */
export function leaveDatesOf(workflows: Workflow[], empId: string, hs: Set<string>, statuses: Workflow["status"][] = ["承認済"]) {
  const set = new Set<string>();
  for (const w of workflows) {
    if (w.type === "休暇申請" && w.applicantId === empId && statuses.includes(w.status) && w.from && w.to) workdaysBetween(w.from, w.to, hs).forEach((d) => set.add(d));
  }
  return set;
}

type Action =
  | { t: "load"; s: State }
  | { t: "outbox-clear"; n: number }
  | { t: "read"; emp: string; id: string }
  | { t: "news"; n: News }
  | { t: "news-del"; id: string }
  | { t: "wf-new"; w: Workflow }
  | { t: "wf-act"; id: string; approverId: string; act: "承認" | "差戻し" | "却下"; comment: string }
  | { t: "wf-cancel"; id: string; by: string; reason: string }
  | { t: "att-set"; emp: string; date: string; day: DayInput | null; by: string; log?: string }
  | { t: "emp-import"; list: Omit<Employee, "role">[]; by: string }
  | { t: "emp-update"; id: string; patch: Partial<Employee>; by: string }
  | { t: "cond-set"; cond: Conditions; by: string }
  | { t: "journal-add"; core: Omit<JournalCore, "id"> }
  | { t: "journal-approve"; id: string; by: string }
  | { t: "journal-reverse"; id: string; by: string }
  | { t: "close-month"; month: string; by: string }
  | { t: "ipo-set"; id: string; v: boolean; by: string }
  | { t: "export-log"; by: string; what: string }
  | { t: "doc-save"; doc: Doc; by: string }
  | { t: "doc-del"; id: string; by: string }
  | { t: "doc-ack"; emp: string; id: string; version: string }
  | { t: "ev-save"; ev: CalEvent; by: string }
  | { t: "ev-del"; id: string; by: string }
  | { t: "report-save"; emp: string; report: Report }
  | { t: "report-comment"; emp: string; date: string; comment: string; by: string }
  | { t: "kpi-save"; kpi: Kpi; by: string }
  | { t: "kpi-del"; id: string; by: string }
  | { t: "kpi-value"; id: string; month: string; value: number | null }
  | { t: "remote-save"; remote: Remote; by: string }
  | { t: "remote-del"; id: string; by: string }
  | { t: "file-add"; rec: FileRec }
  | { t: "file-del"; id: string; by: string }
  | { t: "client-save"; client: Client; by: string }
  | { t: "client-del"; code: string; by: string }
  | { t: "check-add"; check: CreditCheck }
  | { t: "ext-save"; link: ExtLink; by: string }
  | { t: "ext-del"; id: string; by: string }
  | { t: "mail-new"; mail: Mail }
  | { t: "mail-reply"; id: string; by: string; body: string }
  | { t: "mail-status"; id: string; status: Mail["status"]; by: string }
  | { t: "asset-save"; asset: Asset; by: string }
  | { t: "asset-del"; id: string; by: string }
  | { t: "authority-set"; rules: AuthorityRule[]; by: string }
  | { t: "benefit-save"; benefit: Benefit; by: string }
  | { t: "benefit-del"; id: string; by: string }
  | { t: "retention-set"; retention: Retention; by: string }
  | { t: "archive-apply"; next: State; recs: FileRec[] }
  | { t: "wf-edit"; id: string; by: string; patch: Pick<Workflow, "title" | "detail"> & Partial<Pick<Workflow, "amount" | "category" | "taxKind" | "invoiceNo">>; reason: string; route: WfStep[] }
  | { t: "reset" };

const nowIso = () => new Date().toISOString();

/** 操作を監査ログ（ハッシュチェーン）に追記。server モードでは送信待ち（auditOutbox）にも積む */
function logged(s: State, actor: string, action: string, patch: Partial<State> = {}): State {
  const body: AuditBody = { at: nowIso(), actor, action };
  return { ...s, ...patch, audit: append(s.audit, body), auditOutbox: STATIC ? s.auditOutbox : [...s.auditOutbox, body] };
}

export const EXPENSE_ACCOUNTS = ["6210", "6230", "6240", "6250", "6220", "6270", "6140", "6330"];

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "load": return a.s;
    case "outbox-clear": return { ...s, auditOutbox: s.auditOutbox.slice(a.n) };
    case "reset": return seedState(STATIC);
    case "read": return (s.read[a.emp] ?? []).includes(a.id) ? s : { ...s, read: { ...s.read, [a.emp]: [...(s.read[a.emp] ?? []), a.id] } };
    case "news": return logged(s, a.n.author, `お知らせ投稿: ${a.n.title}`, { news: [a.n, ...s.news] });
    case "news-del": return logged(s, "管理者", `お知らせ削除: ${a.id}`, { news: s.news.filter((n) => n.id !== a.id) });
    case "wf-new": return logged(s, a.w.applicantId, `申請: ${a.w.id}`, { workflows: [{ ...a.w, history: [{ at: nowIso(), by: a.w.applicantId, action: "申請" }] }, ...s.workflows] });
    case "wf-cancel":
      return logged(s, a.by, `取下げ: ${a.id}（${a.reason}）`, { workflows: s.workflows.map((w) => (w.id === a.id && w.applicantId === a.by && w.status === "承認待ち" ? { ...w, status: "取下げ", history: [...(w.history ?? []), { at: nowIso(), by: a.by, action: "取下げ", reason: a.reason }] } : w)) });
    case "wf-edit": {
      // 差戻し後の修正再申請。変更理由が必須。承認ルートは職務権限規程で再計算し、最初から承認をやり直す
      const w0 = s.workflows.find((w) => w.id === a.id);
      if (!w0 || w0.status !== "差戻し" || w0.applicantId !== a.by || !a.reason.trim()) return s;
      const ev: WfEvent = { at: nowIso(), by: a.by, action: "修正再申請", reason: a.reason };
      return logged(s, a.by, `修正再申請: ${a.id}（${a.reason}）`, { workflows: s.workflows.map((w) => (w.id === a.id ? { ...w, ...a.patch, status: "承認待ち", steps: a.route, history: [...(w.history ?? []), ev] } : w)) });
    }
    case "wf-act": {
      let auto: Omit<JournalCore, "id"> | null = null;
      const workflows = s.workflows.map((w) => {
        if (w.id !== a.id || w.status !== "承認待ち") return w;
        const idx = w.steps.findIndex((st) => st.state === "承認待ち");
        if (idx < 0 || w.steps[idx].approverId !== a.approverId) return w; // 現在の承認者以外は操作不可
        const steps: WfStep[] = w.steps.map((st, i) => (i === idx ? { ...st, state: a.act, at: nowIso(), comment: a.comment } : st));
        let status: Workflow["status"] = w.status;
        if (a.act === "承認") {
          if (idx + 1 < steps.length) steps[idx + 1] = { ...steps[idx + 1], state: "承認待ち" };
          else status = "承認済";
        } else status = a.act === "差戻し" ? "差戻し" : "却下";
        const nw = { ...w, steps, status, history: [...(w.history ?? []), { at: nowIso(), by: a.approverId, action: a.act, ...(a.comment.trim() ? { reason: a.comment.trim() } : {}) } as WfEvent] };
        if (status === "承認済") auto = STATIC ? workflowJournal(nw, s.employees.find((e) => e.id === w.applicantId)?.job, ymd(new Date())) : null; // サーバー版ではサーバーが仕訳を自動作成する
        return nw;
      });
      let journal = s.journal, note = "";
      const j = auto as Omit<JournalCore, "id"> | null;
      // 承認済みの経費は自動で仕訳化（締め済みの月・経理権限のない環境では計上しない）
      if (j && !s.closed.includes(j.date.slice(0, 7)) && !checkEntry(j)) { journal = postJournal(s.journal, j); note = `（仕訳 ${journal[journal.length - 1].id} を自動作成）`; }
      return logged(s, a.approverId, `${a.act}: ${a.id}${note}`, { workflows, journal });
    }
    case "att-set": {
      const cur = { ...(s.attendance[a.emp] ?? {}) };
      if (a.day) cur[a.date] = a.day; else delete cur[a.date];
      const attendance = { ...s.attendance, [a.emp]: cur };
      return a.log ? logged(s, a.by, a.log, { attendance }) : { ...s, attendance };
    }
    case "emp-import": {
      // 氏名（空白を除いて）で既存と照合して更新、無ければ追加。既存の権限は保持
      const norm = (n: string) => n.replace(/\s+/g, "");
      const employees = [...s.employees];
      let added = 0, updated = 0;
      for (const im of a.list) {
        const i = employees.findIndex((e) => norm(e.name) === norm(im.name));
        if (i >= 0) { employees[i] = { ...employees[i], ...im, id: employees[i].id, role: employees[i].role }; updated++; }
        else if (!employees.some((e) => e.id === im.id)) { employees.push({ ...im, role: defaultRole(im.job, im.employment) }); added++; }
      }
      return logged(s, a.by, `従業員マスタ取込: 追加${added}名・更新${updated}名`, { employees });
    }
    case "emp-update": {
      const emp = s.employees.find((e) => e.id === a.id);
      if (!emp) return s;
      // 最後の管理者を降格できない・社長の権限は変更できない（締め出し防止）
      if (a.patch.role && a.patch.role !== "admin" && (a.id === PRESIDENT_ID || s.employees.filter((e) => e.role === "admin").length <= 1 && emp.role === "admin")) return s;
      const label = a.patch.role ? `権限変更: ${emp.name} → ${a.patch.role}` : `従業員情報の更新: ${emp.name}`;
      return logged(s, a.by, label, { employees: s.employees.map((e) => (e.id === a.id ? { ...e, ...a.patch, id: e.id } : e)) });
    }
    case "cond-set": return logged(s, a.by, "勤怠の条件設定（休日マスタ等）を更新", { conditions: a.cond });
    case "journal-add": {
      if (checkEntry(a.core) || s.closed.includes(a.core.date.slice(0, 7))) return s;
      const journal = postJournal(s.journal, a.core);
      return logged(s, a.core.createdBy, `仕訳起票: ${journal[journal.length - 1].id}（承認待ち）`, { journal });
    }
    case "journal-approve": {
      const j = s.journal.find((x) => x.id === a.id);
      if (!j || j.createdBy === a.by || s.jApprovals[a.id]) return s; // 起票者本人は承認できない（職務分掌）
      return logged(s, a.by, `仕訳承認: ${a.id}`, { jApprovals: { ...s.jApprovals, [a.id]: { by: a.by, at: nowIso() } } });
    }
    case "journal-reverse": {
      const j = s.journal.find((x) => x.id === a.id);
      const date = ymd(new Date());
      if (!j || j.source === "reversal" || j.reverses || s.journal.some((x) => x.reverses === a.id) || s.closed.includes(date.slice(0, 7))) return s;
      const journal = postJournal(s.journal, reversal(j, a.by, date));
      return logged(s, a.by, `仕訳取消（反対仕訳 ${journal[journal.length - 1].id}）: ${a.id}`, { journal });
    }
    case "close-month": return s.closed.includes(a.month) ? s : logged(s, a.by, `月次締め: ${a.month}`, { closed: [...s.closed, a.month].sort() });
    case "ipo-set": return logged(s, a.by, `上場準備チェック: ${a.id}=${a.v}`, { ipo: { ...s.ipo, [a.id]: a.v } });
    case "export-log": return logged(s, a.by, `データ出力: ${a.what}`);
    case "doc-save": {
      const exists = s.docs.some((x) => x.id === a.doc.id);
      return logged(s, a.by, `文書${exists ? "更新" : "登録"}: ${a.doc.title}（${a.doc.version}）`, { docs: exists ? s.docs.map((x) => (x.id === a.doc.id ? a.doc : x)) : [a.doc, ...s.docs] });
    }
    case "doc-del": return logged(s, a.by, `文書削除: ${s.docs.find((x) => x.id === a.id)?.title ?? a.id}`, { docs: s.docs.filter((x) => x.id !== a.id) });
    case "doc-ack": return s.docAck[a.emp]?.[a.id] === a.version ? s : { ...s, docAck: { ...s.docAck, [a.emp]: { ...(s.docAck[a.emp] ?? {}), [a.id]: a.version } } };
    case "ev-save": {
      const exists = s.events.some((x) => x.id === a.ev.id);
      return logged(s, a.by, `予定${exists ? "更新" : "登録"}: ${a.ev.title}（${a.ev.date}）`, { events: exists ? s.events.map((x) => (x.id === a.ev.id ? a.ev : x)) : [...s.events, a.ev] });
    }
    case "ev-del": return logged(s, a.by, `予定削除: ${s.events.find((x) => x.id === a.id)?.title ?? a.id}`, { events: s.events.filter((x) => x.id !== a.id) });
    case "report-save": return { ...s, reports: { ...s.reports, [a.emp]: { ...(s.reports[a.emp] ?? {}), [a.report.date]: { ...(s.reports[a.emp]?.[a.report.date] ?? {}), ...a.report } } } };
    case "report-comment": {
      const r = s.reports[a.emp]?.[a.date];
      return r ? { ...s, reports: { ...s.reports, [a.emp]: { ...s.reports[a.emp], [a.date]: { ...r, comment: a.comment, commentBy: a.by } } } } : s;
    }
    case "kpi-save": {
      const exists = s.kpis.some((x) => x.id === a.kpi.id);
      return logged(s, a.by, `KPI${exists ? "更新" : "登録"}: ${a.kpi.name}`, { kpis: exists ? s.kpis.map((x) => (x.id === a.kpi.id ? a.kpi : x)) : [...s.kpis, a.kpi] });
    }
    case "kpi-del": return logged(s, a.by, `KPI削除: ${s.kpis.find((x) => x.id === a.id)?.name ?? a.id}`, { kpis: s.kpis.filter((x) => x.id !== a.id) });
    case "kpi-value": return { ...s, kpis: s.kpis.map((k) => { if (k.id !== a.id) return k; const values = { ...k.values }; if (a.value == null) delete values[a.month]; else values[a.month] = a.value; return { ...k, values }; }) };
    case "remote-save": {
      const exists = s.remotes.some((x) => x.id === a.remote.id);
      return logged(s, a.by, `リモート接続先${exists ? "更新" : "登録"}: ${a.remote.name}`, { remotes: exists ? s.remotes.map((x) => (x.id === a.remote.id ? a.remote : x)) : [...s.remotes, a.remote] });
    }
    case "file-add": return logged(s, a.rec.uploadedBy, `ファイル登録: ${a.rec.name}（${a.rec.kind}・${a.rec.scope}${a.rec.dept ? `・${a.rec.dept}` : ""}）`, { files: [a.rec, ...s.files] });
    case "file-del": return logged(s, a.by, `ファイル削除: ${s.files.find((f) => f.id === a.id)?.name ?? a.id}`, { files: s.files.filter((f) => f.id !== a.id), filesDel: STATIC ? s.filesDel : [...s.filesDel, a.id] });
    case "client-save": { const ex = s.clients.some((c) => c.code === a.client.code); return logged(s, a.by, `関与先${ex ? "更新" : "登録"}: ${a.client.code} ${a.client.name}`, { clients: ex ? s.clients.map((c) => (c.code === a.client.code ? a.client : c)) : [...s.clients, a.client] }); }
    case "client-del": return logged(s, a.by, `関与先削除: ${a.code}`, { clients: s.clients.filter((c) => c.code !== a.code) });
    case "check-add": return logged(s, a.check.checkedBy, `${a.check.kind}確認: ${a.check.clientCode} → ${a.check.result}`, { checks: [a.check, ...s.checks] });
    case "ext-save": { const ex = s.extLinks.some((l) => l.id === a.link.id); return logged(s, a.by, `外部リンク${ex ? "更新" : "登録"}: ${a.link.name}`, { extLinks: ex ? s.extLinks.map((l) => (l.id === a.link.id ? a.link : l)) : [...s.extLinks, a.link] }); }
    case "ext-del": return logged(s, a.by, `外部リンク削除: ${a.id}`, { extLinks: s.extLinks.filter((l) => l.id !== a.id) });
    case "mail-new": return { ...s, mails: [a.mail, ...s.mails] };
    case "mail-reply": return { ...s, mails: s.mails.map((m) => (m.id === a.id ? { ...m, thread: [...m.thread, { by: a.by, at: nowIso(), body: a.body }], status: m.status === "未対応" && m.from !== a.by ? "対応中" : m.status } : m)) };
    case "mail-status": return logged(s, a.by, `問い合わせ状態: ${a.id} → ${a.status}`, { mails: s.mails.map((m) => (m.id === a.id ? { ...m, status: a.status } : m)) });
    case "asset-save": { const ex = s.assets.some((x) => x.id === a.asset.id); return logged(s, a.by, `固定資産${ex ? "更新" : "登録"}: ${a.asset.id} ${a.asset.name}`, { assets: ex ? s.assets.map((x) => (x.id === a.asset.id ? a.asset : x)) : [...s.assets, a.asset] }); }
    case "asset-del": return logged(s, a.by, `固定資産削除: ${a.id}`, { assets: s.assets.filter((x) => x.id !== a.id) });
    case "authority-set": return logged(s, a.by, "職務権限規程（承認ルート）を更新", { authority: a.rules });
    case "benefit-save": { const ex = s.benefits.some((x) => x.id === a.benefit.id); return logged(s, a.by, `福利厚生${ex ? "更新" : "登録"}: ${a.benefit.title}`, { benefits: ex ? s.benefits.map((x) => (x.id === a.benefit.id ? a.benefit : x)) : [a.benefit, ...s.benefits] }); }
    case "benefit-del": return logged(s, a.by, `福利厚生削除: ${a.id}`, { benefits: s.benefits.filter((x) => x.id !== a.id) });
    case "retention-set": return logged(s, a.by, "履歴の保存期間を更新", { retention: a.retention });
    case "archive-apply": return a.recs.length ? logged({ ...a.next, files: [...a.recs, ...a.next.files] }, "system", `履歴アーカイブ: ${a.recs.map((r) => r.name).join("、")}`) : a.next; // 対象がない日は記録しない
    case "remote-del": return logged(s, a.by, `リモート接続先削除: ${s.remotes.find((x) => x.id === a.id)?.name ?? a.id}`, { remotes: s.remotes.filter((x) => x.id !== a.id) });
  }
}

type Ctx = {
  s: State;
  d: (a: Action) => void;
  meId: string;
  role: Role;
  me: Employee;
  emp: (id: string) => Employee | undefined;
  nameOf: (id: string) => string;
  nextWfId: () => string;
  approvalRoute: (type: WfType, amount: number | undefined, applicantId: string) => WfStep[];
  sync: "local" | "synced" | "saving" | "offline";
  posted: (j: Journal) => boolean;
  holidays: Set<string>;
  /** 自分が閲覧できるファイル・メッセージ（サーバー版は届く時点で絞り込み済み。デモ版は端末内の全データから、同じ規則で絞り込む） */
  files: FileRec[];
  mails: Mail[];
};
const C = createContext<Ctx | null>(null);
const FALLBACK: Employee = { id: "?", name: "?", employment: "", job: "", scheduled: 7.5, role: "employee" };

export function StoreProvider({ meId, role, children }: { meId: string; role: Role; children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, () => seedState(STATIC));
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const loaded = useRef(false);
  const lastJson = useRef("");
  const sRef = useRef(s);
  const [sync, setSync] = useState<Ctx["sync"]>(STATIC ? "local" : "synced");
  const [ready2, setReady2] = useState(false);
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; sRef.current = s; }, [sync, s]);

  // server モードで送る内容：サーバー計算の監査ログ本体は含めない／従業員は自分の分だけ（管理者は全員分）
  const payload = useCallback((st: State) => {
    const o: Record<string, unknown> = { ...st };
    delete o.audit;
    if (!can.viewAllAttendance(role)) { o.attendance = { [meId]: st.attendance[meId] ?? {} }; o.read = { [meId]: st.read[meId] ?? [] }; }
    if (!can.manageEmployees(role)) { delete o.employees; delete o.conditions; }
    if (!can.admin(role)) delete o.news;
    if (!can.viewAccounting(role)) for (const k of ["journal", "jApprovals", "closed", "ipo"]) delete o[k];
    // 書き込み権限のない業務データは送らない（サーバー側でも検証する）
    if (!can.manageDocs(role)) delete o.docs;
    if (!can.editCalendar(role)) delete o.events;
    if (!can.manageRemotes(role)) delete o.remotes;
    if (!can.manageKpis(role)) o.kpis = st.kpis.filter((k) => k.ownerId === meId);
    if (!can.viewAllReports(role)) o.reports = { [meId]: st.reports[meId] ?? {} };
    o.docAck = { [meId]: st.docAck[meId] ?? {} };
    // 書き込める分だけ送る（サーバーでも検証する）
    if (!can.manageClients(role)) delete o.clients;
    if (!can.manageAssets(role)) delete o.assets;
    if (!can.manageAuthority(role)) delete o.authority;
    if (!can.manageBenefits(role)) delete o.benefits;
    if (!can.manageExtLinks(role)) delete o.extLinks;
    if (!can.manageAuthority(role)) { delete o.retention; delete o.archiveMeta; }
    return o;
  }, [role, meId]);
  const fromServer = useCallback((raw: Partial<State>): State => ({ ...seedState(false), ...raw, audit: raw.audit ?? [], auditOutbox: [] }), []);

  useEffect(() => {
    (async () => {
      try {
        if (STATIC) {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const base = seedState(true), saved = JSON.parse(raw) as Partial<State>;
            // 旧データに無い項目（部署・上司・メール等）は、同じ番号のサンプルから補う
            const employees = (saved.employees ?? base.employees).map((e) => ({ ...(base.employees.find((b) => b.id === e.id) ?? {}), ...e }));
            d({ t: "load", s: { ...base, ...saved, employees } });
          }
        } else {
          const r = await fetch(`${BASE}/api/state`, { credentials: "same-origin", cache: "no-store" });
          if (r.ok) {
            const { state } = await r.json();
            if (state) { lastJson.current = JSON.stringify(payload(fromServer(state))); d({ t: "load", s: fromServer(state) }); }
          }
        }
      } catch { setSync("offline"); }
      loaded.current = true;
      setReady2(true);
    })();
  }, [payload, fromServer]);

  // 保存：static=localStorage / server=PUT（デバウンス）。サーバーが拒否した変更は応答の状態で巻き戻される
  useEffect(() => {
    if (!loaded.current) return;
    if (STATIC) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} return; }
    const body = JSON.stringify({ state: payload(s) });
    if (JSON.stringify(payload({ ...s, auditOutbox: [] })) === lastJson.current && s.auditOutbox.length === 0) return;
    setSync("saving");
    const sentOutbox = s.auditOutbox.length, snapshot = JSON.stringify(payload({ ...s, auditOutbox: [] }));
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${BASE}/api/state`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body });
        if (!r.ok) { setSync("offline"); return; }
        const { state } = await r.json();
        if (state) {
          const server = fromServer(state);
          const unchanged = JSON.stringify(payload({ ...sRef.current, auditOutbox: [] })) === snapshot; // 送信後に新しい操作がなければ、サーバーの確定状態で置き換える
          lastJson.current = JSON.stringify(payload(server));
          if (unchanged) d({ t: "load", s: { ...server, auditOutbox: sRef.current.auditOutbox.slice(sentOutbox) } });
          else d({ t: "outbox-clear", n: sentOutbox });
        }
        setSync("synced");
      } catch { setSync("offline"); }
    }, 500);
    return () => clearTimeout(t);
  }, [s, payload, fromServer]);

  // server モード：他の端末（PC・スマホ）の変更を即時に取り込む（SSEで通知→取得。切断時は60秒ごとの取得で補う）
  const pull = useCallback(async () => {
    if (!loaded.current || document.hidden || syncRef.current === "saving" || sRef.current.auditOutbox.length) return;
    try {
      const r = await fetch(`${BASE}/api/state`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return;
      const { state } = await r.json();
      if (state) {
        const server = fromServer(state), j = JSON.stringify(payload(server));
        if (j !== lastJson.current) { lastJson.current = j; d({ t: "load", s: server }); }
      }
      setSync("synced");
    } catch { setSync("offline"); }
  }, [payload, fromServer]);
  useEffect(() => {
    if (STATIC) return;
    const i = setInterval(pull, 60000);
    let es: EventSource | undefined;
    try { es = new EventSource(`${BASE}/api/events`); es.onmessage = () => { pull(); }; } catch {}
    const onVis = () => { if (!document.hidden) pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(i); es?.close(); document.removeEventListener("visibilitychange", onVis); };
  }, [pull]);

  const emp = useCallback((id: string) => s.employees.find((e) => e.id === id), [s.employees]);
  const nameOf = useCallback((id: string) => s.employees.find((e) => e.id === id)?.name ?? id, [s.employees]);
  const nextWfId = useCallback(() => { const y = new Date().getFullYear(); const n = Math.max(0, ...s.workflows.filter((w) => w.id.startsWith(`WF-${y}-`)).map((w) => Number(w.id.split("-")[2]) || 0)) + 1; return `WF-${y}-${String(n).padStart(4, "0")}`; }, [s.workflows]);

  // 承認ルート：職務権限規程（金額・種別ごとの承認者）から自動で決める
  const approvalRoute = useCallback((type: WfType, amount = 0, applicantId: string): WfStep[] => routeFor(s.employees, s.authority, type, amount, applicantId), [s.employees, s.authority]);

  const posted = useCallback((j: Journal) => isPosted(j, s.jApprovals), [s.jApprovals]);
  const holidays = useMemo(() => holidaySet(s.conditions), [s.conditions]);
  const me = useMemo(() => s.employees.find((e) => e.id === meId) ?? { ...FALLBACK, id: meId, name: meId, role }, [s.employees, meId, role]);
  const viewer = useMemo(() => viewerOf(me), [me]);
  const files = useMemo(() => s.files.filter((f) => canSeeFile(f, viewer, f.wfId ? s.workflows.find((w) => w.id === f.wfId) : undefined)), [s.files, s.workflows, viewer]);
  const mails = useMemo(() => s.mails.filter((m) => canSeeMail(m, viewer)).map((m) => maskMail(m, meId)), [s.mails, viewer, meId]);
  const v = useMemo(() => ({ s, d, meId, role, me, emp, nameOf, nextWfId, approvalRoute, sync, posted, holidays, files, mails }), [s, meId, role, me, emp, nameOf, nextWfId, approvalRoute, sync, posted, holidays, files, mails]);
  if (!ready || !ready2) return <div className="grid min-h-screen place-items-center text-ink-3">読み込み中…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
export type { TaxKind };
