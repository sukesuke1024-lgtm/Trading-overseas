// 勤怠エンジン（H-LINK）。「勤怠入力_自動計算.xlsx」の 日別勤怠・月次集計 の数式と同じ規則で計算する。
//
//   実労働   = (終業 − 始業) − 休憩                      （終業が始業より小さければ翌日、25:00 のように24時超も可）
//   所定内   = 所定労働日 ? min(実労働, 所定h) : 0
//   法定内残業= 所定労働日 ? max(0, min(実労働, 8) − 所定h) : 0
//   法定外残業= 所定労働日 ? max(0, 実労働 − 8) : 0
//   深夜     = 22:00〜翌5:00 の時間（所定内・残業と重複して計上、休憩は控除しない）
//   休日労働 = 休日 ? 実労働 : 0（日曜＝法定休日 35%、土曜・祝日＝法定外休日 25%）
//   休日とは 土日 ＋ 休日マスタ（祝日・年末年始・お盆 等）
//
// ※ Excel 側の「深夜」の式は 24:00〜29:00 の部分を二重に数えます（夜勤で日をまたぐ場合のみ差が出ます）。
//   本エンジンは正しい深夜時間を計算し、Excel の式で計算した値（nightExcel）も併せて返します。

export const KINDS = ["出勤", "有給休暇", "欠勤", "休日出勤", "休み"] as const;
export type Kind = (typeof KINDS)[number];

export type Holiday = { date: string; name: string; code: string }; // code: 祝 / 年 / 盆 / その他
export type Conditions = {
  year: number;
  start: string; // 始業
  end: string; // 終業
  breakMin: number; // 休憩（分）
  legalDaily: number; // 法定労働時間（時間/日）
  core: string; // コアタイム
  flex: boolean;
  paidLeaveDays: number; // 有給付与日数（年）
  holidays: Holiday[];
};

export const DEFAULT_CONDITIONS: Conditions = {
  year: 2026, start: "08:30", end: "17:00", breakMin: 60, legalDaily: 8, core: "11:00〜15:00", flex: true, paidLeaveDays: 15,
  holidays: [
    ["2026-01-01", "元日", "祝"], ["2026-01-02", "年末年始休暇", "年"], ["2026-01-12", "成人の日", "祝"], ["2026-02-11", "建国記念の日", "祝"],
    ["2026-02-23", "天皇誕生日", "祝"], ["2026-03-20", "春分の日", "祝"], ["2026-04-29", "昭和の日", "祝"], ["2026-05-04", "みどりの日", "祝"],
    ["2026-05-05", "こどもの日", "祝"], ["2026-05-06", "振替休日（5月3日分）", "祝"], ["2026-07-20", "海の日", "祝"], ["2026-08-11", "山の日", "祝"],
    ["2026-08-13", "お盆休み", "盆"], ["2026-08-14", "お盆休み", "盆"], ["2026-08-15", "お盆休み（土）", "盆"], ["2026-08-16", "お盆休み（日）", "盆"],
    ["2026-09-21", "敬老の日", "祝"], ["2026-09-22", "国民の休日", "祝"], ["2026-09-23", "秋分の日", "祝"], ["2026-10-12", "スポーツの日", "祝"],
    ["2026-11-03", "文化の日", "祝"], ["2026-11-23", "勤労感謝の日", "祝"], ["2026-12-29", "年末年始休暇", "年"], ["2026-12-30", "年末年始休暇", "年"],
    ["2026-12-31", "年末年始休暇", "年"],
  ].map(([date, name, code]) => ({ date, name, code })),
};

export const DEFAULT_SCHEDULED = 7.5; // 所定労働時間（時間/日）＝ (17:00−8:30)−休憩60分
export const NIGHT_FROM = 22, NIGHT_TO = 29; // 22:00〜翌5:00

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** 時刻 "H:MM"/"HH:MM"（最大 47:59）を分に。不正は null */
export function toMin(t?: string | null): number | null {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  return h <= 47 ? h * 60 + Number(m[2]) : null;
}
export const fromMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const r2 = (x: number) => Math.round((x + 1e-9) * 100) / 100; // Excel の ROUND(x,2)（0以上）
export const fmtH = (h: number) => `${Math.floor(h + 1e-9)}:${pad2(Math.round((h - Math.floor(h + 1e-9)) * 60) % 60)}`; // 7.5 → 7:30

