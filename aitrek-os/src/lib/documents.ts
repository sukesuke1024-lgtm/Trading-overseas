// Document Generator（仕様書 ⑧）：登録済みデータから貿易書類の初期値を組み立てる
import { countryOf, docTypeLabel, DOC_TYPES } from "./constants";
import { calcCost } from "./cost";
import { addDays, today } from "./format";
import type { Tx } from "./store/tx";
import { nextCode } from "./store/tx";
import { log } from "./automation";
import type { CompanySettings, Database, Deal, DocType, LineItem, Product, Quotation, TradeDocument } from "./types";

export const DOC_FIELDS: Record<DocType, { key: string; label: string }[]> = {
  quotation: [],
  proforma_invoice: [
    { key: "invoice_no", label: "Invoice No." },
    { key: "port_of_loading", label: "Port of Loading" },
    { key: "port_of_discharge", label: "Port of Discharge" },
    { key: "shipment", label: "Time of Shipment" },
    { key: "payment_terms", label: "Payment Terms" },
    { key: "bank", label: "Bank Information" },
    { key: "origin", label: "Country of Origin" },
  ],
  commercial_invoice: [
    { key: "invoice_no", label: "Invoice No." },
    { key: "port_of_loading", label: "Port of Loading" },
    { key: "port_of_discharge", label: "Port of Discharge" },
    { key: "vessel", label: "Vessel / Flight" },
    { key: "etd", label: "ETD" },
    { key: "payment_terms", label: "Payment Terms" },
    { key: "origin", label: "Country of Origin" },
    { key: "marks", label: "Shipping Marks" },
  ],
  packing_list: [
    { key: "invoice_no", label: "Invoice No." },
    { key: "port_of_loading", label: "Port of Loading" },
    { key: "port_of_discharge", label: "Port of Discharge" },
    { key: "vessel", label: "Vessel / Flight" },
    { key: "marks", label: "Shipping Marks" },
    { key: "storage", label: "Storage Condition" },
  ],
  purchase_order: [
    { key: "po_no", label: "PO No." },
    { key: "delivery_date", label: "納品日" },
    { key: "delivery_place", label: "納品場所" },
    { key: "payment", label: "支払条件" },
  ],
  sales_confirmation: [
    { key: "sc_no", label: "S/C No." },
    { key: "shipment", label: "Time of Shipment" },
    { key: "payment_terms", label: "Payment Terms" },
    { key: "packing", label: "Packing" },
    { key: "inspection", label: "Inspection" },
  ],
  shipping_instruction: [
    { key: "shipper", label: "Shipper" },
    { key: "consignee", label: "Consignee" },
    { key: "notify", label: "Notify Party" },
    { key: "port_of_loading", label: "Port of Loading" },
    { key: "port_of_discharge", label: "Port of Discharge" },
    { key: "container", label: "Container / Temperature" },
    { key: "etd", label: "ETD" },
    { key: "documents_required", label: "Documents Required" },
  ],
  spec_sheet: [
    { key: "ingredients", label: "Ingredients" },
    { key: "net_content", label: "Net Content" },
    { key: "shelf_life", label: "Shelf Life" },
    { key: "storage", label: "Storage" },
    { key: "hs_code", label: "HS Code" },
    { key: "jan", label: "JAN" },
    { key: "case", label: "Case Configuration" },
    { key: "certifications", label: "Certifications" },
    { key: "allergens", label: "Allergens" },
    { key: "description", label: "Description" },
  ],
  origin_info: [
    { key: "producer", label: "Producer" },
    { key: "address", label: "Production Site" },
    { key: "origin", label: "Country / Region of Origin" },
    { key: "raw_materials", label: "Origin of Raw Materials" },
    { key: "certifications", label: "Certifications" },
  ],
  sample_request: [
    { key: "to", label: "宛先（生産者）" },
    { key: "purpose", label: "目的" },
    { key: "ship_to", label: "送付先" },
    { key: "deadline", label: "希望発送日" },
  ],
  contract: [
    { key: "contract_no", label: "Contract No." },
    { key: "term", label: "Term" },
    { key: "shipment", label: "Shipment" },
    { key: "payment_terms", label: "Payment Terms" },
    { key: "claims", label: "Claims" },
    { key: "governing_law", label: "Governing Law" },
    { key: "signed_date", label: "締結日（承認後に記入）" },
  ],
};

