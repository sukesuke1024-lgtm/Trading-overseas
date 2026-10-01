// Excel 連携。ポータルの勤怠データを、H-LINK の既存ブックに「入力欄だけ」書き込む（数式・書式・入力規則は触らない）。
//   ・勤怠入力_自動計算.xlsx      … 従業員 / 休日マスタ / 日別勤怠 の入力欄（計算は Excel の数式が行う）
//   ・賃金計算・業務管理システム.xlsx … ⑤勤怠入力 に月次集計を転記（⑥賃金計算以降は Excel が自動計算）
//   ・④従業員マスタ から従業員（氏名・雇用区分・職種・所定労働時間 など）を読み取る
// 個人情報の取扱い: 読み取るのは勤怠・権限に必要な項目だけ（基本給・生年月日・マイナンバー等は読み取らない）。
import ExcelJS from "exceljs";
import { daysOf, fromMin, toMin, type Conditions, type Kind, type Summary } from "./work.ts";

export type XlsxInput = ArrayBuffer | Uint8Array;
export type EmpRow = { id: string; name: string; employment: string; job: string; scheduled: number; note?: string };
export type DayRow = { date: string; empId: string; kind: Kind; start?: string; end?: string; brk?: number; note?: string };

const MAX_EMP = 500, MAX_HOL = 60, MAX_DAY = 15500;
const FIRST = 4; // 勤怠ブックの入力開始行

