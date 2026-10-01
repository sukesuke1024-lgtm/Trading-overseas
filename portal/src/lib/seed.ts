// 初期データ。サーバー版は「社長のみ」から始まり、従業員は管理者が Excel（④従業員マスタ）から取り込む。
// デモ版（GitHub Pages）だけ、権限の違いを試せるサンプル従業員と今月の勤怠サンプルを含む。
import { NEWS_SEED, PRESIDENT, SAMPLE_EMPLOYEES } from "./data";
import type { CalEvent, Doc, Kpi, Remote } from "./biz";
import { BENEFIT_TEMPLATES, DEFAULT_EXT_LINKS, DEFAULT_RETENTION, type Asset, type Client } from "./ops";
import { DEFAULT_AUTHORITY } from "./authority";
import { DEFAULT_CONDITIONS, holidaySet, isHoliday, pad2, ymd, type DayInput } from "./work";
import type { State } from "./store";

function demoAttendance(): State["attendance"] {
  const now = new Date(), hs = holidaySet(DEFAULT_CONDITIONS);
  const out: State["attendance"] = {};
  SAMPLE_EMPLOYEES.forEach((e, idx) => {
    out[e.id] = {};
    for (let day = 1; day < now.getDate(); day++) {
      const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}`;
      if (isHoliday(date, hs)) continue;
      const startMin = 8 * 60 + 25 + ((day * 7 + idx * 3) % 20);
      const endMin = 17 * 60 + ((day * 13 + idx * 5) % 90) + (day % 6 === 0 ? 120 : 0);
      const d: DayInput = { date, kind: "出勤", start: `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`, end: `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`, brk: 60, remote: day % 5 === 0 };
      out[e.id][date] = d;
    }
  });
  return out;
}

const TODAY = () => { const n = new Date(); return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`; };

// デモ版だけの見本（サーバー版は空から始め、管理者が登録する）
function demoDocs(): Doc[] {
  const at = TODAY();
  return [
    { id: "d1", title: "勤怠・休暇の取り扱い（サンプル）", category: "就業規則", version: "v1.0", effective: at, updatedAt: at, updatedBy: "管理者", body: "【サンプル文書です。実際の規程は管理者が登録・更新してください】\n\n第1条（始業・終業）所定労働時間は 8:30〜17:00（休憩60分）とする。\n第2条（時間外労働）時間外・休日労働は事前に上長へ申請し、承認を得る。\n第3条（年次有給休暇）入社6か月後に10日を付与し、以後1年ごとに法定日数を付与する。" },
    { id: "d2", title: "経費精算のルール（サンプル）", category: "経理・経費", version: "v1.0", effective: at, updatedAt: at, updatedBy: "管理者", body: "【サンプル文書です】\n\n・経費は「申請・承認」の経費精算から、領収書（適格請求書）の登録番号を添えて申請する。\n・100万円以上は役員の承認を要する。" },
  ];
}
function demoEvents(): CalEvent[] {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth() + 1, ymd2 = (d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
  return [
    { id: "e1", title: "月例全体会議", date: ymd2(Math.min(28, n.getDate() + 2)), start: "10:00", end: "11:00", category: "会議", by: "001" },
    { id: "e2", title: "勤怠締め日", date: ymd2(Math.min(28, 25)), category: "締め日・期日", note: "未入力の勤怠を入力・修正してください", by: "001" },
    { id: "e3", title: "コンプライアンス研修", date: ymd2(Math.min(28, n.getDate() + 5)), start: "14:00", end: "15:30", category: "研修", by: "001" },
  ];
}
function demoKpis(): Kpi[] {
  const n = new Date(), m = `${n.getFullYear()}-${pad2(n.getMonth() + 1)}`;
  return [
    { id: "k1", name: "月次売上（全社）", unit: "万円", target: 1000, ownerId: "", values: { [m]: 620 }, note: "サンプル値" },
    { id: "k2", name: "新規商談数", unit: "件", target: 20, ownerId: "902", values: { [m]: 12 }, note: "サンプル値" },
    { id: "k3", name: "時間外労働（全社平均）", unit: "時間", target: 20, ownerId: "", lowerIsBetter: true, values: { [m]: 14 }, note: "サンプル値" },
  ];
}
function demoRemotes(): Remote[] {
  return [{ id: "r1", name: "営業 PC-01（サンプル）", kind: "RDP", host: "pc-sales-01.example.internal", ownerId: "902", note: "社内VPN接続後に利用" }];
}

function demoClients(): Client[] {
  return [
    { code: "C001", name: "サンプル商事株式会社", dept: "営業部", corpNo: "1234567890123", contact: "03-0000-0000", active: true, note: "デモ用の架空データ" },
    { code: "C002", name: "サンプル物産株式会社", dept: "営業部", active: true, note: "デモ用の架空データ" },
  ];
}
function demoAssets(): Asset[] {
  return [
    { id: "PC-0001", name: "ノートPC（営業用）", category: "PC", maker: "サンプル", model: "SAMPLE-14", serial: "SN-DEMO-0001", purchaseDate: "2024-04-01", cost: 180000, usefulLife: 4, assigneeId: "902", dept: "営業部", location: "本社", status: "使用中", note: "デモ用の架空データ" },
    { id: "SP-0001", name: "業務用スマートフォン", category: "スマートフォン", purchaseDate: "2025-04-01", cost: 90000, usefulLife: 4, assigneeId: "902", dept: "営業部", status: "使用中", note: "デモ用の架空データ（10万円未満は少額資産）" },
  ];
}

export function seedState(demo: boolean): State {
  return {
    employees: demo ? [PRESIDENT, ...SAMPLE_EMPLOYEES] : [PRESIDENT],
    conditions: DEFAULT_CONDITIONS,
    attendance: demo ? demoAttendance() : {},
    news: NEWS_SEED,
    read: {},
    workflows: [],
    audit: [],
    auditOutbox: [],
    journal: [],
    jApprovals: {},
    closed: [],
    ipo: {},
    docs: demo ? demoDocs() : [],
    docAck: {},
    events: demo ? demoEvents() : [],
    reports: {},
    kpis: demo ? demoKpis() : [],
    remotes: demo ? demoRemotes() : [],
    files: [],
    filesDel: [],
    clients: demo ? demoClients() : [],
    checks: [],
    extLinks: DEFAULT_EXT_LINKS,
    mails: [],
    assets: demo ? demoAssets() : [],
    orders: [],
    authority: DEFAULT_AUTHORITY,
    benefits: demo ? BENEFIT_TEMPLATES.map((b, i) => ({ ...b, id: `b${i + 1}`, updatedAt: TODAY(), updatedBy: "管理者" })) : [],
    retention: DEFAULT_RETENTION,
    archiveMeta: { at: "", auditUpTo: "" },
  };
}
export { ymd };