export type DayInput = { date: string; kind: Kind; start?: string; end?: string; brk?: number; remote?: boolean; note?: string };
export type DayCalc = {
  holiday: boolean; sunday: boolean; weekday: number;
  worked: number; scheduled: number; legalIn: number; legalOut: number; night: number; nightExcel: number; holidayWork: number; holidayNight: number;
  late: boolean; early: boolean; outsideCore: boolean; invalid: string | null;
};

const dow = (date: string) => new Date(`${date}T00:00:00`).getDay(); // 0=日
export const holidaySet = (c: Conditions) => new Set(c.holidays.map((h) => h.date));
export const isHoliday = (date: string, hs: Set<string>) => dow(date) === 0 || dow(date) === 6 || hs.has(date);
export const holidayName = (date: string, c: Conditions) => c.holidays.find((h) => h.date === date)?.name;

function overlap(a: number, b: number, from: number, to: number) { return Math.max(0, Math.min(b, to) - Math.max(a, from)); }

/** 1日分の計算。kind が 欠勤/休み/有給休暇、または時刻が未入力なら労働時間は 0 */
export function calcDay(d: DayInput, scheduledH: number, hs: Set<string>, c: Conditions = DEFAULT_CONDITIONS): DayCalc {
  const holiday = isHoliday(d.date, hs), wd = dow(d.date);
  const z: DayCalc = { holiday, sunday: wd === 0, weekday: wd, worked: 0, scheduled: 0, legalIn: 0, legalOut: 0, night: 0, nightExcel: 0, holidayWork: 0, holidayNight: 0, late: false, early: false, outsideCore: false, invalid: null };
  if (d.kind === "休み" || d.kind === "欠勤" || d.kind === "有給休暇") return z;
  const s = toMin(d.start), eRaw = toMin(d.end);
  if (s == null || eRaw == null) return z;
  const e = eRaw < s ? eRaw + 1440 : eRaw; // 終業が始業より小さければ翌日
  const brk = d.brk ?? c.breakMin;
  if (e === s) { z.invalid = "始業と終業が同じです"; return z; }
  if (brk < 0 || brk > e - s) { z.invalid = "休憩が勤務時間を超えています"; return z; }
  const worked = r2((e - s - brk) / 60);
  const lawful = !holiday; // 所定労働日
  const night = r2((overlap(s, e, 0, 5 * 60) + overlap(s, e, NIGHT_FROM * 60, NIGHT_TO * 60)) / 60);
  // Excel の式: overlap([22,29]) + overlap([24,29])（24時以降が二重計上）
  const nightExcel = r2((overlap(s, e, NIGHT_FROM * 60, NIGHT_TO * 60) + overlap(s, e, 24 * 60, NIGHT_TO * 60)) / 60);
  const cs = toMin(c.start)!, ce = toMin(c.end)!;
  return {
    ...z, worked, night, nightExcel,
    scheduled: lawful ? r2(Math.min(worked, scheduledH)) : 0,
    legalIn: lawful ? r2(Math.max(0, Math.min(worked, c.legalDaily) - scheduledH)) : 0,
    legalOut: lawful ? r2(Math.max(0, worked - c.legalDaily)) : 0,
    holidayWork: holiday ? worked : 0,
    holidayNight: holiday ? night : 0,
    late: lawful && s > cs, early: lawful && e < ce,
    outsideCore: lawful && c.flex && (s > 11 * 60 || e < 15 * 60), // コアタイム 11:00〜15:00（既定）
  };
}