async function load(input: XlsxInput) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input as ArrayBuffer);
  return wb;
}
function sheet(wb: ExcelJS.Workbook, name: string) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`シート「${name}」が見つかりません。正しいブックを選んでください。`);
  return ws;
}
const out = async (wb: ExcelJS.Workbook) => {
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true } as ExcelJS.CalculationProperties; // 開いた時に全再計算
  return new Uint8Array(await wb.xlsx.writeBuffer());
};
const utcDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const timeFrac = (t?: string) => { const m = toMin(t); return m == null ? null : m / 1440; };
const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "result" in v) return text((v as { result?: ExcelJS.CellValue }).result as ExcelJS.CellValue);
  if (typeof v === "object" && "richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};
const num = (v: ExcelJS.CellValue): number | null => { const t = text(v); const n = Number(t); return t !== "" && Number.isFinite(n) ? n : null; };

/** 勤怠ブックの深夜の式（24:00〜29:00 の二重計上）を、正しい式に置き換える（任意） */
export const NIGHT_FORMULA = (r: number) =>
  `IF($I${r}=0,0,ROUND(MAX(0,MIN(($B${r}+$G${r}+IF($G${r}<$F${r},1,0)),$B${r}+5/24)-MAX(($B${r}+$F${r}),$B${r}))*24+MAX(0,MIN(($B${r}+$G${r}+IF($G${r}<$F${r},1,0)),$B${r}+29/24)-MAX(($B${r}+$F${r}),$B${r}+22/24))*24,2))`;

export type AttendanceBookData = { employees: EmpRow[]; days: DayRow[]; conditions: Conditions; fixNight?: boolean };

/** 勤怠入力_自動計算.xlsx に、従業員・休日マスタ・日別勤怠の入力を書き込む */
export async function fillAttendanceBook(book: XlsxInput, data: AttendanceBookData): Promise<Uint8Array> {
  if (data.employees.length > MAX_EMP) throw new Error(`従業員は最大${MAX_EMP}名です。`);
  if (data.conditions.holidays.length > MAX_HOL) throw new Error(`休日マスタは最大${MAX_HOL}件です。`);
  if (data.days.length > MAX_DAY) throw new Error(`日別勤怠は最大${MAX_DAY}行です。月を分けて出力してください。`);
  const wb = await load(book);

  const we = sheet(wb, "従業員");
  for (let i = 0; i < MAX_EMP; i++) {
    const r = FIRST + i, e = data.employees[i];
    we.getCell(`B${r}`).value = e?.id ?? null;
    we.getCell(`C${r}`).value = e?.name ?? null;
    we.getCell(`D${r}`).value = e?.employment ?? null;
    we.getCell(`E${r}`).value = e?.job ?? null;
    if (e) we.getCell(`F${r}`).value = e.scheduled; // 空き行の既定値(7.5)は残す
    we.getCell(`G${r}`).value = e?.note ?? null;
  }

  const wh = sheet(wb, "休日マスタ");
  for (let i = 0; i < MAX_HOL; i++) {
    const r = FIRST + i, h = data.conditions.holidays[i];
    wh.getCell(`B${r}`).value = h ? utcDate(h.date) : null;
    wh.getCell(`C${r}`).value = h?.name ?? null;
    wh.getCell(`D${r}`).value = h?.code ?? null;
  }

  const wd = sheet(wb, "日別勤怠");
  const days = [...data.days].sort((a, b) => (a.date + a.empId).localeCompare(b.date + b.empId));
  for (let i = 0; i < MAX_DAY; i++) {
    const r = FIRST + i, d = days[i];
    if (!d && i >= days.length + 200) break; // 以降は既に空（高速化）。直後の余白だけ明示クリア
    wd.getCell(`B${r}`).value = d ? utcDate(d.date) : null;
    wd.getCell(`C${r}`).value = d?.empId ?? null;
    wd.getCell(`E${r}`).value = d?.kind ?? null;
    wd.getCell(`F${r}`).value = d ? timeFrac(d.start) : null;
    wd.getCell(`G${r}`).value = d ? timeFrac(d.end) : null;
    if (d) wd.getCell(`H${r}`).value = d.brk ?? data.conditions.breakMin;
    wd.getCell(`R${r}`).value = d?.note ?? null;
  }
  if (data.fixNight) for (let i = 0; i < MAX_DAY; i++) wd.getCell(`M${FIRST + i}`).value = { formula: NIGHT_FORMULA(FIRST + i) } as ExcelJS.CellFormulaValue;
  return out(wb);
}

export type PayrollRowData = { name: string; id: string; summary: Summary };

/** 賃金計算・業務管理システム.xlsx の ⑤勤怠入力 に月次集計を転記（④従業員マスタの並びに合わせる） */
export async function fillPayrollBook(book: XlsxInput, data: { month: string; rows: PayrollRowData[] }): Promise<{ bytes: Uint8Array; written: string[]; missing: string[] }> {
  const wb = await load(book);
  const master = sheet(wb, "④従業員マスタ"), att = sheet(wb, "⑤勤怠入力");
  const monthNo = Number(data.month.slice(5, 7));
  att.getCell("D5").value = monthNo;
  const byName = new Map<string, number>();
  for (let r = 8; r < 8 + MAX_EMP; r++) { const n = text(master.getCell(`C${r}`).value).replace(/\s+/g, ""); if (n) byName.set(n, r); }
  const written: string[] = [], missing: string[] = [];
  for (const row of data.rows) {
    const mr = byName.get(row.name.replace(/\s+/g, ""));
    if (!mr) { missing.push(row.name); continue; }
    const r = mr + 6; // ④の8行目 ↔ ⑤の14行目
    const s = row.summary;
    const v = [s.workDays + s.holidayWorkDays, s.paidDays, s.absentDays, s.remoteDays, s.scheduled, s.legalIn, s.legalOut, s.over60, s.night, s.legalHoliday, s.nonLegalHoliday, s.holidayNight, s.flexCarry];
    "EFGHIJKLMNOPQ".split("").forEach((col, i) => { att.getCell(`${col}${r}`).value = v[i]; });
    written.push(row.name);
  }
  return { bytes: await out(wb), written, missing };
}

export type ImportedEmployee = { id: string; name: string; kana: string; employment: string; job: string; wageType: string; scheduled: number; joined?: string; left?: string; paidGranted?: number; paidRemaining?: number };

/** ④従業員マスタ から従業員を読み取る（勤怠・権限に必要な項目だけ。給与額・生年月日・マイナンバーは読み取らない） */
export async function readEmployees(book: XlsxInput): Promise<ImportedEmployee[]> {
  const wb = await load(book);
  const ws = sheet(wb, "④従業員マスタ");
  const res: ImportedEmployee[] = [];
  for (let r = 8; r < 8 + MAX_EMP; r++) {
    const name = text(ws.getCell(`C${r}`).value);
    if (!name) continue;
    const idRaw = text(ws.getCell(`B${r}`).value);
    res.push({
      id: idRaw || String(r - 7).padStart(3, "0"), name, kana: text(ws.getCell(`D${r}`).value),
      employment: text(ws.getCell(`E${r}`).value) || "正社員", job: text(ws.getCell(`F${r}`).value), wageType: text(ws.getCell(`G${r}`).value),
      scheduled: num(ws.getCell(`I${r}`).value) ?? 7.5,
      joined: text(ws.getCell(`M${r}`).value) || undefined, left: text(ws.getCell(`N${r}`).value) || undefined,
      paidGranted: num(ws.getCell(`K${r}`).value) ?? undefined, paidRemaining: num(ws.getCell(`L${r}`).value) ?? undefined,
    });
  }
  return res;
}

/** 勤怠ブックの 従業員 シートから読み取る（賃金計算ブックが無い場合の取込口） */
export async function readAttendanceBookEmployees(book: XlsxInput): Promise<EmpRow[]> {
  const wb = await load(book);
  const ws = sheet(wb, "従業員");
  const res: EmpRow[] = [];
  for (let r = FIRST; r < FIRST + MAX_EMP; r++) {
    const name = text(ws.getCell(`C${r}`).value);
    if (!name) continue;
    res.push({ id: text(ws.getCell(`B${r}`).value) || String(r - 3).padStart(3, "0"), name, employment: text(ws.getCell(`D${r}`).value), job: text(ws.getCell(`E${r}`).value), scheduled: num(ws.getCell(`F${r}`).value) ?? 7.5, note: text(ws.getCell(`G${r}`).value) || undefined });
  }
  return res;
}

export { daysOf, fromMin };
