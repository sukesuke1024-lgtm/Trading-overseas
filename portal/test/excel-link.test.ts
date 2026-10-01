import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { fillAttendanceBook, fillPayrollBook, readAttendanceBookEmployees } from "../src/lib/excel-link.ts";
import { DEFAULT_CONDITIONS, summarize, holidaySet, type DayInput } from "../src/lib/work.ts";

// 実ブックの構造だけを模した合成データ（実在の従業員・金額は含めない）
async function makeAttendance() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("従業員"); wb.addWorksheet("休日マスタ"); wb.addWorksheet("日別勤怠"); wb.addWorksheet("月次集計");
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
async function makePayroll() {
  const wb = new ExcelJS.Workbook();
  const m = wb.addWorksheet("④従業員マスタ"); wb.addWorksheet("⑤勤怠入力");
  m.getCell("C8").value = "テスト 太郎"; m.getCell("C9").value = "サンプル 花子";
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

test("attendance book: employees, holidays and days are written to the right cells", async () => {
  const days = [{ date: "2026-09-01", empId: "003", kind: "出勤" as const, start: "08:30", end: "25:00", brk: 60 }];
  const bytes = await fillAttendanceBook(await makeAttendance(), { employees: [{ id: "003", name: "テスト 太郎", employment: "正社員", job: "営業", scheduled: 7.5 }], days, conditions: DEFAULT_CONDITIONS });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes as never);
  assert.equal(wb.getWorksheet("従業員")!.getCell("B4").value, "003");
  const d = wb.getWorksheet("日別勤怠")!;
  assert.equal(String(d.getCell("C4").value), "003");
  assert.ok(Math.abs(Number(d.getCell("F4").value) - 8.5 / 24) < 1e-9);
  assert.ok(Math.abs(Number(d.getCell("G4").value) - 25 / 24) < 1e-9);
  assert.ok(wb.getWorksheet("休日マスタ")!.getCell("B4").value);
  assert.equal((await readAttendanceBookEmployees(bytes)).length, 1);
});

test("payroll book: summary lands in ⑤勤怠入力 row = ④ row + 6, matched by name", async () => {
  const hs = holidaySet(DEFAULT_CONDITIONS);
  const ds: DayInput[] = [{ date: "2026-09-01", kind: "出勤", start: "08:30", end: "20:00", brk: 60 }, { date: "2026-09-02", kind: "有給休暇" }];
  const summary = summarize(ds, 7.5, hs, DEFAULT_CONDITIONS);
  const r = await fillPayrollBook(await makePayroll(), { month: "2026-09", rows: [{ id: "003", name: "サンプル　花子", summary }, { id: "x", name: "存在しない人", summary }] });
  assert.deepEqual(r.written, ["サンプル　花子"]); assert.deepEqual(r.missing, ["存在しない人"]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(r.bytes as never);
  const a = wb.getWorksheet("⑤勤怠入力")!;
  assert.equal(a.getCell("D5").value, 9);
  assert.equal(a.getCell("E15").value, 1); // 出勤日数
  assert.equal(a.getCell("F15").value, 1); // 有給
  assert.equal(a.getCell("I15").value, summary.scheduled); assert.equal(a.getCell("J15").value, summary.legalIn); assert.equal(a.getCell("K15").value, summary.legalOut);
  assert.equal(a.getCell("E14").value, null); // 別の人の行には書かない
});
