// 勤怠の自動計算（純粋関数）。労働基準法に沿った簡易実装。
// 前提：所定労働 8時間/日、始業 9:00・終業 18:00（休憩1時間）、日曜＝法定休日、土曜・祝日＝所定休日。
// 所定休日の労働は全て時間外として扱う（週40時間超のため）。実運用では就業規則・36協定に合わせて調整すること。

export const HOLIDAYS_2026 = new Set([
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
  "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
  "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
  "2026-12-31",
]);

export const STD_START = "09:00";
export const STD_END = "18:00";
export const SCHEDULED_MIN = 8 * 60;

export type DayKind = "workday" | "prescribed-off" | "legal-off"; // 平日 / 所定休日(土・祝) / 法定休日(日)
export type PunchLike = { in?: string; out?: string; break?: number };

export const toMin = (t?: string) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
export const fmtHM = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;

export function dayKind(date: string): DayKind {
  const dt = new Date(`${date}T00:00:00`);
  if (dt.getDay() === 0) return "legal-off";
  if (dt.getDay() === 6 || HOLIDAYS_2026.has(date)) return "prescribed-off";
  return "workday";
}

/** 法定最低休憩：6時間超で45分、8時間超で60分 */
export function statutoryBreak(spanMin: number) {
  return spanMin > 8 * 60 ? 60 : spanMin > 6 * 60 ? 45 : 0;
}

/** 22:00〜翌5:00 の深夜時間（休憩は深夜帯に取らない前提で控除しない） */
export function nightMinutes(a: number, b: number) {
  const overlap = (s: number, e: number) => Math.max(0, Math.min(b, e) - Math.max(a, s));
  return overlap(0, 5 * 60) + overlap(22 * 60, 29 * 60);
}

export type DayCalc = {
  kind: DayKind;
  span: number; // 在社時間
  breakMin: number; // 控除した休憩
  work: number; // 実働
  scheduled: number; // 所定内
  overtime: number; // 法定外時間外
  legalHoliday: number; // 法定休日労働
  night: number; // 深夜
  late: boolean;
  early: boolean;
  open: boolean; // 退勤未打刻
};

export function calcDay(date: string, p?: PunchLike): DayCalc {
  const kind = dayKind(date);
  const a = toMin(p?.in), b = toMin(p?.out);
  const base: DayCalc = { kind, span: 0, breakMin: 0, work: 0, scheduled: 0, overtime: 0, legalHoliday: 0, night: 0, late: false, early: false, open: a != null && b == null };
  if (a == null || b == null || b <= a) return base;
  const span = b - a;
  const breakMin = Math.min(span, Math.max(p?.break ?? 0, statutoryBreak(span))); // 手入力は法定最低を下回れない
  const work = span - breakMin;
  const r: DayCalc = { ...base, span, breakMin, work, night: nightMinutes(a, b) };
  if (kind === "workday") {
    r.scheduled = Math.min(work, SCHEDULED_MIN);
    r.overtime = Math.max(0, work - SCHEDULED_MIN);
    r.late = a > toMin(STD_START)!;
    r.early = b < toMin(STD_END)!;
  } else if (kind === "prescribed-off") r.overtime = work;
  else r.legalHoliday = work;
  return r;
}

export type MonthSummary = {
  days: number; work: number; scheduled: number; overtime: number; legalHoliday: number; night: number;
  lateCount: number; earlyCount: number; leaveDays: number;
  projectedOvertime: number; // 月末見込み
};

