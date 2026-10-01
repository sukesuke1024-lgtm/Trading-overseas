// 出力CSVの定義（Excel で開ける UTF-8 BOM 付き）。
//  ・日別勤怠CSV … 「勤怠入力_自動計算.xlsx」の 日別勤怠 シートにそのまま貼り付けられる列順（日付・従業員番号・氏名・区分・始業・終業・休憩・…）
//  ・月次集計CSV … 同ブックの 月次集計 シートと同じ列（賃金計算ブックの⑤勤怠入力に対応）
import { acct, isPosted, type Approvals, type Journal, type TbRow } from "./accounting";
import { toCsv } from "./csv";
import type { Employee, Workflow } from "./data";
import type { Audit } from "./store";
import { calcDay, holidaySet, isHoliday, type Conditions, type DayInput, type Summary } from "./work";

const DOW = "日月火水木金土";

/** 日別勤怠（入力＋自動計算の参考値）。nameOf: 従業員番号→氏名 */
export function attendanceCsv(rows: { empId: string; day: DayInput }[], nameOf: (id: string) => string, scheduledOf: (id: string) => number, c: Conditions) {
  const hs = holidaySet(c);
  const body = [...rows].sort((a, b) => (a.day.date + a.empId).localeCompare(b.day.date + b.empId)).map(({ empId, day }) => {
    const x = calcDay(day, scheduledOf(empId), hs, c);
    return [day.date, empId, nameOf(empId), day.kind, day.start ?? "", day.end ?? "", day.brk ?? c.breakMin, x.worked || "", x.scheduled || "", x.legalIn || "", x.legalOut || "", x.night || "", x.holidayWork || "", x.holidayNight || "", isHoliday(day.date, hs) ? "休日" : "所定労働日", DOW[new Date(`${day.date}T00:00:00`).getDay()], day.remote ? "リモート" : "", day.note ?? ""];
  });
  return toCsv(["日付", "従業員番号", "氏名", "区分", "始業", "終業", "休憩(分)", "実労働時間", "所定内時間", "法定内残業", "法定外残業", "深夜時間", "休日労働時間", "休日の深夜", "所定労働日判定", "曜日", "勤務形態", "備考"], body);
}

/** 月次集計（勤怠ブックの 月次集計 シートと同じ列） */
export function monthlySummaryCsv(list: { emp: Employee; s: Summary }[]) {
  return toCsv(["従業員番号", "氏名", "出勤日数", "有給日数", "欠勤日数", "休日出勤日数", "リモート日数", "所定内労働時間", "法定内残業時間", "法定外残業時間", "うち月60h超", "深夜労働時間", "法定休日労働(日曜)", "法定外休日労働(土・祝)", "休日労働の深夜", "フレックス繰越"],
    list.map(({ emp, s }) => [emp.id, emp.name, s.workDays, s.paidDays, s.absentDays, s.holidayWorkDays, s.remoteDays, s.scheduled, s.legalIn, s.legalOut, s.over60, s.night, s.legalHoliday, s.nonLegalHoliday, s.holidayNight, s.flexCarry]));
}

export function journalCsv(list: Journal[], appr: Approvals, from: string, to: string) {
  const rows: unknown[][] = [];
  for (const j of list) {
    if (j.date < from || j.date > to) continue;
    const a = appr[j.id];
    j.lines.forEach((l, i) => rows.push([
      j.id, j.date, i + 1, l.side === "D" ? l.account : "", l.side === "D" ? acct(l.account)?.name : "", l.side === "D" ? l.amount : "",
      l.side === "C" ? l.account : "", l.side === "C" ? acct(l.account)?.name : "", l.side === "C" ? l.amount : "",
      l.tax ?? "", l.dept ?? "", j.memo, j.partner ?? "", j.evidenceNo ?? "", j.invoiceNo ?? "", j.createdBy, a?.by ?? "", a?.at ?? "",
      isPosted(j, appr) ? "転記済" : "承認待ち", j.source, j.reverses ?? "", j.seq, j.hash,
    ]));
  }
  return toCsv(["仕訳番号", "取引日", "行", "借方科目コード", "借方科目", "借方金額", "貸方科目コード", "貸方科目", "貸方金額", "税区分", "部門", "摘要", "取引先", "証憑番号", "適格請求書登録番号", "起票者", "承認者", "承認日時", "状態", "発生源", "取消元仕訳", "連番", "ハッシュ"], rows);
}

/** 総勘定元帳：科目別に日付順の残高推移 */
export function ledgerCsv(list: Journal[], appr: Approvals, from: string, to: string) {
  const rows: unknown[][] = [];
  for (const a of [...new Set(list.flatMap((j) => j.lines.map((l) => l.account)))].sort()) {
    const ac = acct(a)!, debitNormal = ac.type === "資産" || ac.type === "費用";
    let bal = 0;
    for (const j of list) {
      if (!isPosted(j, appr) || j.date > to) continue;
      for (const l of j.lines) {
        if (l.account !== a) continue;
        bal += (l.side === "D") === debitNormal ? l.amount : -l.amount;
        if (j.date >= from) rows.push([a, ac.name, j.date, j.id, j.memo, l.side === "D" ? l.amount : "", l.side === "C" ? l.amount : "", bal]);
      }
    }
  }
  return toCsv(["科目コード", "科目名", "日付", "仕訳番号", "摘要", "借方", "貸方", "残高"], rows);
}

export const trialBalanceCsv = (tb: TbRow[]) => toCsv(["科目コード", "科目名", "区分", "期首残高", "借方合計", "貸方合計", "期末残高"], tb.map((r) => [r.code, r.name, r.type, r.opening, r.debit, r.credit, r.closing]));

export function workflowCsv(list: Workflow[], nameOf: (id: string) => string) {
  const rows = list.flatMap((w) => w.steps.map((st, i) => [w.id, w.type, w.title, nameOf(w.applicantId), w.amount ?? "", w.createdAt, w.status, i + 1, st.label, nameOf(st.approverId), st.state, st.at ?? "", st.comment ?? "", w.invoiceNo ?? ""]));
  return toCsv(["申請番号", "種別", "件名", "申請者", "金額", "申請日", "全体状態", "承認順", "承認段階", "承認者", "段階状態", "処理日", "コメント", "適格請求書登録番号"], rows);
}

export const auditCsv = (list: Audit[]) => toCsv(["連番", "日時", "実行者", "操作", "直前ハッシュ", "ハッシュ"], list.map((a) => [a.seq, a.at, a.actor, a.action, a.prev, a.hash]));
