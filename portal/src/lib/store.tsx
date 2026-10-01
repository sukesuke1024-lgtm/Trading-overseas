"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PRESIDENT_ID, defaultRole, type Employee, type News, type Role, type WfStep, type WfType, type Workflow } from "./data";
import { BASE, STATIC } from "./auth";
import { append, type Chained } from "./chain";
import { can } from "./perm";
import { seedState } from "./seed";
import { acct, checkEntry, isInvoiceNo, isPosted, postJournal, reversal, type Approvals, type Journal, type JournalCore, type TaxKind } from "./accounting";
import { holidaySet, workdaysBetween, type Conditions, type DayInput } from "./work";

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
  | { t: "wf-cancel"; id: string; by: string }
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
  | { t: "reset" };

const nowIso = () => new Date().toISOString();

/** 操作を監査ログ（ハッシュチェーン）に追記。server モードでは送信待ち（auditOutbox）にも積む */
function logged(s: State, actor: string, action: string, patch: Partial<State> = {}): State {
  const body: AuditBody = { at: nowIso(), actor, action };
  return { ...s, ...patch, audit: append(s.audit, body), auditOutbox: STATIC ? s.auditOutbox : [...s.auditOutbox, body] };
}

export const EXPENSE_ACCOUNTS = ["6210", "6230", "6240", "6250", "6220", "6270", "6140", "6330"];

function workflowJournal(w: Workflow, job?: string): Omit<JournalCore, "id"> | null {
  if ((w.type !== "経費精算" && w.type !== "出張申請") || !w.amount) return null;
  const code = w.category && acct(w.category) ? w.category : "6210";
  const taxable = (w.taxKind ?? "課税10%") === "課税10%" && !!w.invoiceNo && isInvoiceNo(w.invoiceNo); // 適格請求書がなければ仕入税額控除しない
  const tax = taxable ? Math.round((w.amount * 10) / 110) : 0;
  return {
    date: ymd(new Date()), memo: `${w.type}：${w.title}`, evidenceNo: w.id, invoiceNo: w.invoiceNo, source: "workflow", createdBy: "system",
    lines: [{ account: code, side: "D", amount: w.amount - tax, tax: taxable ? "課税10%" : "対象外", dept: job }, ...(tax ? [{ account: "1510", side: "D" as const, amount: tax }] : []), { account: "2120", side: "C", amount: w.amount }],
  };
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "load": return a.s;
    case "outbox-clear": return { ...s, auditOutbox: s.auditOutbox.slice(a.n) };
    case "reset": return seedState(STATIC);
    case "read": return (s.read[a.emp] ?? []).includes(a.id) ? s : { ...s, read: { ...s.read, [a.emp]: [...(s.read[a.emp] ?? []), a.id] } };
    case "news": return logged(s, a.n.author, `お知らせ投稿: ${a.n.title}`, { news: [a.n, ...s.news] });
    case "news-del": return logged(s, "管理者", `お知らせ削除: ${a.id}`, { news: s.news.filter((n) => n.id !== a.id) });
    case "wf-new": return logged(s, a.w.applicantId, `申請: ${a.w.id}`, { workflows: [a.w, ...s.workflows] });
    case "wf-cancel":
      return logged(s, a.by, `取下げ: ${a.id}`, { workflows: s.workflows.map((w) => (w.id === a.id && w.applicantId === a.by && w.status === "承認待ち" ? { ...w, status: "取下げ" } : w)) });
    case "wf-act": {
      let auto: Omit<JournalCore, "id"> | null = null;
      const workflows = s.workflows.map((w) => {
        if (w.id !== a.id || w.status !== "承認待ち") return w;
        const idx = w.steps.findIndex((st) => st.state === "承認待ち");
        if (idx < 0 || w.steps[idx].approverId !== a.approverId) return w; // 現在の承認者以外は操作不可
        const steps: WfStep[] = w.steps.map((st, i) => (i === idx ? { ...st, state: a.act, at: ymd(new Date()), comment: a.comment } : st));
        let status: Workflow["status"] = w.status;
        if (a.act === "承認") {
          if (idx + 1 < steps.length) steps[idx + 1] = { ...steps[idx + 1], state: "承認待ち" };
          else status = "承認済";
        } else status = a.act === "差戻し" ? "差戻し" : "却下";
        const nw = { ...w, steps, status };
        if (status === "承認済") auto = workflowJournal(nw, s.employees.find((e) => e.id === w.applicantId)?.job);
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
    return o;
  }, [role, meId]);
  const fromServer = useCallback((raw: Partial<State>): State => ({ ...seedState(false), ...raw, audit: raw.audit ?? [], auditOutbox: [] }), []);

  useEffect(() => {
    (async () => {
      try {
        if (STATIC) {
          const raw = localStorage.getItem(KEY);
          if (raw) d({ t: "load", s: { ...seedState(true), ...JSON.parse(raw) } });
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
  const nextWfId = useCallback(() => `WF-${new Date().getFullYear()}-${String(s.workflows.length + 1).padStart(4, "0")}`, [s.workflows.length]);

  // 承認ルート：社長（代表取締役）→（稟議100万円以上は）もう1名の役員/管理者。申請者本人は承認者にならない（他に承認者がいない社長のみ自己決裁）
  const approvalRoute = useCallback((type: WfType, amount = 0, applicantId: string): WfStep[] => {
    const approvers = s.employees.filter((e) => (e.role === "admin" || e.role === "executive") && e.id !== applicantId);
    const president = approvers.find((e) => e.id === PRESIDENT_ID) ?? approvers[0];
    if (!president) return [{ approverId: applicantId, label: "代表者（自己決裁）", state: "承認待ち" }];
    const steps: WfStep[] = [{ approverId: president.id, label: president.id === PRESIDENT_ID ? "代表取締役" : "承認者", state: "承認待ち" }];
    if (type === "稟議" && amount >= 1_000_000) {
      const second = approvers.find((e) => e.id !== president.id);
      if (second) steps.push({ approverId: second.id, label: "役員（100万円以上）", state: "待機" });
    }
    return steps;
  }, [s.employees]);

  const posted = useCallback((j: Journal) => isPosted(j, s.jApprovals), [s.jApprovals]);
  const holidays = useMemo(() => holidaySet(s.conditions), [s.conditions]);
  const me = useMemo(() => s.employees.find((e) => e.id === meId) ?? { ...FALLBACK, id: meId, name: meId, role }, [s.employees, meId, role]);
  const v = useMemo(() => ({ s, d, meId, role, me, emp, nameOf, nextWfId, approvalRoute, sync, posted, holidays }), [s, meId, role, me, emp, nameOf, nextWfId, approvalRoute, sync, posted, holidays]);
  if (!ready || !ready2) return <div className="grid min-h-screen place-items-center text-ink-3">読み込み中…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
export type { TaxKind };