export function summarize(dates: string[], punches: Record<string, PunchLike | undefined>, leave: Set<string>, today: string): MonthSummary {
  const s: MonthSummary = { days: 0, work: 0, scheduled: 0, overtime: 0, legalHoliday: 0, night: 0, lateCount: 0, earlyCount: 0, leaveDays: 0, projectedOvertime: 0 };
  let elapsedWorkdays = 0, totalWorkdays = 0;
  for (const d of dates) {
    const k = dayKind(d);
    if (k === "workday") { totalWorkdays++; if (d <= today) elapsedWorkdays++; }
    if (leave.has(d)) { s.leaveDays++; continue; }
    const c = calcDay(d, punches[d]);
    if (c.work > 0) s.days++;
    s.work += c.work; s.scheduled += c.scheduled; s.overtime += c.overtime; s.legalHoliday += c.legalHoliday; s.night += c.night;
    if (c.late) s.lateCount++;
    if (c.early) s.earlyCount++;
  }
  s.projectedOvertime = elapsedWorkdays > 0 ? Math.round((s.overtime / elapsedWorkdays) * totalWorkdays) : 0;
  return s;
}

export type OvertimeLevel = "ok" | "notice" | "warn" | "danger";
/** 36協定・健康確保のしきい値。月45h超で特別条項扱い、80h超で産業医面談、100h（休日労働含む）で法違反 */
export function overtimeLevel(overtimeMin: number, legalHolidayMin = 0): { level: OvertimeLevel; message: string } {
  const h = overtimeMin / 60, hAll = (overtimeMin + legalHolidayMin) / 60;
  if (hAll >= 100) return { level: "danger", message: "時間外＋休日労働が月100時間に到達（法定上限）。直ちに所属長・人事部へ連絡してください。" };
  if (h >= 80) return { level: "danger", message: "月80時間超：産業医面談の対象です。人事部へ自動通知されます。" };
  if (h >= 45) return { level: "warn", message: "月45時間超：特別条項の適用月です（年6回まで）。所属長へ通知されます。" };
  if (h >= 36) return { level: "notice", message: "月45時間の上限に近づいています（残り約" + Math.max(0, 45 - h).toFixed(1) + "時間）。" };
  return { level: "ok", message: "" };
}

// ---------- 年次有給休暇 ----------
const GRANT_TABLE: [months: number, days: number][] = [[78, 20], [66, 18], [54, 16], [42, 14], [30, 12], [18, 11], [6, 10]];

export function monthsBetween(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}

/** 労基法39条：継続勤務月数に応じた付与日数（全労働日の8割出勤を満たす前提） */
export function grantDays(joined: string, asOf: string) {
  const m = monthsBetween(joined, asOf);
  return GRANT_TABLE.find(([mm]) => m >= mm)?.[1] ?? 0;
}

export type LeaveBalance = { granted: number; carry: number; used: number; remaining: number; nextGrantDate: string; mustTake: number; expiring: number };

/** 直近の付与日（入社日の月日を基準に、6か月後→以降毎年） */
export function lastGrantDate(joined: string, asOf: string) {
  const j = new Date(joined);
  let d = new Date(j.getFullYear(), j.getMonth() + 6, j.getDate());
  let last = d;
  while (d <= new Date(asOf)) { last = d; d = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()); }
  return { last, next: d };
}

export function leaveBalance(joined: string, asOf: string, usedThisPeriod: number, prevUnused = 0): LeaveBalance {
  const granted = grantDays(joined, asOf);
  const { next } = lastGrantDate(joined, asOf);
  const carry = Math.min(prevUnused, grantDays(joined, new Date(new Date(asOf).getFullYear() - 1, new Date(asOf).getMonth(), new Date(asOf).getDate()).toISOString().slice(0, 10)));
  const used = usedThisPeriod;
  // 消化は繰越分（古い方）から
  const fromCarry = Math.min(carry, used);
  const expiring = Math.max(0, carry - fromCarry);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { granted, carry, used, remaining: granted + carry - used, nextGrantDate: iso(next), mustTake: granted >= 10 ? Math.max(0, 5 - used) : 0, expiring };
}

/** 期間内の平日（所定休日・法定休日を除く）の日付一覧 */
export function workdaysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dayKind(k) === "workday") out.push(k);
  }
  return out;
}
