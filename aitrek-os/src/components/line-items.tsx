"use client";

import { Plus, X } from "lucide-react";
import { money } from "@/lib/format";
import type { LineItem } from "@/lib/types";
import { Button, Input } from "./ui";

/** 見積・書類の明細編集。priceLocked の場合は単価を変更できない（Price変更は Owner/Admin） */
export function LineItemsEditor({ items, onChange, currency, priced = true, priceLocked = false }: { items: LineItem[]; onChange: (v: LineItem[]) => void; currency: string; priced?: boolean; priceLocked?: boolean }) {
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead>
          <tr className="text-left text-[11.5px] text-ink-3">
            <th className="pb-1 font-medium">Description</th>
            <th className="pb-1 font-medium">HS Code</th>
            <th className="pb-1 text-right font-medium">Qty</th>
            <th className="pb-1 font-medium">Unit</th>
            {priced && <th className="pb-1 text-right font-medium">Unit Price ({currency})</th>}
            <th className="pb-1 text-right font-medium">Case</th>
            <th className="pb-1 text-right font-medium">kg/unit</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="py-1 pr-1.5">
                <Input value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
              </td>
              <td className="w-24 py-1 pr-1.5">
                <Input value={it.hs_code} onChange={(e) => set(i, { hs_code: e.target.value })} />
              </td>
              <td className="w-24 py-1 pr-1.5">
                <Input type="number" className="text-right" value={it.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
              </td>
              <td className="w-16 py-1 pr-1.5">
                <Input value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} />
              </td>
              {priced && (
                <td className="w-32 py-1 pr-1.5">
                  <Input
                    type="number"
                    step="any"
                    className="text-right"
                    value={it.unit_price}
                    disabled={priceLocked}
                    title={priceLocked ? "単価の変更は Owner / Admin のみ" : undefined}
                    onChange={(e) => set(i, { unit_price: Number(e.target.value) })}
                  />
                </td>
              )}
              <td className="w-20 py-1 pr-1.5">
                <Input type="number" className="text-right" value={it.case_qty ?? ""} onChange={(e) => set(i, { case_qty: e.target.value ? Number(e.target.value) : null })} />
              </td>
              <td className="w-20 py-1 pr-1.5">
                <Input type="number" step="any" className="text-right" value={it.weight_kg ?? ""} onChange={(e) => set(i, { weight_kg: e.target.value ? Number(e.target.value) : null })} />
              </td>
              <td className="w-8 py-1">
                <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-ink-3 hover:text-bad" aria-label="行削除">
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between">
        <Button
          size="sm"
          onClick={() => onChange([...items, { product_id: null, description: "", hs_code: "", quantity: 1, unit: "pcs", unit_price: 0, case_qty: null, weight_kg: null }])}
        >
          <Plus size={13} /> 行追加
        </Button>
        {priced && <span className="tabular text-[13px] font-semibold">合計 {money(total, currency)}</span>}
      </div>
    </div>
  );
}
