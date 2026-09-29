"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  COURSES, NEWS_SEED, WF_SEED, ME_ID, MANAGER_ID,
  type News, type Role, type Workflow, type WfType, type WfStep,
} from "./data";

export type Punch = { in?: string; out?: string; note?: string };
export type Booking = { id: string; roomId: string; date: string; slot: string; title: string; by: string };
export type Ticket = { id: string; cat: string; title: string; body: string; status: "受付" | "対応中" | "完了"; createdAt: string; by: string };
export type Audit = { at: string; actor: string; action: string };

type State = {
  role: Role;
  news: News[];
  read: string[];
  workflows: Workflow[];
  punches: Record<string, Punch>;
  bookings: Booking[];
  progress: Record<string, number>;
  tickets: Ticket[];
  audit: Audit[];
};

const KEY = "mirai-portal-v1";

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// 当月の過去の平日に、決定的な打刻データを生成（デモ用）
function seedPunches(): Record<string, Punch> {
  const now = new Date();
  const out: Record<string, Punch> = {};
  for (let day = 1; day < now.getDate(); day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), day);
    const w = d.getDay();
    if (w === 0 || w === 6) continue;
    const inMin = 8 * 60 + 40 + ((day * 7) % 25);
    const outMin = 18 * 60 + ((day * 13) % 95) + (day % 6 === 0 ? 120 : 0);
    out[ymd(d)] = { in: `${pad(Math.floor(inMin / 60))}:${pad(inMin % 60)}`, out: `${pad(Math.floor(outMin / 60))}:${pad(outMin % 60)}` };
  }
  return out;
}

function initial(): State {
  const p: Record<string, number> = {};
  COURSES.forEach((c) => (p[c.id] = c.progress));
  return {
    role: "employee",
    news: NEWS_SEED,
    read: ["n3", "n5"],
    workflows: WF_SEED,
    punches: seedPunches(),
    bookings: [
      { id: "b1", roomId: "r1", date: ymd(new Date()), slot: "10:00", title: "営業定例会議", by: "E1007" },
      { id: "b2", roomId: "r5", date: ymd(new Date()), slot: "14:00", title: "取締役会 事前打合せ", by: "E1001" },
    ],
    progress: p,
    tickets: [
      { id: "T-3021", cat: "IT", title: "VPN接続が頻繁に切れる", body: "在宅勤務時に30分ほどで切断されます。", status: "対応中", createdAt: "2026-09-26", by: ME_ID },
    ],
    audit: [],
  };
}

type Action =
  | { t: "load"; s: State }
  | { t: "role"; role: Role }
  | { t: "read"; id: string }
  | { t: "news"; n: News }
  | { t: "news-del"; id: string }
  | { t: "wf-new"; w: Workflow }
  | { t: "wf-act"; id: string; approverId: string; act: "承認" | "差戻し" | "却下"; comment: string }
  | { t: "wf-cancel"; id: string }
  | { t: "punch"; date: string; p: Punch }
  | { t: "book"; b: Booking }
  | { t: "unbook"; id: string }
  | { t: "progress"; id: string; v: number }
  | { t: "ticket"; tk: Ticket }
  | { t: "ticket-status"; id: string; status: Ticket["status"] }
  | { t: "reset" };

const now = () => new Date().toLocaleString("ja-JP");

function reducer(s: State, a: Action): State {
  const log = (actor: string, action: string): Audit[] => [{ at: now(), actor, action }, ...s.audit].slice(0, 100);
  switch (a.t) {
    case "load": return a.s;
    case "reset": return initial();
    case "role": return { ...s, role: a.role, audit: log(a.role, "ロール切替（デモ）") };
    case "read": return s.read.includes(a.id) ? s : { ...s, read: [...s.read, a.id] };
    case "news": return { ...s, news: [a.n, ...s.news], audit: log(a.n.author, `お知らせ投稿: ${a.n.title}`) };
    case "news-del": return { ...s, news: s.news.filter((n) => n.id !== a.id), audit: log("admin", `お知らせ削除: ${a.id}`) };
    case "wf-new": return { ...s, workflows: [a.w, ...s.workflows], audit: log(a.w.applicantId, `申請: ${a.w.id}`) };
    case "wf-cancel":
      return { ...s, workflows: s.workflows.map((w) => (w.id === a.id ? { ...w, status: "取下げ" } : w)), audit: log("申請者", `取下げ: ${a.id}`) };
    case "wf-act":
      return {
        ...s,
        workflows: s.workflows.map((w) => {
          if (w.id !== a.id) return w;
          const idx = w.steps.findIndex((st) => st.state === "承認待ち");
          if (idx < 0) return w;
          const steps: WfStep[] = w.steps.map((st, i) => (i === idx ? { ...st, state: a.act, at: ymd(new Date()), comment: a.comment } : st));
          let status = w.status;
          if (a.act === "承認") {
            if (idx + 1 < steps.length) steps[idx + 1] = { ...steps[idx + 1], state: "承認待ち" };
            else status = "承認済";
          } else status = a.act === "差戻し" ? "差戻し" : "却下";
          return { ...w, steps, status };
        }),
        audit: log(a.approverId, `${a.act}: ${a.id}`),
      };
    case "punch": return { ...s, punches: { ...s.punches, [a.date]: { ...s.punches[a.date], ...a.p } } };
    case "book": return { ...s, bookings: [...s.bookings, a.b], audit: log(a.b.by, `会議室予約: ${a.b.roomId} ${a.b.date} ${a.b.slot}`) };
    case "unbook": return { ...s, bookings: s.bookings.filter((b) => b.id !== a.id) };
    case "progress": return { ...s, progress: { ...s.progress, [a.id]: Math.min(100, a.v) } };
    case "ticket": return { ...s, tickets: [a.tk, ...s.tickets], audit: log(a.tk.by, `チケット起票: ${a.tk.id}`) };
    case "ticket-status": return { ...s, tickets: s.tickets.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)) };
  }
}

type Ctx = {
  s: State;
  d: (a: Action) => void;
  meId: string;
  nextWfId: (type: WfType) => string;
  approvalRoute: (type: WfType, amount?: number) => WfStep[];
};
const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, initial);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) d({ t: "load", s: { ...initial(), ...JSON.parse(raw) } });
    } catch {}
    loaded.current = true;
  }, []);

  const meId = s.role === "employee" ? ME_ID : s.role === "approver" ? MANAGER_ID : "E1002";

  const nextWfId = useCallback(() => `WF-2026-${String(413 + s.workflows.length).padStart(4, "0")}`, [s.workflows.length]);

  // 決裁権限表に基づく承認ルートの自動生成（金額・種別で分岐）
  const approvalRoute = useCallback((type: WfType, amount = 0): WfStep[] => {
    const steps: WfStep[] = [{ approverId: MANAGER_ID, label: "所属長", state: "承認待ち" }];
    if (type === "稟議" || type === "IT機器・アカウント申請") steps.push({ approverId: "E1006", label: "情報システム部（セキュリティ審査）", state: "待機" });
    if (type === "経費精算" || type === "出張申請" || amount >= 100000) steps.push({ approverId: "E1004", label: "経理財務部", state: "待機" });
    if (type === "稟議" && amount >= 1000000) steps.push({ approverId: "E1001", label: "経営企画部（決裁権限表：100万円以上）", state: "待機" });
    return steps;
  }, []);

  const v = useMemo(() => ({ s, d, meId, nextWfId, approvalRoute }), [s, meId, nextWfId, approvalRoute]);
  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-3">読み込み中…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
