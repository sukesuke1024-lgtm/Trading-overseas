import type { CostInputs, Incoterm } from "./types";

// 各 Incoterm で「売り手(AITREK)が負担して価格に含める」費用の範囲。
// 含まれない費用は Buyer 負担として表示だけ行い、売価には入れない。
const ORDER: Incoterm[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const from = (term: Incoterm) => (t: Incoterm) => ORDER.indexOf(t) >= ORDER.indexOf(term);

export type CostKey =
  | "product"
  | "packing"
  | "inspection"
  | "domestic_transport"
  | "warehouse"
  | "customs_export"
  | "international_freight"
  | "insurance"
  | "duty"
  | "local_cost"
  | "other_cost";

export const COST_LINES: { key: CostKey; label: string; included: (t: Incoterm) => boolean }[] = [
  { key: "product", label: "商品原価", included: () => true },
  { key: "packing", label: "梱包費", included: () => true },
  { key: "inspection", label: "検査費", included: () => true },
  { key: "domestic_transport", label: "国内輸送", included: from("FCA") },
  { key: "warehouse", label: "倉庫費", included: from("FCA") },
  { key: "customs_export", label: "通関費（輸出）", included: from("FCA") },
  { key: "international_freight", label: "国際輸送", included: from("CFR") },
  { key: "insurance", label: "保険", included: from("CIF") },
  { key: "duty", label: "関税（輸入）", included: from("DDP") },
  { key: "local_cost", label: "現地費用", included: from("DAP") },
  { key: "other_cost", label: "その他経費", included: () => true },
];

export interface CostLine {
  key: CostKey;
  label: string;
  amount: number; // JPY
  included: boolean;
}

export interface CostResult {
  lines: CostLine[];
  cost: number; // 価格に含む原価合計 (JPY)
  buyerBorne: number; // Buyer 負担額 (JPY, 参考)
  fee: number; // AITREK 手数料 (JPY)
  revenue: number; // = Buyer Selling Price 合計 (JPY)
  profit: number; // 粗利益 (JPY)
  margin: number; // 粗利率 (0-1)
  unitPrice: number; // 1 個あたり売価 (JPY)
  unitProfit: number; // 1 個あたり利益 (JPY)
  revenueFx: number; // 売上 (取引通貨)
  unitPriceFx: number; // 1 個あたり売価 (取引通貨)
  producerPayment: number; // 生産者への支払 (JPY)
  logisticsPayment: number; // 物流関連の支払 (JPY)
}

const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

export function calcCost(input: CostInputs): CostResult {
  const qty = Math.max(0, n(input.quantity));
  const product = n(input.unit_cost) * qty;
  const freight = n(input.international_freight);
  const insurance = ((product + freight) * 1.1 * n(input.insurance_rate)) / 100;
  const cifValue = product + freight + insurance;
  const duty = (cifValue * n(input.duty_rate)) / 100;

  const amounts: Record<CostKey, number> = {
    product,
    packing: n(input.packing),
    inspection: n(input.inspection),
    domestic_transport: n(input.domestic_transport),
    warehouse: n(input.warehouse),
    customs_export: n(input.customs_export),
    international_freight: freight,
    insurance,
    duty,
    local_cost: n(input.local_cost),
    other_cost: n(input.other_cost),
  };

  const lines = COST_LINES.map((l) => ({
    key: l.key,
    label: l.label,
    amount: amounts[l.key],
    included: l.included(input.incoterm),
  }));

  const cost = lines.filter((l) => l.included).reduce((s, l) => s + l.amount, 0);
  const buyerBorne = lines.filter((l) => !l.included).reduce((s, l) => s + l.amount, 0);
  const fee = input.fee_mode === "fixed" ? n(input.fee_value) : (cost * n(input.fee_value)) / 100;
  const revenue = cost + fee;
  const profit = revenue - cost;
  const fx = n(input.fx_rate) || 1;
  const logisticsPayment = lines
    .filter((l) => l.included && l.key !== "product" && l.key !== "other_cost")
    .reduce((s, l) => s + l.amount, 0);

  return {
    lines,
    cost,
    buyerBorne,
    fee,
    revenue,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    unitPrice: qty > 0 ? revenue / qty : 0,
    unitProfit: qty > 0 ? profit / qty : 0,
    revenueFx: revenue / fx,
    unitPriceFx: qty > 0 ? revenue / qty / fx : 0,
    producerPayment: product,
    logisticsPayment,
  };
}

export function defaultCost(partial: Partial<CostInputs> = {}): CostInputs {
  return {
    incoterm: "FOB",
    currency: "USD",
    fx_rate: 150,
    quantity: 0,
    unit_cost: 0,
    domestic_transport: 0,
    packing: 0,
    inspection: 0,
    warehouse: 0,
    customs_export: 0,
    international_freight: 0,
    insurance_rate: 0.3,
    duty_rate: 0,
    local_cost: 0,
    other_cost: 0,
    fee_mode: "percent",
    fee_value: 15,
    ...partial,
  };
}
