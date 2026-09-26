"use client";

import { countryOf, docTypeLabel } from "@/lib/constants";
import { DOC_FIELDS, docParties, hasPrices } from "@/lib/documents";
import { fmtDate, money } from "@/lib/format";
import { useStore } from "@/lib/store/store";
import type { DocType, Incoterm, LineItem } from "@/lib/types";

export interface PrintableDoc {
  type: DocType;
  code: string;
  title: string;
  deal_id: string | null;
  issue_date: string;
  currency: string;
  incoterm: Incoterm;
  items: LineItem[];
  fields: Record<string, string>;
  notes?: string;
}

/** A4 印刷用レイアウト。ブラウザの「PDFに保存」で PDF 出力する */
export function DocPrint({ doc }: { doc: PrintableDoc }) {
  const { db, settings } = useStore();
  const { buyer, producer } = docParties(db, doc.deal_id);
  const domestic = doc.type === "purchase_order" || doc.type === "sample_request";
  const priced = hasPrices(doc.type);
  const isPacking = doc.type === "packing_list" || doc.type === "shipping_instruction";
  const total = doc.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const cartons = doc.items.reduce((s, i) => s + (i.case_qty ? Math.ceil(i.quantity / i.case_qty) : 0), 0);
  const weight = doc.items.reduce((s, i) => s + (i.weight_kg ?? 0) * i.quantity, 0);
  const labels = Object.fromEntries((DOC_FIELDS[doc.type] ?? []).map((f) => [f.key, f.label]));
  const heading = doc.type === "quotation" ? "QUOTATION" : domestic ? (doc.type === "purchase_order" ? "発 注 書" : "サンプル依頼書") : docTypeLabel(doc.type).toUpperCase();

  return (
    <div className="print-area mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-[11.5px] leading-relaxed text-black shadow-lg ring-1 ring-black/5">
      <div className="flex items-start justify-between border-b-2 border-[#1f3a5f] pb-3">
        <div>
          <div className="text-[16px] font-bold tracking-wide text-[#1f3a5f]">{domestic ? settings.company_name : settings.company_name_en}</div>
          <div className="whitespace-pre-line text-[10.5px] text-neutral-600">
            {settings.address_en}
            {settings.phone ? `\nTel: ${settings.phone}` : ""}
            {settings.email ? `\n${settings.email}` : ""}
            {settings.website ? `  ${settings.website.replace(/^https?:\/\//, "")}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold tracking-[0.12em]">{heading}</div>
          <div className="mt-1 text-[10.5px]">
            No. {doc.code}
            <br />
            Date: {fmtDate(doc.issue_date)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{domestic ? "宛先" : doc.type === "spec_sheet" || doc.type === "origin_info" ? "Product" : "To (Buyer / Consignee)"}</div>
          {domestic ? (
            <div className="mt-1 font-semibold">{producer ? `${producer.company_name} 御中` : doc.fields.to}</div>
          ) : doc.type === "spec_sheet" || doc.type === "origin_info" ? (
            <div className="mt-1 font-semibold">{doc.items[0]?.description}</div>
          ) : (
            <div className="mt-1">
              <div className="font-semibold">{buyer?.company_name ?? "—"}</div>
              <div>{buyer?.contact_name && `Attn: ${buyer.contact_name}${buyer.position ? `, ${buyer.position}` : ""}`}</div>
              <div>
                {buyer?.city}
                {buyer?.city ? ", " : ""}
                {countryOf(buyer?.country)?.name_en}
              </div>
              <div>{buyer?.email}</div>
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Terms</div>
          <table className="mt-1 w-full">
            <tbody>
              {!domestic && doc.type !== "spec_sheet" && doc.type !== "origin_info" && (
                <tr>
                  <td className="pr-2 text-neutral-500">Incoterms</td>
                  <td>
                    {doc.incoterm} {doc.fields.port_of_discharge || doc.fields.Destination || ""}
                  </td>
                </tr>
              )}
              {priced && (
                <tr>
                  <td className="pr-2 text-neutral-500">Currency</td>
                  <td>{doc.currency}</td>
                </tr>
              )}
              {Object.entries(doc.fields)
                .filter(([k, v]) => v && !["port_of_discharge", "marks", "bank", "Destination", "description", "ingredients"].includes(k) && (doc.type !== "spec_sheet" || true))
                .slice(0, doc.type === "spec_sheet" ? 0 : 8)
                .map(([k, v]) => (
                  <tr key={k}>
                    <td className="whitespace-nowrap pr-2 align-top text-neutral-500">{labels[k] ?? k}</td>
                    <td className="whitespace-pre-line">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {doc.type === "spec_sheet" || doc.type === "origin_info" ? (
        <table className="mt-5 w-full border-collapse">
          <tbody>
            {DOC_FIELDS[doc.type].map((f) => (
              <tr key={f.key} className="border-b border-neutral-300">
                <th className="w-44 bg-neutral-50 px-2 py-1.5 text-left align-top font-medium">{f.label}</th>
                <td className="whitespace-pre-line px-2 py-1.5">{doc.fields[f.key] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="bg-[#1f3a5f] text-white">
              <th className="px-2 py-1.5 text-left font-medium">#</th>
              <th className="px-2 py-1.5 text-left font-medium">{domestic ? "品名" : "Description"}</th>
              {!domestic && <th className="px-2 py-1.5 text-left font-medium">HS Code</th>}
              <th className="px-2 py-1.5 text-right font-medium">{domestic ? "数量" : "Qty"}</th>
              {isPacking ? (
                <>
                  <th className="px-2 py-1.5 text-right font-medium">Cartons</th>
                  <th className="px-2 py-1.5 text-right font-medium">N.W. (kg)</th>
                </>
              ) : priced ? (
                <>
                  <th className="px-2 py-1.5 text-right font-medium">{domestic ? "単価" : "Unit Price"}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{domestic ? "金額" : "Amount"}</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i} className="border-b border-neutral-300">
                <td className="px-2 py-1.5">{i + 1}</td>
                <td className="px-2 py-1.5">{it.description}</td>
                {!domestic && <td className="px-2 py-1.5">{it.hs_code}</td>}
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {it.quantity.toLocaleString()} {it.unit}
                </td>
                {isPacking ? (
                  <>
                    <td className="px-2 py-1.5 text-right tabular-nums">{it.case_qty ? Math.ceil(it.quantity / it.case_qty) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{it.weight_kg ? (it.weight_kg * it.quantity).toFixed(1) : "—"}</td>
                  </>
                ) : priced ? (
                  <>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(it.unit_price, doc.currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(it.unit_price * it.quantity, doc.currency)}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {isPacking ? (
              <tr className="font-semibold">
                <td colSpan={domestic ? 2 : 3} className="px-2 py-1.5 text-right">
                  TOTAL
                </td>
                <td className="px-2 py-1.5 text-right">{doc.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right">{cartons || "—"}</td>
                <td className="px-2 py-1.5 text-right">{weight ? weight.toFixed(1) : "—"}</td>
              </tr>
            ) : priced ? (
              <tr className="font-semibold">
                <td colSpan={domestic ? 4 : 5} className="px-2 py-1.5 text-right">
                  {domestic ? "合計" : `TOTAL ${doc.incoterm}`}
                </td>
                <td className="px-2 py-1.5 text-right text-[13px]">{money(total, doc.currency)}</td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      )}

      {(doc.fields.marks || doc.fields.bank) && (
        <div className="mt-5 grid grid-cols-2 gap-6">
          {doc.fields.marks && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Shipping Marks</div>
              <div className="mt-1 whitespace-pre-line">{doc.fields.marks}</div>
            </div>
          )}
          {doc.fields.bank && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Bank Information</div>
              <div className="mt-1 whitespace-pre-line">{doc.fields.bank}</div>
            </div>
          )}
        </div>
      )}

      {doc.notes && (
        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Remarks</div>
          <div className="mt-1 whitespace-pre-line">{doc.notes}</div>
        </div>
      )}

      <div className="mt-12 grid grid-cols-2 gap-10">
        {doc.type === "contract" || doc.type === "sales_confirmation" ? (
          <>
            <Sign label="The Seller" name={settings.company_name_en} />
            <Sign label="The Buyer" name={buyer?.company_name ?? ""} />
          </>
        ) : (
          <>
            <div />
            <Sign label={domestic ? "発行者" : "Authorized Signature"} name={domestic ? settings.company_name : settings.company_name_en} />
          </>
        )}
      </div>
    </div>
  );
}

function Sign({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <div className="h-10 border-b border-black" />
      <div className="mt-1 text-[10.5px] text-neutral-600">{label}</div>
      <div className="text-[11px] font-medium">{name}</div>
    </div>
  );
}