export const hasPrices = (t: DocType) => ["quotation", "proforma_invoice", "commercial_invoice", "purchase_order", "sales_confirmation", "contract"].includes(t);

const withContent = (name: string, content: string) => (content && !name.includes(content) ? `${name} (${content})` : name);

export function dealItems(deal: Deal, product: Product | undefined, jpy = false): LineItem[] {
  const r = calcCost(deal.cost);
  return [
    {
      product_id: product?.id ?? null,
      description: product ? withContent(product.name_en || product.name, product.net_content) : deal.title,
      hs_code: product?.hs_code ?? "",
      quantity: deal.quantity,
      unit: deal.unit || "pcs",
      unit_price: jpy ? deal.cost.unit_cost : Math.round(r.unitPriceFx * 100) / 100,
      case_qty: product?.case_qty ?? null,
      weight_kg: product?.weight_kg ?? null,
    },
  ];
}

export function createQuotation(tx: Tx, deal: Deal) {
  const product = tx.find("products", deal.product_id);
  const buyer = tx.find("buyers", deal.buyer_id);
  const q = tx.insert("quotations", {
    code: nextCode(tx.all("quotations"), "QT-"),
    deal_id: deal.id,
    buyer_id: deal.buyer_id,
    issue_date: today(),
    valid_until: addDays(today(), 30),
    currency: deal.currency,
    incoterm: deal.incoterm,
    port: buyer ? `${buyer.city || ""}${buyer.city ? ", " : ""}${countryOf(buyer.country)?.name_en ?? ""}` : "",
    payment_terms: deal.payment_terms,
    lead_time: "3-4 weeks after order confirmation",
    items: dealItems(deal, product),
    notes: "Prices are subject to final confirmation of shipping schedule and exchange rate.",
    status: "draft",
  });
  // Quotation作成 → Deal履歴保存
  log(tx, "quotation", `Quotation ${q.code} を作成（${q.currency} ${q.items.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString()}）`, { deal_id: deal.id });
  const cl = tx.all("tasks").find((t) => t.deal_id === deal.id && t.auto_key === "cl:quotation");
  if (cl && cl.status !== "done") tx.update("tasks", cl.id, { status: "done" });
  return q;
}

