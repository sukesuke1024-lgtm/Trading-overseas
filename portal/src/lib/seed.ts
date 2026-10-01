// 初期データ。サーバー版は「社長のみ」から始まり、従業員は管理者が Excel（④従業員マスタ）から取り込む。
// デモ版（GitHub Pages）だけ、権限の違いを試せるサンプル従業員と今月の勤怠サンプルを含む。
import { NEWS_SEED, PRESIDENT, SAMPLE_EMPLOYEES } from "./data";
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
  };
}
export { ymd };
