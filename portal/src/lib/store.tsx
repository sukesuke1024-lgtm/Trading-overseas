"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  COURSES, NEWS_SEED, WF_SEED, EMPLOYEES, managerOf,
  type News, type Role, type Workflow, type WfType, type WfStep,
} from "./data";
import { BASE, STATIC } from "./auth";
import { dayKind, workdaysBetween } from "./attendance-calc";

export type Punch = { in?: string; out?: string; break?: number; place?: string; note?: string; edited?: boolean };
export type Booking = { id: string; roomId: string; date: string; slot: string; title: string; by: string };
export type Ticket = { id: string; cat: string; title: string; body: string; status: "受付" | "対応中" | "完了"; createdAt: string; by: string };
export type Audit = { at: string; actor: string; action: string };

export type State = {
  news: News[];
  read: Record<string, string[]>;
  workflows: Workflow[];
  punches: Record<string, Record<string, Punch>>; // 社員ID → 日付 → 打刻
  bookings: Booking[];
  progress: Record<string, Record<string, number>>; // 社員ID → コースID → %
  tickets: Ticket[];
  audit: Audit[];
};

const KEY = "mirai-portal-v2";

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 承認済み休暇申請の日付（平日のみ）。申請者ごと */
export function leaveDatesOf(workflows: Workflow[], empId: string, statuses: Workflow["status"][] = ["承認済"]) {
  const set = new Set<string>();
  for (const w of workflows) {
    if (w.type === "休暇申請" && w.applicantId === empId && statuses.includes(w.status) && w.from && w.to) workflowsDays(w.from, w.to).forEach((d) => set.add(d));
  }
  return set;
}
const workflowsDays = (from: string, to: string) => workdaysBetween(from, to);

// 当月の過去の平日に、決定的な打刻データを生成（デモ用）
function seedPunches(): State["punches"] {
  const now = new Date();
  const out: State["punches"] = {};
  EMPLOYEES.forEach((e, idx) => {
    const leave = leaveDatesOf(WF_SEED, e.id);
    out[e.id] = {};
    for (let day = 1; day < now.getDate(); day++) {
      const k = ymd(new Date(now.getFullYear(), now.getMonth(), day));
      if (dayKind(k) !== "workday" || leave.has(k)) continue;
      const inMin = 8 * 60 + 40 + ((day * 7 + idx * 3) % 25);
      const outMin = 18 * 60 + ((day * 13 + idx * 5) % 95) + (day % 6 === 0 ? 120 : 0);
      out[e.id][k] = { in: `${pad(Math.floor(inMin / 60))}:${pad(inMin % 60)}`, out: `${pad(Math.floor(outMin / 60))}:${pad(outMin % 60)}`, place: day % 5 === 0 ? "在宅" : "オフィス" };
    }
  });
  return out;
}

function initial(): State {
  const progress: State["progress"] = {};
  for (const e of EMPLOYEES) { progress[e.id] = {}; COURSES.forEach((c) => (progress[e.id][c.id] = e.id === "E1012" ? c.progress : 0)); }
  return {
    news: NEWS_SEED,
    read: { E1012: ["n3", "n5"] },
    workflows: WF_SEED,
    punches: seedPunches(),
    bookings: [
      { id: "b1", roomId: "r1", date: ymd(new Date()), slot: "10:00", title: "営業定例会議", by: "E1007" },
      { id: "b2", roomId: "r5", date: ymd(new Date()), slot: "14:00", title: "取締役会 事前打合せ", by: "E1001" },
    ],
    progress,
    tickets: [{ id: "T-3021", cat: "IT", title: "VPN接続が頻繁に切れる", body: "在宅勤務時に30分ほどで切断されます。", status: "対応中", createdAt: "2026-09-26", by: "E1012" }],
    audit: [],
  };
}

type Action =
  | { t: "load"; s: State }
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
  | { t: "reset" };

const now = () => new Date().toLocaleString("ja-JP");

