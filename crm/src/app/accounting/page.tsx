"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw } from "lucide-react";
import { createSaleFromDeal, recordPayment, repostSale, updateSale, useMe, useStore } from "@/lib/store";
import { ACCT, ACCT_NAME, creditTotal, debitTotal, journalCsvRows, linesTotal, monthOf, reconcile, saleAmounts } from "@/lib/journal";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, todayStr } from "@/lib/dates";
import { money, yen } from "@/lib/format";
import { permsFor } from "@/lib/selectors";
import { Drawer, Field, PageHeader, Segmented } from "@/components/ui";
import type { Sale } from "@/lib/types";

const num = (s: string) => Number(s.replace(/[^\d.-]/g, "")) || 0;

/** 売上と仕訳：カタログ → 案件の明細 → 売上 → 仕訳の金額が一致していることを確認する画面（経理・マネージャー向け） */
export default function Accounting() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const [tab, setTab] = useState<"sales" | "journal" | "recon">("recon");
  const [pay, setPay] = useState<Sale | null>(null);
  const [edit, setEdit] = useState<Sale | null>(null);

  const rec = useMemo(() => reconcile(d.sales, d.journals), [d.sales, d.journals]);
  const bad = rec.filter((r) => !r.ok);
  const unposted = d.deals.filter((x) => x.stage === "won" && !d.sales.some((s) => s.dealId === x.id));
  const totalSales = d.sales.reduce((a, s) => a + s.amountJPY, 0);
  const journalSales = d.journals.flatMap((j) => j.lines).filter((l) => l.account === ACCT.売上高 && l.side === "C").reduce((a, l) => a + l.amount, 0);
  const ar = d.journals.flatMap((j) => j.lines).filter((l) => l.account === ACCT.売掛金).reduce((a, l) => a + (l.side === "D" ? l.amount : -l.amount), 0);
  const fxPL = d.journals.flatMap((j) => j.lines).filter((l) => l.account === ACCT.為替差損益).reduce((a, l) => a + (l.side === "C" ? l.amount : -l.amount), 0);
  const fees = d.journals.flatMap((j) => j.lines).filter((l) => l.account === ACCT.支払手数料).reduce((a, l) => a + l.amount, 0);
  const months = [...new Set(d.sales.map((s) => monthOf(s.date)))].sort().reverse();

  if (!perms.isManager) return <div className="card mx-auto mt-10 max-w-lg p-8 text-center text-[13px] text-ink-2"><Lock className="mx-auto mb-2 text-ink-3" />売上と仕訳は、経理担当（管理者）・Manager が閲覧・操作します。</div>;
  const orgName = (id: string) => d.organizations.find((o) => o.id === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader title="売上と仕訳" sub="受注した案件の明細から売上を計上し、仕訳を自動で作ります。売上金額と仕訳の金額が一致しているかを、いつでも照合できます。"
        actions={<><button className="btn" onClick={() => downloadCsv("journals.csv", journalCsvRows(d.journals))}><Download size={14} />仕訳CSV</button><Segmented value={tab} onChange={setTab} options={[{ id: "recon", label: "照合" }, { id: "sales", label: "売上" }, { id: "journal", label: "仕訳" }]} /></>} />

      <div className={`mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold ${bad.length === 0 && unposted.length === 0 ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
        {bad.length === 0 && unposted.length === 0 ? <><CheckCircle2 size={18} />売上と仕訳は一致しています（{d.sales.length}件・差額 {yen(totalSales - journalSales)}）</> : <><AlertTriangle size={18} />不一致 {bad.length}件／売上未計上の受注 {unposted.length}件があります。「照合」で内容を確認し、仕訳を再計上してください。</>}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["売上合計（円）", yen(totalSales)], ["仕訳：売上高（貸方）", yen(journalSales)], ["売掛金残高", yen(ar)], ["為替差損益", `${fxPL >= 0 ? "+" : ""}${yen(fxPL)}`], ["銀行手数料（累計）", yen(fees)]].map(([l, v]) => <div key={l} className="card p-4"><div className="text-[11.5px] text-ink-3">{l}</div><div className="num mt-1.5 text-[19px] font-bold">{v}</div></div>)}
      </div>

      {unposted.length > 0 && (
        <div className="mb-5 rounded-xl bg-warn-soft p-4 text-[12.5px] text-warn"><b>受注済みで、売上が未計上の案件：</b>
          <ul className="mt-2 space-y-1.5">{unposted.map((x) => <li key={x.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 text-ink"><span className="flex-1">{x.name}（{money(x.amount, x.currency)}）</span><button className="btn btn-sm btn-primary" onClick={() => createSaleFromDeal(x.id)}>売上を計上</button></li>)}</ul></div>
      )}

      {tab === "recon" && (
        <div className="space-y-5">
          <section className="card overflow-x-auto">
            <div className="card-h"><h2 className="card-t">月別の照合（売上 ＝ 仕訳の売上高）</h2></div>
            <table className="tbl mt-2 min-w-[640px]"><thead><tr><th>月</th><th className="text-right">売上（円）</th><th className="text-right">仕訳：売上高</th><th className="text-right">差額</th><th>結果</th></tr></thead>
              <tbody>{months.map((m) => { const s = d.sales.filter((x) => monthOf(x.date) === m).reduce((a, x) => a + x.amountJPY, 0); const ids = new Set(d.sales.filter((x) => monthOf(x.date) === m).map((x) => x.id)); const j = d.journals.filter((x) => ids.has(x.saleId)).flatMap((x) => x.lines).filter((l) => l.account === ACCT.売上高 && l.side === "C").reduce((a, l) => a + l.amount, 0); return (
                <tr key={m}><td className="num font-semibold">{m}</td><td className="num text-right">{yen(s)}</td><td className="num text-right">{yen(j)}</td><td className={`num text-right ${s - j ? "text-bad" : ""}`}>{yen(s - j)}</td><td>{s === j ? <span className="chip chip-good">一致</span> : <span className="chip chip-bad">不一致</span>}</td></tr>); })}</tbody></table>
          </section>
          <section className="card overflow-x-auto">
            <div className="card-h"><h2 className="card-t">売上ごとの照合</h2></div>
            <table className="tbl mt-2 min-w-[860px]"><thead><tr><th>売上番号</th><th>顧客</th><th className="text-right">売上（円）</th><th className="text-right">仕訳：売上高</th><th className="text-right">仕訳：売掛金（借方）</th><th>結果</th><th /></tr></thead>
              <tbody>{rec.map((r) => { const s = d.sales.find((x) => x.id === r.saleId)!; return (
                <tr key={r.saleId}><td className="num font-semibold">{r.no}</td><td className="max-w-[200px] truncate">{orgName(s.orgId)}</td><td className="num text-right">{yen(r.saleJPY)}</td><td className="num text-right">{yen(r.journalSalesJPY)}</td><td className="num text-right">{yen(r.arDebit)}</td>
                  <td>{r.ok ? <span className="chip chip-good">一致</span> : <div className="space-y-1">{r.issues.map((i) => <div key={i} className="text-[11.5px] text-bad">{i}</div>)}</div>}</td>
                  <td className="text-right">{!r.ok && <button className="btn btn-sm btn-primary" onClick={() => repostSale(r.saleId)}><RefreshCw size={12} />仕訳を再計上</button>}</td></tr>); })}
                {rec.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ink-3">売上がありません</td></tr>}</tbody></table>
          </section>
          <section className="card p-4 text-[12.5px] leading-relaxed text-ink-2">
            <h2 className="card-t mb-2">一致を保つしくみ</h2>
            <ol className="list-decimal space-y-1 pl-5"><li><b>商品カタログ</b>の標準価格が、案件の<b>明細</b>の初期単価になる（明細の単価は案件ごとに固定。カタログを改定しても過去の案件は変わりません）。</li><li>案件金額 ＝ 明細の Σ（数量×単価）。</li><li>受注すると、明細どおりの<b>売上</b>を計上。円換算 ＝ 外貨額 × 計上レート（円未満四捨五入）。</li><li><b>仕訳</b>：借）売掛金／貸）売上高 が、売上の円換算額と同額で自動作成される。輸出売上は免税（消費税 0%）。</li><li><b>入金</b>：借）普通預金・支払手数料・為替差損益／貸）売掛金。実入金との差額は為替差損益に出る。</li><li>売上の金額・レートを後から直すと、仕訳との<b>不一致</b>として検出され、「再計上」で揃えます。</li></ol>
          </section>
        </div>
      )}

      {tab === "sales" && (
        <section className="card overflow-x-auto">
          <table className="tbl min-w-[1000px]"><thead><tr><th>番号</th><th>日付</th><th>顧客・案件</th><th className="text-right">外貨額</th><th className="text-right">レート</th><th className="text-right">円換算</th><th>状況</th><th className="text-right">実入金</th><th /></tr></thead>
            <tbody>{d.sales.map((s) => { const deal = d.deals.find((x) => x.id === s.dealId); return (
              <tr key={s.id}><td className="num font-semibold">{s.no}</td><td className="num whitespace-nowrap">{fmtDate(s.date, true)}</td><td className="max-w-[260px]"><div className="truncate font-medium">{orgName(s.orgId)}</div>{deal && <Link href={`/deals/view/?id=${deal.id}`} className="block truncate text-[11.5px] text-ink-3 hover:underline">{deal.name}</Link>}</td>
                <td className="num text-right">{money(s.amount, s.currency)}</td><td className="num text-right">{s.rate}</td><td className="num text-right font-semibold">{yen(s.amountJPY)}</td>
                <td>{s.status === "入金済" ? <span className="chip chip-good">入金済 {fmtDate(s.paidDate)}</span> : <span className="chip chip-warn">未入金</span>}</td>
                <td className="num text-right text-ink-2">{s.receivedJPY !== null ? yen(s.receivedJPY) : "—"}{s.bankFeeJPY ? <div className="text-[10.5px] text-ink-3">手数料 {yen(s.bankFeeJPY)}</div> : null}</td>
                <td className="whitespace-nowrap text-right">{s.status !== "入金済" && <button className="btn btn-sm btn-primary" onClick={() => setPay(s)}>入金登録</button>} <button className="btn btn-sm" onClick={() => setEdit(s)}>修正</button></td></tr>); })}</tbody></table>
        </section>
      )}

      {tab === "journal" && (
        <section className="card overflow-x-auto">
          <table className="tbl min-w-[860px]"><thead><tr><th>仕訳番号</th><th>日付</th><th>借方</th><th>貸方</th><th>摘要</th><th>取引先</th></tr></thead>
            <tbody>{d.journals.map((j) => (
              <tr key={j.id} className="align-top"><td className="num font-semibold">{j.id}</td><td className="num whitespace-nowrap">{fmtDate(j.date, true)}</td>
                <td>{j.lines.filter((l) => l.side === "D").map((l) => <div key={l.account} className="num whitespace-nowrap">{ACCT_NAME[l.account]} <b>{l.amount.toLocaleString()}</b></div>)}</td>
                <td>{j.lines.filter((l) => l.side === "C").map((l) => <div key={l.account} className="num whitespace-nowrap">{ACCT_NAME[l.account]} <b>{l.amount.toLocaleString()}</b></div>)}<div className="text-[10.5px] text-ink-3">貸借 {debitTotal(j) === creditTotal(j) ? "一致" : "不一致"}</div></td>
                <td className="max-w-[300px] text-[12px] text-ink-2">{j.memo}</td><td className="max-w-[180px] truncate">{j.partner}</td></tr>))}</tbody></table>
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">勘定科目コードは社内ポータルの勘定科目表に合わせています（為替差損益 4220 は CRM 側の追加科目。ポータルに取り込むときは科目を追加してください）。税区分は輸出免税のため「対象外」で出力します。決算・申告前は税理士の確認を受けてください。</p>
        </section>
      )}

      {pay && <PayDrawer sale={pay} onClose={() => setPay(null)} />}
      {edit && <EditDrawer sale={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PayDrawer({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [date, setDate] = useState(todayStr());
  const [received, setReceived] = useState(String(sale.amountJPY));
  const [fee, setFee] = useState(sale.currency === "JPY" ? "0" : "4500");
  const diff = sale.amountJPY - num(received) - num(fee);
  return (
    <Drawer open onClose={onClose} title={`入金登録 ${sale.no}`} footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={num(received) <= 0} onClick={() => { recordPayment(sale.id, date, num(received), num(fee)); onClose(); }}>登録する</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3 text-[12.5px]">売上 <b className="num">{money(sale.amount, sale.currency)}</b>（計上レート {sale.rate}）＝ <b className="num">{yen(sale.amountJPY)}</b></div>
        <Field label="入金日"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="実際に口座に入った金額（円）" hint="銀行の入金明細の金額"><input className="input num" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} /></Field>
        <Field label="銀行手数料（円）" hint="被仕向け送金手数料・為替手数料など。入金額から差し引かれた分"><input className="input num" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
        <div className={`rounded-xl p-3 text-[12.5px] ${diff === 0 ? "bg-good-soft text-good" : diff > 0 ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}`}>{diff === 0 ? "差額なし" : diff > 0 ? <>為替差損 <b className="num">{yen(diff)}</b>（入金時のレートが計上時より円高）</> : <>為替差益 <b className="num">{yen(-diff)}</b></>}　→ 仕訳に自動で反映されます</div>
      </div>
    </Drawer>
  );
}

function EditDrawer({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [lines, setLines] = useState(sale.lines.map((l) => ({ ...l, qty: String(l.qty), unitPrice: String(l.unitPrice) })));
  const [rate, setRate] = useState(String(sale.rate));
  const parsed = lines.map((l) => ({ ...l, qty: num(l.qty), unitPrice: num(l.unitPrice) }));
  const { amount, amountJPY } = saleAmounts(parsed, num(rate));
  return (
    <Drawer open onClose={onClose} title={`売上の修正 ${sale.no}`} width={520} footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" onClick={() => { updateSale(sale.id, { lines: parsed, rate: num(rate) }); onClose(); }}>修正する</button></>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">売上を修正しても、仕訳は自動では変わりません。修正後は「照合」で不一致を確認し、「仕訳を再計上」で揃えてください。</p>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_90px] items-end gap-2"><Field label="品名"><input className="input" value={l.desc} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, desc: e.target.value } : y)))} /></Field><Field label="数量"><input className="input num" value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} /></Field><Field label="単価"><input className="input num" value={l.unitPrice} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, unitPrice: e.target.value } : y)))} /></Field></div>
        ))}
        <Field label="計上レート（円／外貨）"><input className="input num" value={rate} onChange={(e) => setRate(e.target.value)} disabled={sale.currency === "JPY"} /></Field>
        <div className="rounded-xl bg-surface-2 p-3 text-[12.5px]">外貨額 <b className="num">{money(amount, sale.currency)}</b>（明細合計 {linesTotal(parsed).toLocaleString()}）→ 円換算 <b className="num">{yen(amountJPY)}</b></div>
      </div>
    </Drawer>
  );
}
