"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  managerOf, empById,
  type News, type Role, type Workflow, type WfType, type WfStep,
} from "./data";
import { BASE, STATIC } from "./auth";
import { append, type Chained } from "./chain";
import { can } from "./perm";
import { seedState } from "./seed";
import { acct, checkEntry, isInvoiceNo, isPosted, postJournal, reversal, type Approvals, type Journal, type JournalCore, type TaxKind } from "./accounting";
import { payrollLines, totals, type PayRow } from "./payroll";

export type Punch = { in?: string; out?: string; break?: number; place?: string; note?: string; edited?: boolean };
export type Booking = { id: string; roomId: string; date: string; slot: string; title: string; by: string };
export type Ticket = { id: string; cat: string; title: string; body: string; status: "受付" | "対応中" | "完了"; createdAt: string; by: string };
export type AuditBody = { at: string; actor: string; action: string };
export type Audit = AuditBody & Chained;
export type PayrollRun = { month: string; status: "計算済" | "確定"; rows: PayRow[]; at: string; by: string; journalId?: string };

export type State = {
  news: News[];
  read: Record<string, string[]>;
  workflows: Workflow[];
  punches: Record<string, Record<string, Punch>>; // 社員ID → 日付 → 打刻
  bookings: Booking[];
  progress: Record<string, Record<string, number>>; // 社員ID → コースID → %
  tickets: Ticket[];
  audit: Audit[]; // 古い順・ハッシュチェーン
  auditOutbox: AuditBody[]; // server モード：サーバーへ送って連鎖に追記してもらう未送信の操作
  journal: Journal[];
  jApprovals: Approvals;
  payroll: Record<string, PayrollRun>;
  closed: string[]; // 月次締め済み（YYYY-MM）
  ipo: Record<string, boolean>;
};

const KEY = "mirai-portal-v3";

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export { leaveDatesOf } from "./seed";

function initial(role: Role): State {
  return seedState(can.viewAccounting(role)); // 会計データは権限のあるロールでのみ初期投入
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
  | { t: "punch"; emp: string; date: string; p: Punch; log?: string }
  | { t: "book"; b: Booking }
  | { t: "unbook"; id: string }
  | { t: "progress"; emp: string; id: string; v: number }
  | { t: "ticket"; tk: Ticket }
  | { t: "ticket-status"; id: string; status: Ticket["status"] }
  | { t: "journal-add"; core: Omit<JournalCore, "id"> }
  | { t: "journal-approve"; id: string; by: string }
  | { t: "journal-reverse"; id: string; by: string }
  | { t: "close-month"; month: string; by: string }
  | { t: "payroll-save"; run: PayrollRun }
  | { t: "payroll-confirm"; month: string; by: string }
  | { t: "ipo-set"; id: string; v: boolean; by: string }
  | { t: "export-log"; by: string; what: string }
  | { t: "reset"; role: Role };

const nowIso = () => new Date().toISOString();

/** 操作を監査ログ（ハッシュチェーン）に追記。server モードでは送信待ち（auditOutbox）にも積む */
function logged(s: State, actor: string, action: string, patch: Partial<State> = {}): State {
  const body: AuditBody = { at: nowIso(), actor, action };
  return { ...s, ...patch, audit: append(s.audit, body), auditOutbox: STATIC ? s.auditOutbox : [...s.auditOutbox, body] };
}

export const EXPENSE_ACCOUNTS = ["6210", "6230", "6240", "6250", "6220", "6270", "6140", "6330"];

function workflowJournal(w: Workflow): Omit<JournalCore, "id"> | null {
  if ((w.type !== "経費精算" && w.type !== "出張申請") || !w.amount) return null;
  const code = w.category && acct(w.category) ? w.category : "6210";
  const taxable = (w.taxKind ?? "課税10%") === "課税10%" && !!w.invoiceNo && isInvoiceNo(w.invoiceNo); // 適格請求書がなければ仕入税額控除しない
  const tax = taxable ? Math.round((w.amount * 10) / 110) : 0;
  const dept = empById(w.applicantId)?.dept;
  return {
    date: ymd(new Date()), memo: `${w.type}：${w.title}`, partner: empById(w.applicantId)?.name, evidenceNo: w.id, invoiceNo: w.invoiceNo, source: "workflow", createdBy: "system",
    lines: [{ account: code, side: "D", amount: w.amount - tax, tax: taxable ? "課税10%" : "対象外", dept }, ...(tax ? [{ account: "1510", side: "D" as const, amount: tax }] : []), { account: "2120", side: "C", amount: w.amount }],
  };
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "load": return a.s;
    case "outbox-clear": return { ...s, auditOutbox: s.auditOutbox.slice(a.n) };
    case "reset": return initial(a.role);
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
        if (status === "承認済") auto = workflowJournal(nw);
        return nw;
      });
      let journal = s.journal, note = "";
      const j = auto as Omit<JournalCore, "id"> | null;
      // 承認済みの経費は自動で仕訳化（締め済みの月・経理権限のない環境では計上しない）
      if (j && !s.closed.includes(j.date.slice(0, 7)) && (STATIC || s.journal.length > 0) && !checkEntry(j)) { journal = postJournal(s.journal, j); note = `（仕訳 ${journal[journal.length - 1].id} を自動作成）`; }
      return logged(s, a.approverId, `${a.act}: ${a.id}${note}`, { workflows, journal });
    }
    case "punch": {
      const cur = s.punches[a.emp]?.[a.date];
      const punches = { ...s.punches, [a.emp]: { ...s.punches[a.emp], [a.date]: { ...cur, ...a.p } } };
      return a.log ? logged(s, a.emp, a.log, { punches }) : { ...s, punches };
    }
    case "book": return logged(s, a.b.by, `会議室予約: ${a.b.roomId} ${a.b.date} ${a.b.slot}`, { bookings: [...s.bookings, a.b] });
    case "unbook": return { ...s, bookings: s.bookings.filter((b) => b.id !== a.id) };
    case "progress": return { ...s, progress: { ...s.progress, [a.emp]: { ...s.progress[a.emp], [a.id]: Math.min(100, a.v) } } };
    case "ticket": return logged(s, a.tk.by, `チケット起票: ${a.tk.id}`, { tickets: [a.tk, ...s.tickets] });
    case "ticket-status": return { ...s, tickets: s.tickets.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)) };

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
    case "payroll-save": {
      if (s.payroll[a.run.month]?.status === "確定") return s;
      return logged(s, a.run.by, `給与計算: ${a.run.month}（${a.run.rows.length}名）`, { payroll: { ...s.payroll, [a.run.month]: a.run } });
    }
    case "payroll-confirm": {
      const run = s.payroll[a.month];
      if (!run || run.status === "確定" || s.closed.includes(a.month)) return s;
      const p = payrollLines(totals(run.rows), a.month);
      const core = { date: `${a.month}-25`, memo: p.memo, source: "payroll", evidenceNo: `PAY-${a.month}`, createdBy: a.by, lines: p.lines };
      if (checkEntry(core)) return s;
      const journal = postJournal(s.journal, core);
      return logged(s, a.by, `給与確定: ${a.month}（仕訳 ${journal[journal.length - 1].id}）`, { journal, payroll: { ...s.payroll, [a.month]: { ...run, status: "確定", journalId: journal[journal.length - 1].id } } });
    }
    case "ipo-set": return logged(s, a.by, `上場準備チェック: ${a.id}=${a.v}`, { ipo: { ...s.ipo, [a.id]: a.v } });
    case "export-log": return logged(s, a.by, `データ出力: ${a.what}`);
  }
}

