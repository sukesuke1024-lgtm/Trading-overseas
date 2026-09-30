// 給与計算（純粋関数）。勤怠の自動集計（時間外・深夜・休日）から支給額と控除を算出する。
// ★ 料率・税額は年度ごとに改定されます。本ファイルの数値は 2026年度の目安（概算）であり、
//   実運用では社会保険労務士・税理士の確認と、協会けんぽ／年金機構／国税庁の最新の料率・源泉徴収税額表への更新が必要です。
import type { MonthSummary } from "./attendance-calc.ts";

export const RATES = {
  stdMonthlyHours: 160, // 月平均所定労働時間（会社設定）
  otRate: 1.25, otRateOver60: 1.5, nightExtra: 0.25, legalHolidayRate: 1.35,
  healthEmployee: 0.0499, pensionEmployee: 0.0915, employmentEmployee: 0.0055,
  healthEmployer: 0.0499, pensionEmployer: 0.0915, employmentEmployer: 0.009, accidentEmployer: 0.003, childSupportEmployer: 0.0036,
  healthCap: 1_390_000, pensionCap: 650_000, commuteTaxFreeCap: 150_000, reconstructionTax: 0.021,
};

export type PayInput = {
  id: string; name: string; dept: string; base: number; allowance: number; commute: number; dependents: number; residentTax: number;
  hours: Pick<MonthSummary, "overtime" | "night" | "legalHoliday">;
};
export type PayRow = PayInput & {
  otPay: number; nightPay: number; holidayPay: number; gross: number;
  health: number; pension: number; employment: number; incomeTax: number; deductions: number; net: number;
  employerCost: number; employerInsurance: number;
};
const floor = Math.floor;
const rnd = Math.round;

/** 所得税（月額・甲欄）の概算：年換算 → 給与所得控除 → 基礎・扶養控除 → 累進税率 → 復興特別所得税 */
export function monthlyIncomeTax(taxableMonthly: number, dependents: number) {
  const annual = taxableMonthly * 12;
  const ded = annual <= 1_625_000 ? 650_000 : annual <= 1_800_000 ? annual * 0.4 - 100_000 : annual <= 3_600_000 ? annual * 0.3 + 80_000 : annual <= 6_600_000 ? annual * 0.2 + 440_000 : annual <= 8_500_000 ? annual * 0.1 + 1_100_000 : 1_950_000;
  const taxable = floor(Math.max(0, annual - ded - 480_000 - 380_000 * dependents) / 1000) * 1000;
  const bands: [number, number, number][] = [[1_950_000, 0.05, 0], [3_300_000, 0.1, 97_500], [6_950_000, 0.2, 427_500], [9_000_000, 0.23, 636_000], [18_000_000, 0.33, 1_536_000], [40_000_000, 0.4, 2_796_000], [Infinity, 0.45, 4_796_000]];
  const [, rate, sub] = bands.find(([lim]) => taxable <= lim)!;
  const yearly = taxable * rate - sub;
  return floor((yearly * (1 + RATES.reconstructionTax)) / 12 / 10) * 10;
}

export function computePay(i: PayInput): PayRow {
  const hourly = i.base / RATES.stdMonthlyHours, h = (m: number) => m / 60;
  const ot = h(i.hours.overtime), otNormal = Math.min(ot, 60), otOver = Math.max(0, ot - 60);
  const otPay = rnd(hourly * (RATES.otRate * otNormal + RATES.otRateOver60 * otOver));
  const nightPay = rnd(hourly * RATES.nightExtra * h(i.hours.night));
  const holidayPay = rnd(hourly * RATES.legalHolidayRate * h(i.hours.legalHoliday));
  const gross = i.base + i.allowance + i.commute + otPay + nightPay + holidayPay;
  const health = rnd(Math.min(gross, RATES.healthCap) * RATES.healthEmployee);
  const pension = rnd(Math.min(gross, RATES.pensionCap) * RATES.pensionEmployee);
  const employment = rnd(gross * RATES.employmentEmployee);
  const taxable = gross - Math.min(i.commute, RATES.commuteTaxFreeCap) - health - pension - employment;
  const incomeTax = monthlyIncomeTax(taxable, i.dependents);
  const deductions = health + pension + employment + incomeTax + i.residentTax;
  const employerInsurance = rnd(Math.min(gross, RATES.healthCap) * RATES.healthEmployer + Math.min(gross, RATES.pensionCap) * RATES.pensionEmployer + gross * (RATES.employmentEmployer + RATES.accidentEmployer + RATES.childSupportEmployer));
  return { ...i, otPay, nightPay, holidayPay, gross, health, pension, employment, incomeTax, deductions, net: gross - deductions, employerInsurance, employerCost: gross + employerInsurance };
}

export type PayTotals = { gross: number; net: number; withholding: number; employerInsurance: number; wages: number; commute: number };
export function totals(rows: PayRow[]): PayTotals {
  const s = (f: (r: PayRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return { gross: s((r) => r.gross), net: s((r) => r.net), withholding: s((r) => r.deductions), employerInsurance: s((r) => r.employerInsurance), commute: s((r) => r.commute), wages: s((r) => r.gross - r.commute) };
}

/** 給与確定時の仕訳明細。給与総額＝手取り＋控除計 → 貸借一致 */
export function payrollLines(t: PayTotals, month: string) {
  return {
    memo: `${month} 給与（確定）`,
    lines: [
      { account: "6110", side: "D" as const, amount: t.wages, dept: "全社" },
      ...(t.commute ? [{ account: "6210", side: "D" as const, amount: t.commute, dept: "全社" }] : []),
      { account: "6130", side: "D" as const, amount: t.employerInsurance, dept: "全社" },
      { account: "2130", side: "C" as const, amount: t.net }, // 未払費用（給与振込前）
      { account: "2140", side: "C" as const, amount: t.withholding + t.employerInsurance }, // 預り金（源泉・社保・住民税・会社負担分）
    ],
  };
}
