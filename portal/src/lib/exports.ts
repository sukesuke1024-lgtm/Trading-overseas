// 監査・税務調査・労基署調査向けのCSV定義。列名は日本語、Excelで開ける UTF-8(BOM)。
import { acct, isPosted, type Approvals, type Journal, type TbRow } from "./accounting";
import { calcDay, fmtHM } from "./attendance-calc";
import { toCsv } from "./csv";
import { empById, type Workflow } from "./data";
import type { Audit, PayrollRun, Punch } from "./store";

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

export function payrollCsv(runs: PayrollRun[]) {
  const rows = runs.flatMap((run) => run.rows.map((r) => [run.month, run.status, r.id, r.name, r.dept, r.base, r.allowance, r.commute, r.otPay, r.nightPay, r.holidayPay, r.gross, r.health, r.pension, r.employment, r.incomeTax, r.residentTax, r.deductions, r.net, r.employerInsurance]));
  return toCsv(["対象月", "状態", "社員番号", "氏名", "部署", "基本給", "諸手当", "通勤手当", "時間外手当", "深夜手当", "休日手当", "総支給額", "健康保険", "厚生年金", "雇用保険", "所得税", "住民税", "控除合計", "差引支給額", "会社負担社保"], rows);
}

export function attendanceCsv(punches: Record<string, Record<string, Punch>>, from: string, to: string) {
  const rows: unknown[][] = [];
  for (const [emp, days] of Object.entries(punches)) for (const [d, p] of Object.entries(days)) {
    if (d < from || d > to) continue;
    const c = calcDay(d, p);
    rows.push([emp, empById(emp)?.name ?? "", d, p.in ?? "", p.out ?? "", c.breakMin, fmtHM(c.work), fmtHM(c.overtime), fmtHM(c.night), fmtHM(c.legalHoliday), p.place ?? "", p.who ?? "", p.what ?? "", p.why ?? "", p.how ?? "", p.edited ? "修正あり" : ""]);
  }
  return toCsv(["社員番号", "氏名", "日付", "出勤", "退勤", "休憩(分)", "実働", "時間外", "深夜", "法定休日労働", "どこで(勤務場所)", "誰と", "何を", "なぜ", "どのように", "修正"], rows.sort((a, b) => (String(a[0]) + String(a[2])).localeCompare(String(b[0]) + String(b[2]))));
}

export function workflowCsv(list: Workflow[]) {
  const rows = list.flatMap((w) => w.steps.map((st, i) => [w.id, w.type, w.title, empById(w.applicantId)?.name ?? w.applicantId, w.amount ?? "", w.createdAt, w.status, i + 1, st.label, empById(st.approverId)?.name ?? st.approverId, st.state, st.at ?? "", st.comment ?? "", w.invoiceNo ?? "", w.w5h?.when ?? "", w.w5h?.where ?? "", w.w5h?.who ?? "", w.detail, w.w5h?.how ?? ""]));
  return toCsv(["申請番号", "種別", "件名", "申請者", "金額", "申請日", "全体状態", "承認順", "承認段階", "承認者", "段階状態", "処理日", "コメント", "適格請求書登録番号", "いつ(5W1H)", "どこで(5W1H)", "誰が・誰と(5W1H)", "なぜ(5W1H)", "どのように(5W1H)"], rows);
}

export const auditCsv = (list: Audit[]) => toCsv(["連番", "日時", "実行者", "操作", "直前ハッシュ", "ハッシュ"], list.map((a) => [a.seq, a.at, a.actor, a.action, a.prev, a.hash]));
