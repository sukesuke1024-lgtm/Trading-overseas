"use client";

import { CURRENCIES, INCOTERMS } from "@/lib/constants";
import { calcCost, type CostKey } from "@/lib/cost";
import { money, pct, yen } from "@/lib/format";
import { useStore } from "@/lib/store/store";
import type { CostInputs, Incoterm } from "@/lib/types";
import { Badge, Field, Input, Select, cx } from "./ui";

const INPUT_KEYS: { key: keyof CostInputs; line: CostKey; label: string; unit?: string }[] = [
  { key: "packing", line: "packing", label: "梱包費" },
  { key: "inspection", line: "inspection", label: "検査費" },
  { key: "domestic_transport", line: "domestic_transport", label: "国内輸送" },
  { key: "warehouse", line: "warehouse", label: "倉庫費" },
  { key: "customs_export", line: "customs_export", label: "通関費" },
  { key: "international_freight", line: "international_freight", label: "国際輸送" },
  { key: "insurance_rate", line: "insurance", label: "保険料率", unit: "%" },
  { key: "duty_rate", line: "duty", label: "関税率", unit: "%" },
  { key: "local_cost", line: "local_cost", label: "現地費用" },
  { key: "other_cost", line: "other_cost", label: "その他経費" },
];

/** 仕様書 ⑥ Export Cost Simulator */
export function CostSimulator({ value, onChange, readOnly = false }: { value: CostInputs; onChange: (v: CostInputs) => void; readOnly?: boolean }) {
  const { settings } = useStore();
  const r = calcCost(value);
  const set = <K extends keyof CostInputs>(k: K, v: CostInputs[K]) => onChange({ ...value, [k]: v });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const included = new Map(r.lines.map((l) => [l.key, l.included]));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(300px,380px)]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Incoterms">
            <Select value={value.incoterm} disabled={readOnly} onChange={(e) => set("incoterm", e.target.value as Incoterm)}>
              {INCOTERMS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="通貨">
            <Select
              value={value.currency}
              disabled={readOnly}
              onChange={(e) => onChange({ ...value, currency: e.target.value, fx_rate: settings.fx_rates[e.target.value] ?? value.fx_rate })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`為替（1 ${value.currency} =）`}>
            <div className="flex items-center gap-1">
              <Input type="number" step="any" disabled={readOnly} value={value.fx_rate} onChange={(e) => set("fx_rate", num(e.target.value))} />
              <span className="text-[12px] text-ink-3">円</span>
            </div>
          </Field>
          <Field label="数量">
            <Input type="number" min={0} disabled={readOnly} value={value.quantity} onChange={(e) => set("quantity", num(e.target.value))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="商品原価（1個・円）">
            <Input type="number" step="any" disabled={readOnly} value={value.unit_cost} onChange={(e) => set("unit_cost", num(e.target.value))} />
          </Field>
          {INPUT_KEYS.map((f) => {
            const inc = included.get(f.line);
            return (
              <Field
                key={f.key}
                label={`${f.label}${f.unit ? `（${f.unit}）` : "（円・案件合計）"}`}
                hint={inc ? undefined : `${value.incoterm} では Buyer 負担`}
              >
                <Input
                  type="number"
                  step="any"
                  disabled={readOnly}
                  value={value[f.key] as number}
                  onChange={(e) => set(f.key, num(e.target.value) as never)}
                  className={cx(!inc && "bg-surface-2 text-ink-3")}
                />
              </Field>
            );
          })}
          <Field label="AITREK手数料">
            <div className="flex gap-1">
              <Input type="number" step="any" disabled={readOnly} value={value.fee_value} onChange={(e) => set("fee_value", num(e.target.value))} />
              <Select value={value.fee_mode} disabled={readOnly} onChange={(e) => set("fee_mode", e.target.value as CostInputs["fee_mode"])} className="w-20">
                <option value="percent">%</option>
                <option value="fixed">円</option>
              </Select>
            </div>
          </Field>
        </div>
      </div>

      <CostBreakdown value={value} />
    </div>
  );
}

export function CostBreakdown({ value }: { value: CostInputs }) {
  const r = calcCost(value);
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-2">計算結果</span>
        <Badge tone="blue">{value.incoterm}</Badge>
      </div>
      <table className="tabular w-full text-[12.5px]">
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.key} className={cx(!l.included && "text-ink-3")}>
              <td className="py-0.5">
                {l.included ? "＋" : "　"} {l.label}
                {!l.included && <span className="ml-1 text-[10.5px]">(Buyer負担)</span>}
              </td>
              <td className={cx("py-0.5 text-right", !l.included && "line-through")}>{yen(l.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-0.5">＋ AITREK手数料{value.fee_mode === "percent" ? `（${value.fee_value}%）` : ""}</td>
            <td className="py-0.5 text-right">{yen(r.fee)}</td>
          </tr>
          <tr className="border-t border-line-strong font-semibold">
            <td className="pt-1.5">＝ Buyer Selling Price</td>
            <td className="pt-1.5 text-right">{yen(r.revenue)}</td>
          </tr>
          <tr className="text-ink-2">
            <td></td>
            <td className="text-right">{money(r.revenueFx, value.currency)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Metric label="売上" value={yen(r.revenue)} />
        <Metric label="原価" value={yen(r.cost)} />
        <Metric label="粗利益" value={yen(r.profit)} strong />
        <Metric label="粗利率" value={pct(r.margin)} strong />
        <Metric label="1個あたり売価" value={`${money(r.unitPriceFx, value.currency)}`} sub={yen(r.unitPrice)} />
        <Metric label="1個あたり利益" value={yen(r.unitProfit)} />
        <Metric label="案件総利益" value={yen(r.profit)} />
        <Metric label="Buyer負担（参考）" value={yen(r.buyerBorne)} />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={cx("tabular text-[13.5px]", strong && "font-semibold text-accent")}>{value}</div>
      {sub && <div className="tabular text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