export function createDocument(tx: Tx, type: DocType, opts: { deal?: Deal; product?: Product }, settings: CompanySettings): TradeDocument {
  const deal = opts.deal;
  const product = opts.product ?? tx.find("products", deal?.product_id);
  const buyer = tx.find("buyers", deal?.buyer_id);
  const producer = tx.find("producers", product?.producer_id ?? deal?.producer_id);
  const invoiceNo = tx.all("finance").find((f) => f.deal_id === deal?.id)?.invoice_no ?? "";
  const dest = buyer ? `${buyer.city ? buyer.city + ", " : ""}${countryOf(buyer.country)?.name_en ?? ""}` : "";
  const f: Record<string, string> = {};
  const set = (k: string, v: string) => (f[k] = v);
  const short = DOC_TYPES.find((d) => d.key === type)?.short ?? "DOC";

  set("invoice_no", invoiceNo);
  set("port_of_loading", "Tomakomai / Tokyo, Japan");
  set("port_of_discharge", dest);
  set("payment_terms", deal?.payment_terms ?? "");
  set("origin", "Japan (Hokkaido)");
  set("bank", settings.bank_info);
  set("marks", buyer ? `${buyer.company_name}\n${dest}\nC/No. 1-` : "");
  set("storage", product?.storage ?? "");
  set("shipment", "Within 30 days after receipt of payment");
  set("po_no", nextCode(tx.all("documents").filter((d) => d.type === "purchase_order"), "PO-"));
  set("delivery_date", addDays(today(), 14));
  set("delivery_place", "指定倉庫（別途連絡）");
  set("payment", "月末締め翌月末払い");
  set("sc_no", nextCode(tx.all("documents").filter((d) => d.type === "sales_confirmation"), "SC-"));
  set("packing", product?.case_qty ? `${product.case_qty} units per carton` : "Export standard packing");
  set("inspection", "Seller's inspection at origin to be final");
  set("shipper", `${settings.company_name_en}\n${settings.address_en}`);
  set("consignee", buyer ? `${buyer.company_name}\n${dest}` : "");
  set("notify", "Same as consignee");
  set("container", product?.storage === "冷凍" ? "Reefer -18°C" : product?.storage === "冷蔵" ? "Reefer +5°C" : "Dry");
  set("documents_required", "Commercial Invoice, Packing List, B/L, Certificate of Origin");
  set("ingredients", product?.ingredients ?? "");
  set("net_content", product?.net_content ?? "");
  set("shelf_life", product?.shelf_life ?? "");
  set("hs_code", product?.hs_code ?? "");
  set("jan", product?.jan ?? "");
  set("case", product?.case_qty ? `${product.case_qty} units / case${product.weight_kg ? `, ${product.weight_kg} kg / unit` : ""}` : "");
  set("certifications", product?.certifications.join(", ") ?? producer?.certifications.join(", ") ?? "");
  set("allergens", "");
  set("description", product?.description_en ?? "");
  set("producer", producer ? `${producer.company_name}${producer.brand_name ? ` (${producer.brand_name})` : ""}` : "");
  set("address", producer?.address ?? "");
  set("raw_materials", "Japan");
  set("to", producer ? `${producer.company_name} ${producer.contact_name}様` : "");
  set("purpose", buyer ? `${buyer.company_name}（${countryOf(buyer.country)?.name ?? ""}）への商品評価用サンプル` : "海外バイヤー向け評価用サンプル");
  set("ship_to", "AITREK 事務所");
  set("deadline", addDays(today(), 7));
  set("contract_no", nextCode(tx.all("documents").filter((d) => d.type === "contract"), "CT-"));
  set("term", "One (1) year from the date of signing");
  set("claims", "Any claim shall be made within 14 days after arrival of goods");
  set("governing_law", "Laws of Japan");
  set("signed_date", "");

  const fields = Object.fromEntries(DOC_FIELDS[type].map((x) => [x.key, f[x.key] ?? ""]));
  const items = deal ? dealItems(deal, product, type === "purchase_order" || type === "sample_request") : product ? [{ product_id: product.id, description: product.name_en || product.name, hs_code: product.hs_code, quantity: type === "sample_request" ? 3 : 1, unit: "pcs", unit_price: 0, case_qty: product.case_qty, weight_kg: product.weight_kg }] : [];
  if (type === "sample_request") items.forEach((i) => ((i.quantity = 3), (i.unit_price = 0)));

  const doc = tx.insert("documents", {
    code: nextCode(tx.all("documents"), `${short}-`),
    type,
    deal_id: deal?.id ?? null,
    title: `${docTypeLabel(type)}${deal ? ` — ${deal.title}` : product ? ` — ${product.name_en || product.name}` : ""}`,
    issue_date: today(),
    currency: type === "purchase_order" || type === "sample_request" ? "JPY" : deal?.currency ?? "USD",
    incoterm: deal?.incoterm ?? "FOB",
    items,
    fields,
    status: "draft",
    file_url: "",
  });
  if (deal) {
    log(tx, "document", `${docTypeLabel(type)} ${doc.code} を生成`, { deal_id: deal.id });
    const map: Partial<Record<DocType, string>> = { commercial_invoice: "cl:invoice", proforma_invoice: "cl:invoice", packing_list: "cl:packing_list" };
    const key = map[type];
    const cl = key && tx.all("tasks").find((t) => t.deal_id === deal.id && t.auto_key === key);
    if (cl && cl.status === "todo") tx.update("tasks", cl.id, { status: "in_progress" });
  }
  return doc;
}

export function quotationToDoc(q: Quotation): Pick<TradeDocument, "type" | "title" | "issue_date" | "currency" | "incoterm" | "items" | "fields" | "code" | "deal_id"> {
  return {
    type: "quotation",
    code: q.code,
    deal_id: q.deal_id,
    title: "Quotation",
    issue_date: q.issue_date,
    currency: q.currency,
    incoterm: q.incoterm,
    items: q.items,
    fields: { "Valid Until": q.valid_until, Destination: q.port, "Payment Terms": q.payment_terms, "Lead Time": q.lead_time },
  };
}

export function docParties(db: Database, dealId: string | null) {
  const deal = db.deals.find((d) => d.id === dealId);
  const buyer = db.buyers.find((b) => b.id === deal?.buyer_id);
  const producer = db.producers.find((p) => p.id === deal?.producer_id);
  return { deal, buyer, producer };
}
