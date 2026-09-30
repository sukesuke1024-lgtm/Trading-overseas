"use client";

import { useMemo, useState } from "react";
import { Download, Lock, ShieldAlert } from "lucide-react";
import { balanceSheet, consumptionTax, fyStartOf, incomeStatement, isPosted, monthsOfFy, sgaByDept, sgaByMonth, trialBalance } from "@/lib/accounting";
import { can } from "@/lib/perm";
import { download } from "@/lib/csv";
import { toCsv } from "@/lib/csv";
import { trialBalanceCsv } from "@/lib/exports";
import { useStore, ymd } from "@/lib/store";
import { Badge, PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader, UNIT_LABEL, UnitSelect, amt, type Unit } from "@/components/report";

const TABS = ["概要", "損益計算書", "貸借対照表", "試算表", "販管費", "消費税"] as const;
type Tab = (typeof TABS)[number];

export default function Accounting() {
  const { s, d, meId, role } = useStore();
  const [tab, setTab] = useState<Tab>("概要");
  const [unit, setUnit] = useState<Unit>(1_000_000);
  const today = ymd(new Date());
  const fy = fyStartOf(today);
  const months = useMemo(() => monthsOfFy(fy, today), [fy, today]);
  const [upTo, setUpTo] = useState(months[months.length - 1]);
  const to = `${upTo}-31`;
  const canWrite = can.writeAccounting(role);

  const tb = useMemo(() => trialBalance(s.journal, s.jApprovals, fy, to), [s.journal, s.jApprovals, fy, to]);
  const pl = incomeStatement(tb);
  const bs = useMemo(() => balanceSheet(s.journal, s.jApprovals, fy, to), [s.journal, s.jApprovals, fy, to]);
  const monthly = useMemo(() => months.map((m) => ({ m, pl: incomeStatement(trialBalance(s.journal, s.jApprovals, `${m}-01`, `${m}-31`)) })), [months, s.journal, s.jApprovals]);
  const sgaM = useMemo(() => sgaByMonth(s.journal, s.jApprovals, months), [months, s.journal, s.jApprovals]);
  const dept = useMemo(() => sgaByDept(s.journal, s.jApprovals, fy, to), [s.journal, s.jApprovals, fy, to]);
  const ct = consumptionTax(tb);
  const pending = s.journal.filter((j) => !isPosted(j, s.jApprovals)).length;
  const period = `第${Number(fy.slice(0, 4)) - 2000 + 0}期 ${fy} 〜 ${upTo}末（${UNIT_LABEL[unit]}）`;
  const pct = (n: number) => (pl.sales ? `${((n / pl.sales) * 100).toFixed(1)}%` : "—");

  if (!can.viewAccounting(role)) return <Denied />;


  return (
    <div>
      <div className="print:hidden"><PageHeader title="決算書・販管費" sub="仕訳から自動集計。承認済みの仕訳のみ反映されます（簡易版：正式な決算は監査法人・税理士の確認が必要）。" actions={<div className="flex flex-wrap items-center gap-2"><UnitSelect unit={unit} onChange={setUnit} /><select className="input !h-8 !w-auto" aria-label="集計月" value={upTo} onChange={(e) => setUpTo(e.target.value)}>{months.map((m) => <option key={m} value={m}>{m} 末</option>)}</select><PrintButton what={`決算書 ${tab} ${upTo}`} /></div>} /></div>
      <PrintHeader title={tab === "概要" ? "月次決算 概要" : tab} period={period} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line print:hidden" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-semibold ${tab === t ? "border-brand text-brand" : "border-transparent text-ink-3"}`}>{t}</button>)}
      </div>

      {tab === "概要" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[["売上高", pl.sales], ["売上総利益", pl.grossProfit], ["販管費", pl.sgaTotal], ["営業利益", pl.operatingIncome], ["当期純利益", pl.netIncome]].map(([l, v]) => (
              <div key={l as string} className="card p-3"><div className="text-[12px] text-ink-3">{l as string}</div><div className="tabular text-xl font-bold">{amt(v as number, unit)}</div><div className="text-[11px] text-ink-3">{UNIT_LABEL[unit]}・売上比 {pct(v as number)}</div></div>
            ))}
          </div>
          <div className="card p-4"><h2 className="mb-2 font-bold">月次推移（売上高・営業利益）</h2><Chart data={monthly.map((x) => ({ m: x.m.slice(5) + "月", a: x.pl.sales, b: x.pl.operatingIncome }))} unit={unit} /></div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold"><Lock size={15} aria-hidden />月次締め（内部統制）</h2>
              <ul className="divide-y divide-line text-[13.5px]">
                {months.map((m, i) => {
                  const closed = s.closed.includes(m), prevOk = i === 0 || s.closed.includes(months[i - 1]);
                  return <li key={m} className="flex items-center gap-3 py-2"><span className="tabular w-20">{m}</span>{closed ? <Badge tone="good">締め済</Badge> : <Badge tone="warn">未締め</Badge>}<span className="flex-1" />{!closed && canWrite && <button className="btn !h-8" disabled={!prevOk || m === today.slice(0, 7)} title={m === today.slice(0, 7) ? "当月は月末以降に締められます" : !prevOk ? "前月の締めが先です" : ""} onClick={() => confirm(`${m} を締めます。以後、この月への仕訳の追加・取消はできません（再オープン不可）。`) && d({ t: "close-month", month: m, by: meId })}>締める</button>}</li>;
                })}
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold"><ShieldAlert size={15} aria-hidden />決算前チェック</h2>
              <ul className="space-y-2 text-[13.5px]">
                <li className="flex justify-between">貸借対照表の貸借一致{bs.balanced ? <Badge tone="good">OK</Badge> : <Badge tone="bad">不一致</Badge>}</li>
                <li className="flex justify-between">承認待ちの仕訳{pending === 0 ? <Badge tone="good">なし</Badge> : <Badge tone="warn">{pending}件</Badge>}</li>
                <li className="flex justify-between">試算表の貸借合計一致{tb.reduce((a, r) => a + r.debit, 0) === tb.reduce((a, r) => a + r.credit, 0) ? <Badge tone="good">OK</Badge> : <Badge tone="bad">不一致</Badge>}</li>
                <li className="flex justify-between">未承認の給与確定<Badge tone={Object.values(s.payroll).some((p) => p.status === "計算済") ? "warn" : "good"}>{Object.values(s.payroll).filter((p) => p.status === "計算済").length}件</Badge></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === "損益計算書" && (
        <div className="card overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr><th className="th">科目</th><th className="th text-right">金額（{UNIT_LABEL[unit]}）</th><th className="th text-right">売上比</th></tr></thead><tbody>
          <Row unit={unit} pct={pct} l="売上高" v={pl.sales} bold /><Row unit={unit} pct={pct} l="売上原価" v={pl.cogs} indent /><Row unit={unit} pct={pct} l="売上総利益" v={pl.grossProfit} bold top />
          {pl.sga.map((x) => <Row key={x.code} unit={unit} pct={pct} l={x.name} v={x.amount} indent />)}
          <Row unit={unit} pct={pct} l="販売費及び一般管理費 計" v={pl.sgaTotal} bold top /><Row unit={unit} pct={pct} l="営業利益" v={pl.operatingIncome} bold top />
          <Row unit={unit} pct={pct} l="営業外収益（受取利息）" v={pl.nonOpIncome} indent /><Row unit={unit} pct={pct} l="営業外費用（支払利息）" v={pl.nonOpExpense} indent /><Row unit={unit} pct={pct} l="経常利益" v={pl.ordinaryIncome} bold top />
          <Row unit={unit} pct={pct} l="税引前当期純利益" v={pl.preTaxIncome} bold /><Row unit={unit} pct={pct} l="法人税等" v={pl.tax} indent /><Row unit={unit} pct={pct} l="当期純利益" v={pl.netIncome} bold top />
        </tbody></table></div>
      )}

      {tab === "貸借対照表" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[["資産の部", bs.assets, bs.totalAssets, "資産合計"], ["負債・純資産の部", [...bs.liabilities, ...bs.equity], bs.totalLiabilities + bs.totalEquity, "負債・純資産合計"]].map(([title, rows, total, tl]) => (
            <div key={title as string} className="card overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr><th className="th" colSpan={2}>{title as string}</th></tr></thead><tbody>
              {(rows as typeof bs.assets).map((r) => <tr key={r.code}><td className="td pl-6">{r.name}</td><td className="td tabular text-right">{amt(r.type === "資産" && r.code === "1690" ? -r.closing : r.closing, unit)}</td></tr>)}
              {title === "負債・純資産の部" && <tr><td className="td pl-6">当期純利益</td><td className="td tabular text-right">{amt(bs.currentProfit, unit)}</td></tr>}
              <tr className="border-t-2 border-line-strong font-bold"><td className="td">{tl as string}</td><td className="td tabular text-right">{amt(total as number, unit)}</td></tr>
            </tbody></table></div>
          ))}
          <p className={`text-[12.5px] lg:col-span-2 ${bs.balanced ? "text-good" : "text-bad"}`}>{bs.balanced ? "✔ 資産合計＝負債・純資産合計（貸借一致）" : "✖ 貸借が一致していません。仕訳を確認してください。"}　※減価償却累計額は資産の控除項目として表示しています。</p>
        </div>
      )}

      {tab === "試算表" && (
        <div>
          <div className="mb-2 flex justify-end print:hidden"><button className="btn" onClick={() => { download(`試算表_${upTo}.csv`, trialBalanceCsv(tb)); d({ t: "export-log", by: meId, what: `試算表CSV ${upTo}` }); }}><Download size={14} />CSV</button></div>
          <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]"><thead><tr><th className="th">コード</th><th className="th">科目</th><th className="th">区分</th><th className="th text-right">期首</th><th className="th text-right">借方</th><th className="th text-right">貸方</th><th className="th text-right">期末</th></tr></thead><tbody>
            {tb.map((r) => <tr key={r.code}><td className="td tabular">{r.code}</td><td className="td">{r.name}</td><td className="td">{r.type}</td><td className="td tabular text-right">{amt(r.opening, unit)}</td><td className="td tabular text-right">{amt(r.debit, unit)}</td><td className="td tabular text-right">{amt(r.credit, unit)}</td><td className="td tabular text-right font-semibold">{amt(r.closing, unit)}</td></tr>)}
            <tr className="border-t-2 border-line-strong font-bold"><td className="td" colSpan={4}>合計</td><td className="td tabular text-right">{amt(tb.reduce((a, r) => a + r.debit, 0), unit)}</td><td className="td tabular text-right">{amt(tb.reduce((a, r) => a + r.credit, 0), unit)}</td><td className="td" /></tr>
          </tbody></table></div>
        </div>
      )}

      {tab === "販管費" && (
        <div className="space-y-5">
          <div className="mb-2 flex justify-end print:hidden"><button className="btn" onClick={() => { download(`販管費_${upTo}.csv`, toCsv(["科目コード", "科目", ...months, "合計"], sgaM.map((r) => [r.code, r.name, ...r.monthly, r.monthly.reduce((a, b) => a + b, 0)]))); d({ t: "export-log", by: meId, what: `販管費CSV ${upTo}` }); }}><Download size={14} />CSV</button></div>
          <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-[13px]"><thead><tr><th className="th">科目</th>{months.map((m) => <th key={m} className="th text-right tabular">{m.slice(5)}月</th>)}<th className="th text-right">合計</th><th className="th text-right">売上比</th></tr></thead><tbody>
            {sgaM.map((r) => { const t = r.monthly.reduce((a, b) => a + b, 0); return <tr key={r.code}><td className="td">{r.name}</td>{r.monthly.map((v, i) => <td key={i} className="td tabular text-right">{amt(v, unit)}</td>)}<td className="td tabular text-right font-semibold">{amt(t, unit)}</td><td className="td tabular text-right text-ink-3">{pct(t)}</td></tr>; })}
            <tr className="border-t-2 border-line-strong font-bold"><td className="td">販管費 計</td>{months.map((m, i) => <td key={m} className="td tabular text-right">{amt(sgaM.reduce((a, r) => a + r.monthly[i], 0), unit)}</td>)}<td className="td tabular text-right">{amt(pl.sgaTotal, unit)}</td><td className="td tabular text-right">{pct(pl.sgaTotal)}</td></tr>
          </tbody></table></div>
          <div className="card p-4"><h2 className="mb-2 font-bold">部門別 販管費</h2>
            <ul className="space-y-1.5 text-[13.5px]">{dept.map((x) => <li key={x.dept} className="flex items-center gap-3"><span className="w-36 truncate">{x.dept}</span><div className="h-2 flex-1 rounded bg-surface-2"><div className="h-2 rounded bg-brand-2" style={{ width: `${(x.amount / (dept[0]?.amount || 1)) * 100}%` }} /></div><span className="tabular w-28 text-right">{amt(x.amount, unit)}</span></li>)}</ul>
          </div>
        </div>
      )}

      {tab === "消費税" && (
        <div className="card p-4"><table className="w-full max-w-lg text-[13.5px]"><tbody>
          <tr><td className="td">仮受消費税（売上に係る消費税）</td><td className="td tabular text-right">{amt(ct.output, unit)}</td></tr>
          <tr><td className="td">仮払消費税（仕入・経費に係る消費税）</td><td className="td tabular text-right">{amt(ct.input, unit)}</td></tr>
          <tr className="border-t-2 border-line-strong font-bold"><td className="td">納付見込額（仮受−仮払）</td><td className="td tabular text-right">{amt(ct.payable, unit)}</td></tr>
        </tbody></table><p className="mt-3 text-[12px] text-ink-3">簡易集計です。適格請求書（登録番号）のない仕入は仮払消費税に計上せず、税込金額を費用として処理しています。申告時は税率別・課税区分別の集計と、2割特例・経過措置の要否を税理士が確認してください。</p></div>
      )}
    </div>
  );
}

