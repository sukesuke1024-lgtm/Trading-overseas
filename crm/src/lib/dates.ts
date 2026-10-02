// 日付は "YYYY-MM-DD"（期限）または ISO 文字列（活動日時）。タイムゾーンはブラウザのローカル。
export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const addDays = (base: string | Date, n: number) => {
  const d = typeof base === "string" ? parseYmd(base) : new Date(base);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const parseYmd = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
/** 今日からの日数差（過去は負） */
export const diffFromToday = (s: string) => daysBetween(todayStr(), s);
export const startOfWeek = (s = todayStr()) => { const d = parseYmd(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); };
export const endOfWeek = (s = todayStr()) => addDays(startOfWeek(s), 6);
export const monthKey = (s: string) => s.slice(0, 7);
export const WD = ["日", "月", "火", "水", "木", "金", "土"];

export function fmtDate(s: string | null | undefined, withYear = false) {
  if (!s) return "—";
  const d = parseYmd(s);
  return `${withYear ? d.getFullYear() + "/" : ""}${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 期限の相対表記と状態（overdue / today / soon / later / none） */
export function dueInfo(due: string | null): { label: string; tone: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!due) return { label: "期限なし", tone: "none" };
  const n = diffFromToday(due);
  if (n < 0) return { label: `${-n}日超過`, tone: "overdue" };
  if (n === 0) return { label: "今日", tone: "today" };
  if (n === 1) return { label: "明日", tone: "soon" };
  if (n <= 7) return { label: `${n}日後`, tone: "soon" };
  return { label: fmtDate(due), tone: "later" };
}
export function relativeDays(iso: string | null) {
  if (!iso) return "—";
  const n = -diffFromToday(iso.slice(0, 10));
  if (n <= 0) return "今日";
  if (n === 1) return "昨日";
  if (n < 30) return `${n}日前`;
  if (n < 365) return `${Math.floor(n / 30)}か月前`;
  return `${Math.floor(n / 365)}年前`;
}
export const isoAt = (daysAgo: number, hour = 10, minute = 0) => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, minute, 0, 0); return d.toISOString();
};
