// 初期（デモ）データ。クライアント（デモ版）とサーバー（初回起動時）の両方が同じ内容を使う。
import { COURSES, EMPLOYEES, NEWS_SEED, WF_SEED, type Workflow } from "./data";
import { dayKind, workdaysBetween } from "./attendance-calc";
import { buildSeedJournal } from "./accounting";
import type { Punch, State } from "./store";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 承認済み休暇申請の日付（平日のみ）。申請者ごと */
export function leaveDatesOf(workflows: Workflow[], empId: string, statuses: Workflow["status"][] = ["承認済"]) {
  const set = new Set<string>();
  for (const w of workflows) {
    if (w.type === "休暇申請" && w.applicantId === empId && statuses.includes(w.status) && w.from && w.to) workdaysBetween(w.from, w.to).forEach((d) => set.add(d));
  }
  return set;
}

// 当月の過去の平日に、決定的な打刻データを生成（デモ用）
function seedPunches(): Record<string, Record<string, Punch>> {
  const now = new Date();
  const out: Record<string, Record<string, Punch>> = {};
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

export function seedState(withAccounting: boolean): State {
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
    auditOutbox: [],
    journal: withAccounting ? buildSeedJournal() : [],
    jApprovals: {},
    payroll: {},
    closed: withAccounting ? ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"] : [],
    ipo: {},
    logs: [
      { id: "l-seed1", by: "E1012", start: `${ymd(new Date(Date.now() - 86400000))}T14:00`, end: `${ymd(new Date(Date.now() - 86400000))}T15:30`, where: "客先A社", who: "A社 佐藤様", what: "新規提案の商談", why: "来期の契約更新", how: "対面・資料持参", category: "会議" },
    ],
  };
}