function Row({ l, v, bold, indent, top, unit, pct }: { l: string; v: number; bold?: boolean; indent?: boolean; top?: boolean; unit: Unit; pct: (n: number) => string }) {
  return (
    <tr className={top ? "border-t-2 border-line-strong" : ""}><td className={`td ${indent ? "pl-8" : ""} ${bold ? "font-bold" : ""}`}>{l}</td><td className={`td tabular text-right ${bold ? "font-bold" : ""}`}>{amt(v, unit)}</td><td className="td tabular w-24 text-right text-ink-3">{pct(v)}</td></tr>
  );
}

function Denied() { return <div className="card p-8 text-center text-ink-2">この画面は経理担当・監査・管理者のみ閲覧できます。</div>; }

function Chart({ data, unit }: { data: { m: string; a: number; b: number }[]; unit: Unit }) {
  const max = Math.max(1, ...data.map((x) => Math.max(x.a, Math.abs(x.b))));
  const H = 120, W = 560, bw = W / Math.max(1, data.length);
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H + 24}`} className="h-44 w-full min-w-[420px]" role="img" aria-label="月次の売上高と営業利益">
      {data.map((x, i) => { const h1 = (x.a / max) * H, h2 = (Math.max(0, x.b) / max) * H; return (
        <g key={x.m} transform={`translate(${i * bw},0)`}>
          <rect x={bw * 0.14} y={H - h1} width={bw * 0.32} height={h1} rx="2" fill="var(--brand-2)"><title>{`${x.m} 売上高 ${amt(x.a, unit)}${UNIT_LABEL[unit]}`}</title></rect>
          <rect x={bw * 0.5} y={H - h2} width={bw * 0.32} height={h2} rx="2" fill="var(--good)"><title>{`${x.m} 営業利益 ${amt(x.b, unit)}${UNIT_LABEL[unit]}`}</title></rect>
          <text x={bw / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--text-3)">{x.m}</text>
        </g>); })}
    </svg>
    <div className="mt-1 flex gap-4 text-[12px] text-ink-2"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-2" />売上高</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-good" />営業利益</span></div></div>
  );
}
