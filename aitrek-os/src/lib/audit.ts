// 訂正履歴の表示用ラベル
import { BUYER_FIELDS, PRODUCER_FIELDS, PRODUCT_FIELDS } from "./schemas";
import type { TableName } from "./types";

export const TABLE_LABELS: Record<TableName, string> = {
  producers: "Producer",
  buyers: "Buyer",
  products: "Product",
  deals: "Deal",
  activities: "Activity",
  tasks: "Task",
  quotations: "Quotation",
  documents: "Document",
  finance: "Finance",
  members: "User",
  audit_log: "訂正履歴",
};

export const ACTION_LABELS = { insert: "作成", update: "訂正", delete: "削除", restore: "復元" } as const;

const GENERIC: Record<string, string> = {
  title: "件名",
  stage: "Status",
  probability: "確度",
  next_action: "Next Action",
  deadline: "Deadline",
  owner_id: "担当",
  buyer_id: "Buyer",
  producer_id: "Producer",
  product_id: "Product",
  deal_id: "Deal",
  quantity: "数量",
  unit: "単位",
  currency: "通貨",
  incoterm: "Incoterms",
  payment_terms: "Payment Terms",
  expected_revenue: "見込売上",
  expected_profit: "見込粗利",
  cost: "原価計算",
  price_approved: "価格承認",
  contract_approved: "契約承認",
  notes: "メモ",
  status: "Status",
  due_date: "期限",
  assignee_id: "担当者",
  note: "Note",
  attachments: "添付",
  group_name: "区分",
  issue_date: "発行日",
  valid_until: "有効期限",
  port: "仕向地",
  lead_time: "Lead Time",
  items: "明細",
  fields: "書類項目",
  invoice_no: "Invoice No.",
  exchange_rate: "為替",
  revenue: "売上",
  invoice_amount: "請求金額",
  invoice_date: "請求日",
  payment_due: "Payment Due",
  paid_date: "入金日",
  paid_amount: "入金額",
  producer_payment: "Producer支払",
  logistics_payment: "Logistics支払",
  role: "Role",
  active: "有効",
  email: "Email",
  file_url: "ファイル",
};

const FROM_SCHEMAS = Object.fromEntries([...PRODUCER_FIELDS, ...BUYER_FIELDS, ...PRODUCT_FIELDS].map((f) => [f.key, f.label]));

export const fieldLabel = (key: string) => FROM_SCHEMAS[key] ?? GENERIC[key] ?? key;

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "（空）";
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  if (typeof v === "number") return v.toLocaleString("ja-JP");
  if (Array.isArray(v)) {
    if (v.length === 0) return "（空）";
    if (typeof v[0] === "object") return `${v.length}件`;
    return v.join("、");
  }
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  }
  const s = String(v);
  return s.startsWith("data:") ? "（ファイル）" : s.length > 200 ? s.slice(0, 200) + "…" : s;
}
