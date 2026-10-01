// 勤怠画面の集計ヘルパー（純粋関数）
import { daysOf, holidaySet, isHoliday, summarize, type Conditions, type DayInput, type Summary } from "./work.ts";

export type Att = Record<string, Record<string, DayInput>>;

export function monthDays(att: Att, empId: string, month: string): DayInput[] {
  const m = att[empId] ?? {};
  return daysOf(month).map((d) => m[d]).filter(Boolean);
}
export function monthSummary(att: Att, empId: string, month: string, scheduled: number, c: Conditions): Summary {
  return summarize(monthDays(att, empId, month), scheduled, holidaySet(c), c);
}
/** 未入力の所定労働日（今日まで）。有給・欠勤・休みの入力がない日 */
export function missingDays(att: Att, empId: string, month: string, c: Conditions, today: string): string[] {
  const hs = holidaySet(c), m = att[empId] ?? {};
  return daysOf(month).filter((d) => d <= today && !isHoliday(d, hs) && !m[d]);
}
export const monthLabel = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