type Ctx = {
  s: State;
  d: (a: Action) => void;
  meId: string;
  role: Role;
  nextWfId: () => string;
  approvalRoute: (type: WfType, amount: number | undefined, applicantId: string) => WfStep[];
  sync: "local" | "synced" | "saving" | "offline";
  posted: (j: Journal) => boolean;
};
const C = createContext<Ctx | null>(null);

export function StoreProvider({ meId, role, children }: { meId: string; role: Role; children: ReactNode }) {
  const [s, d] = useReducer(reducer, role, initial);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const loaded = useRef(false);
  const lastJson = useRef("");
  const sRef = useRef(s);
  const [sync, setSync] = useState<Ctx["sync"]>(STATIC ? "local" : "synced");
  const [ready2, setReady2] = useState(false);
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; sRef.current = s; }, [sync, s]);

  // server モードで送る内容：閲覧権限のない項目・サーバー計算の監査ログ本体は含めない
  const payload = useCallback((st: State) => {
    const o: Record<string, unknown> = { ...st };
    delete o.audit;
    // 自分が書き込める範囲だけ送る（他人の分・権限のない項目は送らない）
    o.punches = { [meId]: st.punches[meId] ?? {} };
    o.read = { [meId]: st.read[meId] ?? [] };
    o.progress = { [meId]: st.progress[meId] ?? {} };
    if (!can.admin(role)) delete o.news;
    if (!can.viewAccounting(role)) for (const k of ["journal", "jApprovals", "payroll", "closed", "ipo"]) delete o[k];
    else if (!can.viewPayroll(role)) delete o.payroll;
    return o;
  }, [role, meId]);
  const fromServer = useCallback((raw: Partial<State>): State => ({ ...initial(role), ...raw, audit: raw.audit ?? [], auditOutbox: [] }), [role]);

  useEffect(() => {
    (async () => {
      try {
        if (STATIC) {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const st: State = { ...initial(role), ...JSON.parse(raw) };
            // 同じブラウザで先に一般社員としてログインしていた場合でも、経理ロールで会計データを初期投入する（デモ）
            if (can.viewAccounting(role) && st.journal.length === 0) { const seed = initial(role); st.journal = seed.journal; st.closed = seed.closed; }
            d({ t: "load", s: st });
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
  }, [role, payload, fromServer]);

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

  const nextWfId = useCallback(() => `WF-2026-${String(413 + s.workflows.length).padStart(4, "0")}`, [s.workflows.length]);

  // 決裁権限表に基づく承認ルートの自動生成（金額・種別で分岐）
  const approvalRoute = useCallback((type: WfType, amount = 0, applicantId: string): WfStep[] => {
    const steps: WfStep[] = [{ approverId: managerOf(applicantId), label: "所属長", state: "承認待ち" }];
    if (type === "稟議" || type === "IT機器・アカウント申請") steps.push({ approverId: "E1006", label: "情報システム部（セキュリティ審査）", state: "待機" });
    if (type === "経費精算" || type === "出張申請" || amount >= 100000) steps.push({ approverId: "E1004", label: "経理財務部", state: "待機" });
    if (type === "稟議" && amount >= 1000000) steps.push({ approverId: "E1001", label: "経営企画部（決裁権限表：100万円以上）", state: "待機" });
    return steps.filter((st, i, arr) => i === 0 || (st.approverId !== applicantId && arr.findIndex((x) => x.approverId === st.approverId) === i));
  }, []);

  const posted = useCallback((j: Journal) => isPosted(j, s.jApprovals), [s.jApprovals]);
  const v = useMemo(() => ({ s, d, meId, role, nextWfId, approvalRoute, sync, posted }), [s, meId, role, nextWfId, approvalRoute, sync, posted]);
  if (!ready || !ready2) return <div className="grid min-h-screen place-items-center text-ink-3">読み込み中…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
export type { TaxKind };
