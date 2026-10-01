// 保存期間を超えた履歴を、Excelで開けるCSVに書き出して現役のデータから外す（監査ログはコピーのみ・削除しない）。
// 勤怠・日報・問い合わせ（完了分）・申請（完了分）が対象。サーバーでは1日1回、画面（管理者）でも自動実行する。
import { toCsv } from "./csv.ts";
import { attendanceCsv } from "./exports.ts";
import { cutoffDate, type FileRec, type Retention } from "./ops.ts";
import type { State } from "./store.tsx";

export type Export = { name: string; content: string; rows: number; kind: string };
export type RetentionResult = { next: State; exports: Export[] };

const DONE = ["承認済", "却下", "取下げ"];

export function runRetention(s: State, today: string, policy: Retention): RetentionResult {
  const exports: Export[] = [];
  let next: State = s;
  const nameOf = (id: string) => s.employees.find((e) => e.id === id)?.name ?? id;
  const tag = (cut: string) => `${cut.slice(0, 7)}まで`;

  // 勤怠（日別）
  const cutA = cutoffDate(today, policy.attendance);
  const attOld = Object.entries(s.attendance).flatMap(([empId, days]) => Object.values(days).filter((d) => d.date < cutA).map((day) => ({ empId, day })));
  if (attOld.length) {
    exports.push({ name: `アーカイブ_日別勤怠_${tag(cutA)}.csv`, content: attendanceCsv(attOld, nameOf, (id) => s.employees.find((e) => e.id === id)?.scheduled ?? 7.5, s.conditions), rows: attOld.length, kind: "勤怠" });
    const attendance = Object.fromEntries(Object.entries(s.attendance).map(([id, days]) => [id, Object.fromEntries(Object.entries(days).filter(([, d]) => d.date >= cutA))]));
    next = { ...next, attendance };
  }

  // 業務日報
  const cutR = cutoffDate(today, policy.reports);
  const repOld = Object.entries(s.reports).flatMap(([empId, days]) => Object.values(days).filter((r) => r.date < cutR).map((r) => ({ empId, r })));
  if (repOld.length) {
    exports.push({
      name: `アーカイブ_業務日報_${tag(cutR)}.csv`, rows: repOld.length, kind: "日報",
      content: toCsv(["日付", "従業員番号", "氏名", "状態", "関与先コード", "関与先名", "業務内容", "時間", "明日の予定", "課題", "確認コメント", "コメント者"],
        repOld.flatMap(({ empId, r }) => (r.lines?.length ? r.lines : [{ clientCode: "", clientName: "", task: r.done, hours: r.hours ?? "" }]).map((l) => [r.date, empId, nameOf(empId), r.status, l.clientCode, l.clientName, l.task, l.hours, r.plan, r.issues, r.comment ?? "", r.commentBy ? nameOf(r.commentBy) : ""]))),
    });
    const reports = Object.fromEntries(Object.entries(s.reports).map(([id, days]) => [id, Object.fromEntries(Object.entries(days).filter(([, r]) => r.date >= cutR))]));
    next = { ...next, reports };
  }

  // 問い合わせ（完了分）
  const cutM = cutoffDate(today, policy.mails);
  const mailOld = s.mails.filter((m) => m.status === "完了" && (m.thread.length ? m.thread[m.thread.length - 1].at : m.at).slice(0, 10) < cutM);
  if (mailOld.length) {
    exports.push({
      name: `アーカイブ_問い合わせ_${tag(cutM)}.csv`, rows: mailOld.length, kind: "問い合わせ",
      content: toCsv(["受付日時", "分類", "宛先区分", "宛先", "件名", "送信者", "匿名", "本文", "やり取り"], mailOld.map((m) => [m.at, m.category, m.toType, m.toId, m.subject, m.anon ? "（匿名）" : nameOf(m.from), m.anon ? "匿名" : "", m.body, m.thread.map((t) => `${t.at} ${t.by === m.from && m.anon ? "（匿名）" : nameOf(t.by)}: ${t.body}`).join(" / ")])),
    });
    const drop = new Set(mailOld.map((m) => m.id));
    next = { ...next, mails: next.mails.filter((m) => !drop.has(m.id)) };
  }

  // 申請・承認（完了分）：承認履歴（いつ・誰が・理由）ごと書き出す
  const cutW = cutoffDate(today, policy.workflows);
  const wfOld = s.workflows.filter((w) => DONE.includes(w.status) && w.createdAt < cutW);
  if (wfOld.length) {
    exports.push({
      name: `アーカイブ_申請承認_${tag(cutW)}.csv`, rows: wfOld.length, kind: "申請承認",
      content: toCsv(["申請番号", "種別", "件名", "申請者", "金額", "申請日", "状態", "内容", "承認履歴（日時・実行者・操作・理由）"],
        wfOld.map((w) => [w.id, w.type, w.title, nameOf(w.applicantId), w.amount ?? "", w.createdAt, w.status, w.detail, (w.history ?? []).map((h) => `${h.at} ${nameOf(h.by)} ${h.action}${h.reason ? `：${h.reason}` : ""}`).join(" / ")])),
    });
    const drop = new Set(wfOld.map((w) => w.id));
    next = { ...next, workflows: next.workflows.filter((w) => !drop.has(w.id)), files: next.files.filter((f) => !f.wfId || !drop.has(f.wfId)) };
  }

  // 監査ログ：コピーのみ（ハッシュ連鎖を壊さないため削除しない）
  const cutL = cutoffDate(today, policy.audit);
  const lastAudit = s.archiveMeta?.auditUpTo ?? "";
  const auditOld = s.audit.filter((a) => a.at.slice(0, 10) < cutL && a.at.slice(0, 10) >= lastAudit);
  if (auditOld.length) {
    exports.push({ name: `アーカイブ_監査ログ_${tag(cutL)}.csv`, rows: auditOld.length, kind: "監査ログ", content: toCsv(["連番", "日時", "実行者", "操作", "直前ハッシュ", "ハッシュ"], auditOld.map((a) => [a.seq, a.at, a.actor, a.action, a.prev, a.hash])) });
  }
  next = { ...next, archiveMeta: { at: today, auditUpTo: auditOld.length ? cutL : lastAudit } };
  return { next, exports };
}

/** 今日まだ実行していなければ true（1日1回） */
export const archiveDue = (s: State, today: string) => s.archiveMeta?.at !== today;

export function archiveRec(e: Export, id: string, today: string, size: number): FileRec {
  return { id, name: e.name, size, mime: "text/csv", kind: "アーカイブ", scope: "管理者", uploadedBy: "system", at: `${today}T00:00:00.000Z`, note: `${e.kind} ${e.rows}件` };
}
