"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Plus } from "lucide-react";
import { setDealLines, useStore } from "@/lib/store";
import { INCOTERM_INFO, marginLevel, quote, type Incoterm } from "@/lib/calc";
import { FX_CURRENCIES, bankRates, cachedSnapshot, fetchRates } from "@/lib/fx";
import type { Currency } from "@/lib/types";
import { isOpen } from "@/lib/constants";
import { money, yen } from "@/lib/format";
import { Field, PageHeader } from "@/components/ui";

const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;
const MIN_MARGIN = 15;

/** 見積・粗利の自動計算（営業初心者向け）。入力すると、販売単価・粗利・損益分岐・為替の影響額が自動で出る */
export default function Calculator() {
  const d = useStore().data!;
  const [productId, setProductId] = useState(d.products[0].id);
  const prod = d.products.find((p) => p.id === productId);
  const [cur, setCur] = useState<Currency>("USD");
  const [snap, setSnap] = useState(cachedSnapshot);
  const [f, setF] = useState({ incoterm: "CIF" as Incoterm, qty: "500", unitCost: String(d.products[0].costJPY), domestic: "30000", exportFee: "15000", freight: "180000", insRate: "0.3", importFee: "0", payFee: "0.5", tradeIns: "0", fxCost: "0.5", margin: "20", fixed: "" });
  const [rateMode, setRateMode] = useState<"ttb" | "ttm" | "manual">("ttb");
  const [manualRate, setManualRate] = useState("");
  const [dealId, setDealId] = useState("");
  const [added, setAdded] = useState("");

  useEffect(() => { fetchRates().then(setSnap); }, []);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const pick = (id: string) => { setProductId(id); const p = d.products.find((x) => x.id === id); if (p) set("unitCost", String(p.costJPY)); };

  const ttm = snap.rates[cur];
  const br = bankRates(ttm, cur);
  const rate = cur === "JPY" ? 1 : rateMode === "manual" ? num(manualRate) || ttm : rateMode === "ttb" ? br.ttb : ttm;

  const r = quote({
    incoterm: f.incoterm, qty: num(f.qty), unitCostJPY: num(f.unitCost), domesticJPY: num(f.domestic), exportJPY: num(f.exportFee), freightJPY: num(f.freight),
    insuranceRate: num(f.insRate), importJPY: num(f.importFee), payFeeRate: num(f.payFee), insuranceTradeRate: num(f.tradeIns), fxCostRate: num(f.fxCost),
    marginRate: num(f.margin), rate, fixedPriceJPY: f.fixed ? num(f.fixed) * rate : undefined,
  });

  const level = marginLevel(r.marginRate, MIN_MARGIN);
  const valid = Number.isFinite(r.priceTotalJPY) && num(f.qty) > 0;
  const openDeals = d.deals.filter((x) => isOpen(x.stage));
  const parts = [
    { l: "仕入原価", v: r.costGoods, c: "#17171a" }, { l: "国内費・通関", v: r.costDomestic + r.costExport, c: "#5b5f6b" }, { l: "運賃", v: r.costFreight, c: "#8a8e9b" },
    { l: "保険・決済・為替", v: r.costInsurance + r.costFees + r.costImport, c: "#c4c7d0" }, { l: "粗利", v: Math.max(r.profitJPY, 0), c: "#c8102e" },
  ];
  const sum = parts.reduce((a, p) => a + p.v, 0) || 1;

  const addToDeal = () => {
    const deal = d.deals.find((x) => x.id === dealId);
    if (!deal || !valid) return;
    // 計算の通貨 → 案件の通貨へ換算した単価を明細に追加（案件金額は明細の合計になる）
    const toDeal = deal.currency === cur ? 1 : rate / (deal.currency === "JPY" ? 1 : snap.rates[deal.currency]);
    const unitPrice = Math.round(r.priceUnitFx * toDeal * 100) / 100;
    setDealLines(deal.id, [...deal.lines, { id: `ln${Date.now().toString(36)}`, productId: prod?.id ?? "", name: prod?.name ?? "（計算結果）", qty: num(f.qty), unit: prod?.unit ?? "式", unitPrice }]);
    setAdded(`「${deal.name}」の明細に追加しました（案件金額は明細の合計に更新されます）`);
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="見積・粗利の自動計算" sub="数字を入れると、販売単価・粗利・損益分岐・為替の影響が自動で出ます。営業が初めての方も、上から順に入力してください。" />
      <details className="card mb-5 p-4" open>
        <summary className="cursor-pointer text-[13px] font-bold">はじめての方へ：3ステップ（クリックで開閉）</summary>
        <ol className="mt-3 grid gap-3 text-[12.5px] text-ink-2 sm:grid-cols-3">
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">① 商品と数量を選ぶ</b><br />カタログの仕入原価が自動で入ります。数量を入れます。</li>
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">② 条件とコストを入れる</b><br />Incoterms で「どこまで自社が負担するか」が決まります。運賃などはフォワーダーの見積を入力。</li>
          <li className="rounded-xl bg-surface-2 p-3"><b className="text-ink">③ 粗利率を見て判断</b><br />緑＝OK、黄＝上長に相談、赤＝見直し。社内基準は{MIN_MARGIN}%です。</li>
        </ol>
      </details>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <section className="card space-y-4 p-4">
            <h2 className="card-t">1. 商品と数量</h2>
            <Field label="商品（カタログから）"><select className="select" value={productId} onChange={(e) => pick(e.target.value)}>{d.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}（{p.unit}）</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`数量（${prod?.unit ?? "単位"}）`} hint={prod ? `最小ロット ${prod.moq}${prod.unit}` : undefined}><input className="input num" inputMode="decimal" value={f.qty} onChange={(e) => set("qty", e.target.value)} /></Field>
              <Field label={`仕入原価（円／${prod?.unit ?? "単位"}）`} hint="カタログの原価。変更も可"><input className="input num" inputMode="decimal" value={f.unitCost} onChange={(e) => set("unitCost", e.target.value)} /></Field>
            </div>
            {prod && num(f.qty) < prod.moq && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">数量が最小ロット（{prod.moq}{prod.unit}）に届いていません。</p>}
          </section>

          <section className="card space-y-4 p-4">
            <h2 className="card-t">2. 貿易条件（Incoterms）</h2>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(INCOTERM_INFO) as Incoterm[]).map((k) => (
                <label key={k} className={`flex cursor-pointer gap-2 rounded-xl p-2.5 text-[12.5px] ring-1 ${f.incoterm === k ? "bg-accent-soft ring-accent-2" : "ring-line hover:bg-surface-2"}`}>
                  <input type="radio" name="inc" checked={f.incoterm === k} onChange={() => set("incoterm", k)} className="mt-1" />
                  <span><b>{INCOTERM_INFO[k].label}</b><br /><span className="text-ink-3">{INCOTERM_INFO[k].desc}</span></span>
                </label>
              ))}
            </div>
            <h2 className="card-t pt-2">3. コスト（合計額・円）</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="国内費（集荷・梱包・検査）"><input className="input num" value={f.domestic} onChange={(e) => set("domestic", e.target.value)} /></Field>
              <Field label="輸出通関・書類費"><input className="input num" value={f.exportFee} onChange={(e) => set("exportFee", e.target.value)} /></Field>
              <Field label="国際運賃（海上／航空）" hint="フォワーダーの見積を入力"><input className="input num" value={f.freight} onChange={(e) => set("freight", e.target.value)} /></Field>
              <Field label="輸入通関・関税（DDPのみ）"><input className="input num" value={f.importFee} onChange={(e) => set("importFee", e.target.value)} /></Field>
              <Field label="貨物保険料率（%）" hint="CIF価格の110%に付保"><input className="input num" value={f.insRate} onChange={(e) => set("insRate", e.target.value)} /></Field>
              <Field label="決済手数料率（%）" hint="L/C手数料・送金手数料など"><input className="input num" value={f.payFee} onChange={(e) => set("payFee", e.target.value)} /></Field>
              <Field label="貿易保険（NEXI等）料率（%）"><input className="input num" value={f.tradeIns} onChange={(e) => set("tradeIns", e.target.value)} /></Field>
              <Field label="為替予約コスト（%）" hint="予約のプレミアム／ディスカウント"><input className="input num" value={f.fxCost} onChange={(e) => set("fxCost", e.target.value)} /></Field>
            </div>
          </section>

          <section className="card space-y-4 p-4">
            <h2 className="card-t">4. 目標と為替</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`目標粗利率：${f.margin}%`}><input type="range" min={0} max={50} step={1} value={f.margin} onChange={(e) => set("margin", e.target.value)} className="w-full accent-[var(--accent-2)]" /></Field>
              <Field label="販売通貨"><select className="select" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>{["JPY", ...FX_CURRENCIES].map((c) => <option key={c}>{c}</option>)}</select></Field>
            </div>
            {cur !== "JPY" && (
              <div className="rounded-xl bg-surface-2 p-3 text-[12.5px]">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">換算レート</span>
                  {([["ttb", `TTB（円に替える・目安）${br.ttb.toFixed(2)}`], ["ttm", `TTM（仲値）${ttm.toFixed(2)}`], ["manual", "手入力"]] as const).map(([k, l]) => <button key={k} onClick={() => setRateMode(k)} className={`h-7 rounded-md px-2 text-[12px] font-medium ${rateMode === k ? "bg-accent text-accent-ink" : "bg-surface text-ink-2 hover:bg-surface-3"}`}>{l}</button>)}
                  {rateMode === "manual" && <input className="input num !h-7 !w-24" value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="例 148.5" />}
                </div>
                <p className="text-ink-3">輸出の入金は、銀行が外貨を買い取る「TTB」で円に替わります（仲値より低い）。見積は TTB で計算すると、利益を取りこぼしません。{snap.source === "live" || snap.source === "cache" ? `参考レート（${snap.asOf}）` : "オフラインのため参考値"}。</p>
              </div>
            )}
            <Field label={`販売単価が先方の指値で決まっている場合（${cur}／${prod?.unit ?? "単位"}）`} hint="空欄なら、目標粗利率から販売単価を逆算します"><input className="input num" value={f.fixed} onChange={(e) => set("fixed", e.target.value)} placeholder="例 95" /></Field>
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className={`card p-5 ${!valid ? "" : level === "bad" ? "ring-2 ring-[var(--bad)]" : level === "warn" ? "ring-2 ring-[var(--warn)]" : "ring-2 ring-[var(--good)]"}`}>
            {!valid ? <p className="text-[13px] text-ink-2">数量と目標粗利率を確認してください（粗利率とコスト率の合計が100%以上だと価格が決まりません）。</p> : (
              <>
                <div className="eyebrow">販売単価（{f.incoterm}）</div>
                <div className="mt-1 flex items-baseline gap-2"><span className="num text-[38px] font-bold leading-none">{cur === "JPY" ? yen(r.priceUnitJPY) : money(r.priceUnitFx, cur)}</span><span className="text-[13px] text-ink-3">／{prod?.unit ?? "単位"}</span></div>
                <div className="mt-1 text-[12.5px] text-ink-2">合計 <b className="num">{cur === "JPY" ? yen(r.priceTotalJPY) : money(r.priceTotalFx, cur)}</b>（≈ {yen(r.priceTotalJPY)}）</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">粗利</div><div className={`num text-[20px] font-bold ${r.profitJPY < 0 ? "text-bad" : ""}`}>{yen(r.profitJPY)}</div></div>
                  <div className="rounded-xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">粗利率</div><div className={`num text-[20px] font-bold ${level === "bad" ? "text-bad" : level === "warn" ? "text-warn" : "text-good"}`}>{r.marginRate}%</div></div>
                </div>
                <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] ${level === "bad" ? "bg-bad-soft text-bad" : level === "warn" ? "bg-warn-soft text-warn" : "bg-good-soft text-good"}`}>
                  {level === "good" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                  <span>{level === "good" ? `社内基準（${MIN_MARGIN}%）を上回っています。` : level === "warn" ? `基準（${MIN_MARGIN}%）ぎりぎりです。値引きの前に上長へ相談してください。` : `基準（${MIN_MARGIN}%）を下回っています。価格・数量・条件を見直してください。`}</span>
                </div>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-3" aria-label="価格の内訳">{parts.map((p) => <span key={p.l} title={`${p.l} ${yen(p.v)}`} style={{ width: `${(p.v / sum) * 100}%`, background: p.c }} />)}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">{parts.map((p) => <span key={p.l} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: p.c }} />{p.l} {Math.round((p.v / sum) * 100)}%</span>)}</div>
              </>
            )}
          </section>

          {valid && (
            <>
              <section className="card p-4">
                <h2 className="card-t mb-2">計算の根拠</h2>
                <table className="tbl"><tbody>
                  {r.steps.map((s) => <tr key={s.label}><td className="w-[150px] font-medium">{s.label}</td><td className="num text-right">{yen(s.value)}</td><td className="text-[11.5px] text-ink-3">{s.note}</td></tr>)}
                  <tr><td className="font-bold">総コスト</td><td className="num text-right font-bold">{yen(r.totalCost)}</td><td className="text-[11.5px] text-ink-3">1単位あたり {yen(r.unitCost)}</td></tr>
                </tbody></table>
                <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-2"><b>式：</b>販売価格 ＝ （原価＋国内費＋通関＋運賃）÷（1 − 目標粗利率 − 保険・手数料・為替の率）。比率のコストは販売価格に対する割合なので、価格の中に組み込んで解いています。</p>
              </section>
              <section className="card space-y-2 p-4 text-[12.5px]">
                <h2 className="card-t">判断の目安</h2>
                <p className="flex gap-2"><Info size={14} className="mt-0.5 shrink-0 text-ink-3" /><span><b>損益分岐の単価：</b>{cur === "JPY" ? yen(r.breakEvenUnitFx * 1) : money(r.breakEvenUnitFx, cur)}／{prod?.unit ?? "単位"}（これ以下で売ると赤字）</span></p>
                {cur !== "JPY" && <p className="flex gap-2"><Info size={14} className="mt-0.5 shrink-0 text-ink-3" /><span><b>為替の影響：</b>円が1円高くなると、手取りが約 {yen(r.fxSensitivityJPY)} 減ります（為替予約で固定できます）。</span></p>}
              </section>
              <section className="card space-y-2 p-4">
                <h2 className="card-t">案件に反映</h2>
                <div className="flex gap-2"><select className="select" value={dealId} onChange={(e) => { setDealId(e.target.value); setAdded(""); }}><option value="">案件を選択…</option>{openDeals.map((x) => <option key={x.id} value={x.id}>{x.name}（{x.currency}）</option>)}</select><button className="btn btn-primary" disabled={!dealId} onClick={addToDeal}><Plus size={14} />明細に追加</button></div>
                {added && <p className="text-[12px] text-good">{added}</p>}
                <p className="text-[11.5px] text-ink-3">明細に追加すると、案件金額 → 受注時の売上 → 仕訳の順に同じ金額が引き継がれます。</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
