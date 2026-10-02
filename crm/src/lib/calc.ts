// 営業初心者向けの見積・粗利の自動計算（純関数）。
//  販売価格（円）＝ 総コスト ÷ (1 − 目標粗利率)   ※粗利率＝粗利 ÷ 売上
//  Incoterms ごとに「どこまで売り手が負担するか」で、価格に含めるコストが変わる。

export type Incoterm = "EXW" | "FOB" | "CFR" | "CIF" | "DAP" | "DDP";
export const INCOTERM_INFO: Record<Incoterm, { label: string; desc: string; includes: ("domestic" | "export" | "freight" | "insurance" | "import")[] }> = {
  EXW: { label: "EXW（工場渡し）", desc: "買い手が引き取る。売り手は原価と国内の梱包まで", includes: [] },
  FOB: { label: "FOB（本船渡し）", desc: "日本の港で船に積むまで売り手が負担（国内費・輸出通関）", includes: ["domestic", "export"] },
  CFR: { label: "CFR（運賃込み）", desc: "FOB ＋ 海上／航空運賃まで売り手が負担", includes: ["domestic", "export", "freight"] },
  CIF: { label: "CIF（運賃・保険料込み）", desc: "CFR ＋ 貨物保険（CIF 価格の110%）まで売り手が負担", includes: ["domestic", "export", "freight", "insurance"] },
  DAP: { label: "DAP（仕向地持込渡し）", desc: "輸入国の指定場所まで売り手が負担（輸入通関・関税は買い手）", includes: ["domestic", "export", "freight", "insurance"] },
  DDP: { label: "DDP（関税込み持込渡し）", desc: "関税・輸入通関まで売り手が負担。リスクが大きいので慎重に", includes: ["domestic", "export", "freight", "insurance", "import"] },
};

export interface QuoteInput {
  incoterm: Incoterm; qty: number;
  unitCostJPY: number;          // 仕入原価（円／単位）
  domesticJPY: number;          // 国内費（集荷・梱包・検査・倉庫）合計
  exportJPY: number;            // 輸出通関・書類費 合計
  freightJPY: number;           // 国際運賃 合計
  insuranceRate: number;        // 貨物保険料率（CIF 価格に対する %。例 0.3）
  importJPY: number;            // 輸入通関・関税・輸入側の費用 合計（DDP のとき）
  payFeeRate: number;           // 決済手数料率（L/C 開設・買取手数料、送金手数料など。%）
  insuranceTradeRate: number;   // 貿易保険（NEXI 等）料率（%）
  fxCostRate: number;           // 為替予約コスト（%。為替予約のプレミアム・ディスカウント）
  marginRate: number;           // 目標粗利率（%）
  rate: number;                 // 円／外貨（TTB 等、実際に円に替える想定レート）
  fixedPriceJPY?: number;       // 販売単価が決まっている場合（外貨で指値された等）：円換算の販売単価
}
export interface QuoteResult {
  costGoods: number; costDomestic: number; costExport: number; costFreight: number; costInsurance: number; costImport: number; costFees: number;
  totalCost: number; unitCost: number;
  priceTotalJPY: number; priceUnitJPY: number; priceUnitFx: number; priceTotalFx: number;
  profitJPY: number; marginRate: number; breakEvenUnitFx: number; fxSensitivityJPY: number; incoterm: Incoterm; steps: { label: string; value: number; note: string }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function quote(i: QuoteInput): QuoteResult {
  const inc = INCOTERM_INFO[i.incoterm].includes;
  const q = Math.max(i.qty, 0.0001);
  const costGoods = i.unitCostJPY * q;
  const costDomestic = inc.includes("domestic") ? i.domesticJPY : 0;
  const costExport = inc.includes("export") ? i.exportJPY : 0;
  const costFreight = inc.includes("freight") ? i.freightJPY : 0;
  const costImport = inc.includes("import") ? i.importJPY : 0;
  const base = costGoods + costDomestic + costExport + costFreight + costImport;
  // 保険・決済手数料・貿易保険・為替コストは「販売価格に対する割合」。粗利率も売上に対する割合なので、
  //   P = base + P×r + P×m  →  P = base ÷ (1 − m − r)   （P：販売価格、r：割合コストの合計、m：目標粗利率）
  const insRate = inc.includes("insurance") ? (i.insuranceRate / 100) * 1.1 : 0;
  const ratio = insRate + i.payFeeRate / 100 + i.insuranceTradeRate / 100 + i.fxCostRate / 100;
  const m = i.marginRate / 100;
  const denom = 1 - m - ratio;
  const priceTotalJPY = i.fixedPriceJPY !== undefined ? i.fixedPriceJPY * q : denom > 0.01 ? base / denom : Infinity;
  const costInsurance = priceTotalJPY * insRate;
  const costFees = priceTotalJPY * (i.payFeeRate / 100 + i.insuranceTradeRate / 100 + i.fxCostRate / 100);
  const totalCost = base + costInsurance + costFees;
  const profitJPY = priceTotalJPY - totalCost;
  const margin = priceTotalJPY > 0 ? (profitJPY / priceTotalJPY) * 100 : 0;
  const be = (base / Math.max(1 - ratio, 0.01)) / q / i.rate; // 粗利0円となる最低単価（外貨）
  const priceUnitFx = priceTotalJPY / q / i.rate;
  // 為替感応度：レートが1円円高（外貨安）になったとき、売上（円）が何円減るか
  const fxSensitivityJPY = (priceTotalJPY / i.rate) * 1;
  const steps = [
    { label: "① 仕入原価", value: costGoods, note: `単価 ${i.unitCostJPY.toLocaleString()}円 × 数量 ${i.qty}` },
    { label: "② 国内費", value: costDomestic, note: inc.includes("domestic") ? "集荷・梱包・検査など" : `${i.incoterm} では売り手の負担に含めません` },
    { label: "③ 輸出通関・書類", value: costExport, note: inc.includes("export") ? "輸出通関・原産地証明など" : `${i.incoterm} では含めません` },
    { label: "④ 国際運賃", value: costFreight, note: inc.includes("freight") ? "海上／航空運賃" : `${i.incoterm} では買い手負担` },
    { label: "⑤ 貨物保険", value: costInsurance, note: inc.includes("insurance") ? `保険料率 ${i.insuranceRate}% × 110%（CIF価格の110%に付保）` : `${i.incoterm} では含めません` },
    { label: "⑥ 輸入通関・関税", value: costImport, note: inc.includes("import") ? "DDP のときだけ売り手負担" : "買い手負担" },
    { label: "⑦ 決済・貿易保険・為替コスト", value: costFees, note: `販売価格の ${r2(ratio * 100 - insRate * 100)}%` },
  ];
  return {
    costGoods, costDomestic, costExport, costFreight, costInsurance, costImport, costFees, totalCost, unitCost: totalCost / q,
    priceTotalJPY, priceUnitJPY: priceTotalJPY / q, priceUnitFx: r2(priceUnitFx), priceTotalFx: r2(priceTotalJPY / i.rate),
    profitJPY, marginRate: r2(margin), breakEvenUnitFx: r2(be), fxSensitivityJPY: Math.round(fxSensitivityJPY), incoterm: i.incoterm, steps,
  };
}

/** 判定の目安（初心者向けの色分け） */
export function marginLevel(m: number, minMargin = 15): "good" | "warn" | "bad" {
  return m >= minMargin + 5 ? "good" : m >= minMargin ? "warn" : "bad";
}