export type Summary = {
  workDays: number; paidDays: number; absentDays: number; holidayWorkDays: number; remoteDays: number;
  scheduled: number; legalIn: number; legalOut: number; over60: number; night: number; legalHoliday: number; nonLegalHoliday: number; holidayNight: number; flexCarry: number;
  worked: number; overtime45: number; total100: number; nightExcelDiff: number;
};

/** 月次集計（勤怠ブックの 月次集計 シートと同じ集計） */
export function summarize(days: DayInput[], scheduledH: number, hs: Set<string>, c: Conditions = DEFAULT_CONDITIONS): Summary {
  const s: Summary = { workDays: 0, paidDays: 0, absentDays: 0, holidayWorkDays: 0, remoteDays: 0, scheduled: 0, legalIn: 0, legalOut: 0, over60: 0, night: 0, legalHoliday: 0, nonLegalHoliday: 0, holidayNight: 0, flexCarry: 0, worked: 0, overtime45: 0, total100: 0, nightExcelDiff: 0 };
  let holidayAll = 0, nightExcel = 0;
  for (const d of days) {
    const x = calcDay(d, scheduledH, hs, c);
    if (d.kind === "出勤") { s.workDays++; s.scheduled += x.scheduled; s.legalIn += x.legalIn; s.legalOut += x.legalOut; }
    if (d.kind === "有給休暇") s.paidDays++;
    if (d.kind === "欠勤") s.absentDays++;
    if (d.kind === "休日出勤") s.holidayWorkDays++;
    if (d.remote && x.worked > 0) s.remoteDays++;
    s.night += x.night; nightExcel += x.nightExcel; s.holidayNight += x.holidayNight; holidayAll += x.holidayWork; s.worked += x.worked;
    if (x.holiday && x.sunday) s.legalHoliday += x.holidayWork;
  }
  for (const k of ["scheduled", "legalIn", "legalOut", "night", "legalHoliday", "holidayNight", "worked"] as const) s[k] = r2(s[k]);
  s.over60 = r2(Math.max(0, s.legalOut - 60));
  s.nonLegalHoliday = r2(holidayAll - s.legalHoliday);
  s.overtime45 = r2(s.legalOut + s.nonLegalHoliday); // 月45時間の管理対象（法定外残業＋法定外休日労働）
  s.total100 = r2(s.overtime45 + s.legalHoliday); // 月100時間未満の管理対象（休日労働を含む）
  s.nightExcelDiff = r2(nightExcel - s.night);
  return s;
}

export type OvertimeLevel = "ok" | "notice" | "warn" | "danger";
/** 36協定・健康確保のしきい値。月45時間超で特別条項、80時間超で産業医面談、100時間（休日労働含む）で法違反 */
export function overtimeLevel(overtime: number, total: number = overtime): { level: OvertimeLevel; message: string } {
  if (total >= 100) return { level: "danger", message: "時間外＋休日労働が月100時間に到達（法定上限）。直ちに対応してください。" };
  if (overtime >= 80) return { level: "danger", message: "月80時間超：産業医面談の対象です。" };
  if (overtime >= 45) return { level: "warn", message: "月45時間超：特別条項の適用月です（年6回まで）。" };
  if (overtime >= 36) return { level: "notice", message: `月45時間の上限に近づいています（残り約${Math.max(0, 45 - overtime).toFixed(1)}時間）。` };
  return { level: "ok", message: "" };
}

/** 月の全日付（YYYY-MM-DD） */
export function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${pad2(i + 1)}`);
}

/** 勤務のある日は、休日なら「休日出勤」、それ以外は「出勤」に自動で区分する（Excel の運用ミス対策） */
export function autoKind(date: string, hs: Set<string>, current?: Kind): Kind {
  if (current && current !== "出勤" && current !== "休日出勤") return current;
  return isHoliday(date, hs) ? "休日出勤" : "出勤";
}

/** 期間内の所定労働日（休日を除く）。休暇申請の日数計算に使う */
export function workdaysBetween(from: string, to: string, hs: Set<string>): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const k = ymd(d);
    if (!isHoliday(k, hs)) out.push(k);
  }
  return out;
}
