"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Lock, Upload } from "lucide-react";
import { monthDays, monthLabel, monthSummary, shiftMonth } from "@/lib/attendance-view";
import { download } from "@/lib/csv";
import { can } from "@/lib/perm";
import { attendanceCsv, monthlySummaryCsv } from "@/lib/exports";
import { fmtH, overtimeLevel, type DayInput } from "@/lib/work";
import { useStore, ymd } from "@/lib/store";
import { Badge, PageHeader } from "@/components/ui";

type Result = { kind: "ok" | "error"; text: string; detail?: string[] };

export default function ExcelPage() {
  const { s, d, meId, role, nameOf } = useStore();
  const [month, setMonth] = useState(ymd(new Date()).slice(0, 7));
  const [fixNight, setFixNight] = useState(false);
  const [busy, setBusy] = useState<"att" | "pay" | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const attFile = useRef<HTMLInputElement>(null), payFile = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => s.employees.map((e) => ({ emp: e, s: monthSummary(s.attendance, e.id, month, e.scheduled, s.conditions) })), [s.employees, s.attendance, s.conditions, month]);
  const dayRows = useMemo(() => s.employees.flatMap((e) => monthDays(s.attendance, e.id, month).map((day) => ({ empId: e.id, day }))), [s.employees, s.attendance, month]);

  if (!can.excel(role)) return <div className="card p-8 text-center text-ink-2"><Lock className="mx-auto mb-2 text-ink-3" />この画面は管理者のみ利用できます。</div>;

  const scheduledOf = (id: string) => s.employees.find((e) => e.id === id)?.scheduled ?? 7.5;
  const log = (what: string) => d({ t: "export-log", by: meId, what });

  const csvDays = () => { download(`日別勤怠_${month}.csv`, attendanceCsv(dayRows, nameOf, scheduledOf, s.conditions)); log(`日別勤怠CSV ${month}（${dayRows.length}行）`); };
  const csvSummary = () => { download(`月次集計_${month}.csv`, monthlySummaryCsv(rows)); log(`月次集計CSV ${month}`); };

  const run = async (kind: "att" | "pay", file: File | undefined) => {
    if (!file) return;
    setBusy(kind); setRes(null);
    try {
      const lib = await import("@/lib/excel-link"); // 重いので使うときだけ読み込む
      const buf = await file.arrayBuffer();
      if (kind === "att") {
        const days = dayRows.map(({ empId, day }: { empId: string; day: DayInput }) => ({ date: day.date, empId, kind: day.kind, start: day.start, end: day.end, brk: day.brk, note: day.note }));
        const bytes = await lib.fillAttendanceBook(buf, { employees: s.employees.map((e) => ({ id: e.id, name: e.name, employment: e.employment, job: e.job, scheduled: e.scheduled })), days, conditions: s.conditions, fixNight });
        download(`勤怠入力_自動計算_${month}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        log(`勤怠ブックへ反映 ${month}（従業員${s.employees.length}名・${days.length}行）`);
        setRes({ kind: "ok", text: `勤怠ブックに ${s.employees.length}名・${days.length}行を反映しました。Excel で開くと、実労働・所定内・残業・深夜・休日と月次集計が自動で計算されます。`, detail: fixNight ? ["深夜労働の計算式を修正して出力しました。"] : undefined });
      } else {
        const r = await lib.fillPayrollBook(buf, { month, rows: rows.map(({ emp, s: sum }) => ({ id: emp.id, name: emp.name, summary: sum })) });
        download(`賃金計算・業務管理システム_${month}.xlsx`, r.bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        log(`賃金計算ブック⑤へ反映 ${month}（${r.written.length}名）`);
        setRes({ kind: r.written.length ? "ok" : "error", text: r.written.length ? `賃金計算ブックの⑤勤怠入力（${Number(month.slice(5))}月）に ${r.written.length}名を反映しました。⑥賃金計算以降は Excel が自動で計算します。` : "反映できる従業員が見つかりませんでした。④従業員マスタの氏名とポータルの氏名が一致しているか確認してください。",
          detail: r.missing.length ? [`④従業員マスタに見つからない人（反映していません）：${r.missing.join("、")}`] : undefined });
      }
    } catch (e) {
      setRes({ kind: "error", text: e instanceof Error ? e.message : "処理に失敗しました。ファイルが壊れているか、対応していない形式です。" });
    } finally { setBusy(null); if (attFile.current) attFile.current.value = ""; if (payFile.current) payFile.current.value = ""; }
  };

  return (
    <div>
      <PageHeader title="Excel連携・CSV" sub="入力した勤怠を、勤怠ブックと賃金計算ブックに反映して給与計算につなげます。" actions={<div className="flex items-center gap-1"><button className="btn !h-9 !w-9 !p-0" aria-label="前月" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button><span className="tabular min-w-28 text-center font-bold">{monthLabel(month)}</span><button className="btn !h-9 !w-9 !p-0" aria-label="翌月" onClick={() => setMonth(shiftMonth(month, 1))}>›</button></div>} />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[12px] text-white">1</span>CSVで出力</h2>
          <p className="mb-3 text-[12.5px] text-ink-2">日別勤怠は勤怠ブックの「日別勤怠」にそのまま貼り付けられる列順です。</p>
          <div className="flex flex-col gap-2">
            <button className="btn justify-start" onClick={csvDays} disabled={!dayRows.length}><Download size={14} />日別勤怠CSV（{dayRows.length}行）</button>
            <button className="btn justify-start" onClick={csvSummary} disabled={!rows.length}><FileText size={14} />月次集計CSV（{rows.length}名）</button>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[12px] text-white">2</span>勤怠ブックに反映</h2>
          <p className="mb-3 text-[12.5px] text-ink-2">「勤怠入力_自動計算.xlsx」を選ぶと、従業員・休日マスタ・日別勤怠を書き込んだファイルをダウンロードできます（数式・書式はそのまま）。</p>
          <label className="mb-3 flex items-start gap-2 text-[12.5px]"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={fixNight} onChange={(e) => setFixNight(e.target.checked)} />深夜労働の計算式を修正する<span className="text-ink-3">（日をまたぐ勤務で24:00〜5:00が二重計上される式を正しい式に置き換えます）</span></label>
          <input ref={attFile} type="file" accept=".xlsx" className="sr-only" id="att-file" onChange={(e) => run("att", e.target.files?.[0])} />
          <label htmlFor="att-file" className={`btn btn-primary w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileSpreadsheet size={15} />{busy === "att" ? "反映中…" : "勤怠ブックを選んで反映"}</label>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[12px] text-white">3</span>賃金計算ブックに反映</h2>
          <p className="mb-3 text-[12.5px] text-ink-2">「賃金計算・業務管理システム.xlsx」を選ぶと、⑤勤怠入力に {monthLabel(month)} の月次集計を書き込みます。⑥賃金計算・⑧賃金台帳は Excel が自動計算します。</p>
          <input ref={payFile} type="file" accept=".xlsx" className="sr-only" id="pay-file" onChange={(e) => run("pay", e.target.files?.[0])} />
          <label htmlFor="pay-file" className={`btn btn-primary w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><Upload size={15} />{busy === "pay" ? "反映中…" : "賃金計算ブックを選んで反映"}</label>
        </section>
      </div>

      {res && (
        <div role="status" className={`mb-5 rounded-lg px-4 py-3 text-[13.5px] ${res.kind === "ok" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
          {res.text}{res.detail?.map((t) => <div key={t} className="mt-1 text-[12.5px]">{t}</div>)}
        </div>
      )}
      <p className="mb-4 flex items-start gap-2 text-[12.5px] text-ink-3"><Lock size={14} className="mt-0.5 shrink-0" aria-hidden />Excelファイルはこのブラウザの中だけで処理され、サーバーやインターネットには送信されません（従業員の個人情報・賃金を含むため）。反映後のファイルは、元のファイルを上書きせず別名でダウンロードされます。</p>

      <section className="card overflow-x-auto" aria-label="月次集計のプレビュー">
        <div className="border-b border-line px-4 py-3"><h2 className="font-bold">反映される月次集計（{monthLabel(month)}）</h2><p className="text-[12px] text-ink-3">勤怠ブックの「月次集計」・賃金計算ブックの「⑤勤怠入力」と同じ内容です。</p></div>
        <table className="w-full min-w-[900px] text-[13px]"><thead><tr><th className="th">従業員</th><th className="th text-right">出勤</th><th className="th text-right">有給</th><th className="th text-right">欠勤</th><th className="th text-right">リモート</th><th className="th text-right">所定内</th><th className="th text-right">法定内残業</th><th className="th text-right">法定外残業</th><th className="th text-right">60h超</th><th className="th text-right">深夜</th><th className="th text-right">法定休日</th><th className="th text-right">法定外休日</th><th className="th">36協定</th></tr></thead>
          <tbody>{rows.map(({ emp, s: x }) => { const lv = overtimeLevel(x.overtime45, x.total100); return (
            <tr key={emp.id}><td className="td"><div className="font-medium">{emp.name}</div><div className="text-[11.5px] text-ink-3">{emp.id}・{emp.job}</div></td>
              <td className="td tabular text-right">{x.workDays + x.holidayWorkDays}</td><td className="td tabular text-right">{x.paidDays}</td><td className="td tabular text-right">{x.absentDays}</td><td className="td tabular text-right">{x.remoteDays}</td>
              <td className="td tabular text-right">{fmtH(x.scheduled)}</td><td className="td tabular text-right">{fmtH(x.legalIn)}</td><td className="td tabular text-right">{fmtH(x.legalOut)}</td><td className="td tabular text-right">{x.over60 ? fmtH(x.over60) : ""}</td><td className="td tabular text-right">{fmtH(x.night)}</td><td className="td tabular text-right">{fmtH(x.legalHoliday)}</td><td className="td tabular text-right">{fmtH(x.nonLegalHoliday)}</td>
              <td className="td">{lv.level === "ok" ? <Badge tone="good">OK</Badge> : <Badge tone={lv.level === "notice" ? "warn" : "bad"}>{x.overtime45.toFixed(1)}h</Badge>}</td></tr>); })}
          </tbody></table>
      </section>
    </div>
  );
}
