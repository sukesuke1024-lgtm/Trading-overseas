"use client";

import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, Download } from "lucide-react";
import { summarize } from "@/lib/attendance-calc";
import { EMPLOYEES, empById, type Employee } from "@/lib/data";
import { computePay, totals, RATES, type PayInput, type PayRow } from "@/lib/payroll";
import { can } from "@/lib/perm";
import { download } from "@/lib/csv";
import { payrollCsv } from "@/lib/exports";
import { leaveDatesOf, useStore, ymd } from "@/lib/store";
import { Badge, PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader, amt } from "@/components/report";

const BASE_BY_TITLE: Record<string, number> = { 本部長: 1_100_000, 部長: 950_000, 課長: 720_000, 主任研究員: 560_000, 主任: 520_000, 研究員: 420_000, 担当: 340_000 };
const ALLOW_BY_TITLE: Record<string, number> = { 本部長: 120_000, 部長: 80_000, 課長: 40_000, 主任研究員: 20_000, 主任: 15_000 };
// 給与マスタ（デモ）：役職から基本給・役職手当を決め、通勤・扶養・住民税は社員番号から決定的に生成
const master = (e: Employee, i: number) => ({ base: BASE_BY_TITLE[e.title] ?? 340_000, allowance: ALLOW_BY_TITLE[e.title] ?? 0, commute: 12_000 + (i % 5) * 3_000, dependents: i % 3, residentTax: Math.round((BASE_BY_TITLE[e.title] ?? 340_000) * 0.062 / 100) * 100 });

export default function Payroll() {
  const { s, d, meId, role } = useStore();
  const month = ymd(new Date()).slice(0, 7);
  const [sel, setSel] = useState(month);
  const [detail, setDetail] = useState<string | null>(null);
  const run = s.payroll[sel];
  const w = can.writeAccounting(role);

  const calc = useMemo(() => {
    const days = Array.from({ length: 31 }, (_, i) => `${sel}-${String(i + 1).padStart(2, "0")}`).filter((x) => x.slice(0, 7) === sel && !isNaN(new Date(x).getTime()));
    return EMPLOYEES.map((e, i): PayRow => {
      const sum = summarize(days, s.punches[e.id] ?? {}, leaveDatesOf(s.workflows, e.id), ymd(new Date()));
      const input: PayInput = { id: e.id, name: e.name, dept: e.dept, ...master(e, i), hours: { overtime: sum.overtime, night: sum.night, legalHoliday: sum.legalHoliday } };
      return computePay(input);
    });
  }, [s.punches, s.workflows, sel]);

  // 一般社員：自分の確定済み給与明細のみ
  if (!can.viewPayroll(role)) {
    const mine = Object.values(s.payroll).filter((r) => r.status === "確定").map((r) => ({ run: r, row: r.rows.find((x) => x.id === meId) })).filter((x) => x.row);
    return (
      <div>
        <PageHeader title="給与明細" sub="確定済みの自分の給与明細のみ表示されます。" />
        {mine.length === 0 ? <div className="card p-8 text-center text-ink-3">確定済みの給与明細はまだありません。</div> : mine.map(({ run, row }) => <Slip key={run.month} run={run.month} r={row!} />)}
      </div>
    );
  }

  const rows = run?.rows ?? calc;
  const t = totals(rows);
  const pd = rows.find((r) => r.id === detail);
  return (
    <div>
      <div className="print:hidden"><PageHeader title="給与計算" sub="勤怠（時間外・深夜・休日）から自動計算。確定すると仕訳（給料手当・法定福利費・預り金）が自動作成されます。" actions={<div className="flex flex-wrap items-center gap-2">
        <select className="input !h-9 !w-auto" aria-label="対象月" value={sel} onChange={(e) => setSel(e.target.value)}>{[...new Set([month, ...Object.keys(s.payroll)])].sort().reverse().map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <button className="btn" onClick={() => { download(`給与台帳_${sel}.csv`, payrollCsv(Object.values(s.payroll))); d({ t: "export-log", by: meId, what: "給与台帳CSV" }); }} disabled={!Object.keys(s.payroll).length}><Download size={14} />CSV</button>
        <PrintButton what={`給与一覧 ${sel}`} /></div>} /></div>
      <PrintHeader title="給与計算一覧" period={`対象月 ${sel}（${run?.status ?? "未計算"}）`} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["総支給額", t.gross], ["控除合計", t.withholding], ["差引支給額", t.net], ["会社負担社保", t.employerInsurance], ["人件費合計", t.gross + t.employerInsurance]].map(([l, v]) => <div key={l as string} className="card p-3"><div className="text-[12px] text-ink-3">{l as string}</div><div className="tabular text-lg font-bold">¥{amt(v as number)}</div></div>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Badge tone={run?.status === "確定" ? "good" : run ? "warn" : "gray"}>{run?.status ?? "未計算（プレビュー）"}</Badge>
        {w && run?.status !== "確定" && <button className="btn" onClick={() => d({ t: "payroll-save", run: { month: sel, status: "計算済", rows: calc, at: new Date().toISOString(), by: meId } })}><Calculator size={14} />計算して保存</button>}
        {w && run?.status === "計算済" && <button className="btn btn-primary" disabled={s.closed.includes(sel)} onClick={() => confirm(`${sel} の給与を確定し、仕訳を自動作成します。確定後は変更できません。`) && d({ t: "payroll-confirm", month: sel, by: meId })}><CheckCircle2 size={14} />確定して仕訳作成</button>}
        {run?.journalId && <span className="text-[12.5px] text-ink-3">仕訳 {run.journalId}</span>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-[12.5px]"><thead><tr><th className="th">氏名</th><th className="th">部署</th><th className="th text-right">基本給</th><th className="th text-right">諸手当</th><th className="th text-right">時間外</th><th className="th text-right">深夜/休日</th><th className="th text-right">総支給</th><th className="th text-right">社保等</th><th className="th text-right">所得税</th><th className="th text-right">住民税</th><th className="th text-right">差引支給</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-bg" onClick={() => setDetail(r.id)}>
              <td className="td font-medium">{r.name}</td><td className="td text-ink-3">{r.dept}</td><td className="td tabular text-right">{amt(r.base)}</td><td className="td tabular text-right">{amt(r.allowance + r.commute)}</td><td className="td tabular text-right">{amt(r.otPay)}</td><td className="td tabular text-right">{amt(r.nightPay + r.holidayPay)}</td><td className="td tabular text-right font-semibold">{amt(r.gross)}</td><td className="td tabular text-right">{amt(r.health + r.pension + r.employment)}</td><td className="td tabular text-right">{amt(r.incomeTax)}</td><td className="td tabular text-right">{amt(r.residentTax)}</td><td className="td tabular text-right font-bold">{amt(r.net)}</td>
            </tr>))}</tbody></table>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3 print:hidden">※ 料率は目安（健保 {(RATES.healthEmployee * 100).toFixed(2)}%・厚年 {(RATES.pensionEmployee * 100).toFixed(2)}%・雇用 {(RATES.employmentEmployee * 100).toFixed(2)}%）。所得税は年換算の概算です。本番運用前に社会保険労務士・税理士が最新の料率・源泉徴収税額表で検証してください。給与マスタ・扶養・住民税はデモ値です。</p>
      {pd && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 print:hidden" onClick={() => setDetail(null)}><div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}><Slip run={sel} r={pd} /><div className="mt-2 text-right"><button className="btn" onClick={() => setDetail(null)}>閉じる</button></div></div></div>}
    </div>
  );
}