function reducer(s: State, a: Action): State {
  const log = (actor: string, action: string): Audit[] => [{ at: now(), actor, action }, ...s.audit].slice(0, 200);
  switch (a.t) {
    case "load": return a.s;
    case "reset": return initial();
    case "read": return (s.read[a.emp] ?? []).includes(a.id) ? s : { ...s, read: { ...s.read, [a.emp]: [...(s.read[a.emp] ?? []), a.id] } };
    case "news": return { ...s, news: [a.n, ...s.news], audit: log(a.n.author, `お知らせ投稿: ${a.n.title}`) };
    case "news-del": return { ...s, news: s.news.filter((n) => n.id !== a.id), audit: log("管理者", `お知らせ削除: ${a.id}`) };
    case "wf-new": return { ...s, workflows: [a.w, ...s.workflows], audit: log(a.w.applicantId, `申請: ${a.w.id}`) };
    case "wf-cancel":
      return { ...s, workflows: s.workflows.map((w) => (w.id === a.id && w.applicantId === a.by && w.status === "承認待ち" ? { ...w, status: "取下げ" } : w)), audit: log(a.by, `取下げ: ${a.id}`) };
    case "wf-act":
      return {
        ...s,
        workflows: s.workflows.map((w) => {
          if (w.id !== a.id || w.status !== "承認待ち") return w;
          const idx = w.steps.findIndex((st) => st.state === "承認待ち");
          if (idx < 0 || w.steps[idx].approverId !== a.approverId) return w; // 現在の承認者以外は操作不可
          const steps: WfStep[] = w.steps.map((st, i) => (i === idx ? { ...st, state: a.act, at: ymd(new Date()), comment: a.comment } : st));
          let status: Workflow["status"] = w.status;
          if (a.act === "承認") {
            if (idx + 1 < steps.length) steps[idx + 1] = { ...steps[idx + 1], state: "承認待ち" };
            else status = "承認済";
          } else status = a.act === "差戻し" ? "差戻し" : "却下";
          return { ...w, steps, status };
        }),
        audit: log(a.approverId, `${a.act}: ${a.id}`),
      };
    case "punch": {
      const cur = s.punches[a.emp]?.[a.date];
      return { ...s, punches: { ...s.punches, [a.emp]: { ...s.punches[a.emp], [a.date]: { ...cur, ...a.p } } }, audit: a.log ? log(a.emp, a.log) : s.audit };
    }
    case "book": return { ...s, bookings: [...s.bookings, a.b], audit: log(a.b.by, `会議室予約: ${a.b.roomId} ${a.b.date} ${a.b.slot}`) };
    case "unbook": return { ...s, bookings: s.bookings.filter((b) => b.id !== a.id) };
    case "progress": return { ...s, progress: { ...s.progress, [a.emp]: { ...s.progress[a.emp], [a.id]: Math.min(100, a.v) } } };
    case "ticket": return { ...s, tickets: [a.tk, ...s.tickets], audit: log(a.tk.by, `チケット起票: ${a.tk.id}`) };
    case "ticket-status": return { ...s, tickets: s.tickets.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)) };
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
};
const C = createContext<Ctx | null>(null);

export function StoreProvider({ meId, role, children }: { meId: string; role: Role; children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, initial);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const loaded = useRef(false);
  const lastJson = useRef("");
  const [sync, setSync] = useState<Ctx["sync"]>(STATIC ? "local" : "synced");
  const [ready2, setReady2] = useState(false);
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  // 初回ロード：static=localStorage / server=API（共有DB）
  useEffect(() => {
    (async () => {
      try {
        if (STATIC) {
          const raw = localStorage.getItem(KEY);
          if (raw) d({ t: "load", s: { ...initial(), ...JSON.parse(raw) } });
        } else {
          const r = await fetch(`${BASE}/api/state`, { credentials: "same-origin", cache: "no-store" });
          if (r.ok) {
            const { state } = await r.json();
            if (state) { lastJson.current = JSON.stringify(state); d({ t: "load", s: { ...initial(), ...state } }); }
          }
        }
      } catch { setSync("offline"); }
      loaded.current = true;
      setReady2(true);
    })();
  }, []);

  // 保存：static=localStorage / server=PUT（デバウンス）
  useEffect(() => {
    if (!loaded.current) return;
    const json = JSON.stringify(s);
    if (STATIC) { try { localStorage.setItem(KEY, json); } catch {} return; }
    if (json === lastJson.current) return;
    setSync("saving");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${BASE}/api/state`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: s }) });
        if (r.ok) { lastJson.current = json; setSync("synced"); } else setSync("offline");
      } catch { setSync("offline"); }
    }, 500);
    return () => clearTimeout(t);
  }, [s]);

  // server モード：他の端末（スマホ等）の変更を15秒ごとに取り込む
  useEffect(() => {
    if (STATIC) return;
    const i = setInterval(async () => {
      if (!loaded.current || document.hidden || syncRef.current === "saving") return;
      try {
        const r = await fetch(`${BASE}/api/state`, { credentials: "same-origin", cache: "no-store" });
        if (!r.ok) return;
        const { state } = await r.json();
        const j = JSON.stringify(state);
        if (state && j !== lastJson.current) { lastJson.current = j; d({ t: "load", s: { ...initial(), ...state } }); }
        setSync("synced");
      } catch { setSync("offline"); }
    }, 15000);
    return () => clearInterval(i);
  }, []);

  const nextWfId = useCallback(() => `WF-2026-${String(413 + s.workflows.length).padStart(4, "0")}`, [s.workflows.length]);

  // 決裁権限表に基づく承認ルートの自動生成（金額・種別で分岐）
  const approvalRoute = useCallback((type: WfType, amount = 0, applicantId: string): WfStep[] => {
    const steps: WfStep[] = [{ approverId: managerOf(applicantId), label: "所属長", state: "承認待ち" }];
    if (type === "稟議" || type === "IT機器・アカウント申請") steps.push({ approverId: "E1006", label: "情報システム部（セキュリティ審査）", state: "待機" });
    if (type === "経費精算" || type === "出張申請" || amount >= 100000) steps.push({ approverId: "E1004", label: "経理財務部", state: "待機" });
    if (type === "稟議" && amount >= 1000000) steps.push({ approverId: "E1001", label: "経営企画部（決裁権限表：100万円以上）", state: "待機" });
    return steps.filter((st, i, arr) => i === 0 || (st.approverId !== applicantId && arr.findIndex((x) => x.approverId === st.approverId) === i));
  }, []);

  const v = useMemo(() => ({ s, d, meId, role, nextWfId, approvalRoute, sync }), [s, meId, role, nextWfId, approvalRoute, sync]);
  if (!ready || !ready2) return <div className="grid min-h-screen place-items-center text-ink-3">読み込み中…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useStore() {
  const c = useContext(C);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