function Slip({ run, r }: { run: string; r: PayRow }) {
  return (
    <div className="card mb-4 max-w-lg p-5 text-[13.5px] avoid-break">
      <div className="mb-2 flex items-baseline justify-between"><h2 className="text-lg font-bold">{run} 給与明細</h2><span className="text-[12px] text-ink-3">{empById(r.id)?.dept}・{r.name}</span></div>
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div><div className="mb-1 text-[12px] font-semibold text-ink-3">支給</div><Line l="基本給" v={r.base} /><Line l="役職手当等" v={r.allowance} /><Line l="通勤手当" v={r.commute} /><Line l="時間外手当" v={r.otPay} /><Line l="深夜手当" v={r.nightPay} /><Line l="休日手当" v={r.holidayPay} /><Line l="総支給額" v={r.gross} b /></div>
        <div><div className="mb-1 text-[12px] font-semibold text-ink-3">控除</div><Line l="健康保険" v={r.health} /><Line l="厚生年金" v={r.pension} /><Line l="雇用保険" v={r.employment} /><Line l="所得税" v={r.incomeTax} /><Line l="住民税" v={r.residentTax} /><Line l="控除合計" v={r.deductions} b /></div>
      </div>
      <div className="mt-3 flex justify-between rounded-lg bg-brand-soft px-3 py-2 text-lg font-bold text-brand"><span>差引支給額</span><span className="tabular">¥{r.net.toLocaleString("ja-JP")}</span></div>
    </div>
  );
}

function Line({ l, v, b }: { l: string; v: number; b?: boolean }) {
  return <div className={`flex justify-between py-1 ${b ? "border-t border-line-strong font-bold" : ""}`}><span>{l}</span><span className="tabular">¥{v.toLocaleString("ja-JP")}</span></div>;
}
