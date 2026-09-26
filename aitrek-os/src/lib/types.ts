// AITREK OS のドメインモデル。
// フィールド名は Supabase(PostgreSQL) のカラム名と一致させるため snake_case に統一している。

export type ID = string;

export type Role =
  | "owner"
  | "admin"
  | "sales"
  | "trade_ops"
  | "finance"
  | "marketing"
  | "viewer"
  | "ai_agent";

export type Currency = string; // ISO 4217 (JPY, USD, SGD, ...)

export type Incoterm = "EXW" | "FCA" | "FOB" | "CFR" | "CIF" | "DAP" | "DDP";

export type DealStage =
  | "lead"
  | "contacted"
  | "meeting"
  | "requirement"
  | "matching"
  | "quotation"
  | "sample"
  | "negotiation"
  | "contract"
  | "order"
  | "shipment"
  | "payment"
  | "repeat"
  | "lost";

interface Base {
  id: ID;
  created_at: string;
  updated_at: string;
}

export interface Producer extends Base {
  code: string;
  company_name: string;
  brand_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  prefecture: string;
  website: string;
  categories: string[];
  main_products: string;
  sku_count: number | null;
  wholesale_price: string;
  moq: string;
  capacity: string;
  inventory: string;
  shelf_life: string;
  storage_temp: string;
  export_experience: string;
  available_countries: string[];
  certifications: string[];
  image_url: string;
  docs_url: string;
  contract_status: string;
  commission_rate: number | null;
  last_contact_at: string;
  next_action: string;
  next_action_date: string;
  notes: string;
}

export interface Buyer extends Base {
  code: string;
  country: string; // ISO 3166-1 alpha-2
  city: string;
  company_name: string;
  business_type: string;
  website: string;
  contact_name: string;
  position: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  desired_products: string;
  price_range: string;
  desired_moq: string;
  incoterms: string;
  payment_terms: string;
  import_history: string;
  status: string;
  currency: Currency;
  last_contact_at: string;
  next_contact_at: string;
  notes: string;
}

export interface Product extends Base {
  code: string;
  producer_id: ID | null;
  name: string;
  name_en: string;
  category: string;
  sku: string;
  jan: string;
  hs_code: string;
  ingredients: string;
  net_content: string;
  cost_price: number | null;
  domestic_wholesale_price: number | null;
  export_price: number | null;
  moq: number | null;
  case_qty: number | null;
  weight_kg: number | null;
  size: string;
  shelf_life: string;
  storage: string;
  certifications: string[];
  export_restrictions: string;
  target_countries: string[];
  image_url: string;
  description_en: string;
  description_zh: string;
  description_ko: string;
  status: string;
}

export interface CostInputs {
  incoterm: Incoterm;
  currency: Currency;
  fx_rate: number; // 1 通貨あたりの JPY
  quantity: number;
  unit_cost: number; // 商品原価 (JPY/個)
  domestic_transport: number; // 以下すべて案件合計 (JPY)
  packing: number;
  inspection: number;
  warehouse: number;
  customs_export: number;
  international_freight: number;
  insurance_rate: number; // % of (商品+運賃)×110%
  duty_rate: number; // % of CIF
  local_cost: number;
  other_cost: number;
  fee_mode: "percent" | "fixed";
  fee_value: number; // % or JPY
}

export interface Deal extends Base {
  code: string;
  title: string;
  buyer_id: ID | null;
  producer_id: ID | null;
  product_id: ID | null;
  country: string;
  quantity: number;
  unit: string;
  currency: Currency;
  incoterm: Incoterm;
  payment_terms: string;
  expected_revenue: number; // JPY
  expected_profit: number; // JPY
  probability: number; // 0-100
  stage: DealStage;
  next_action: string;
  deadline: string;
  owner_id: ID | null;
  cost: CostInputs;
  price_approved: boolean;
  contract_approved: boolean;
  notes: string;
}

export type ActivityType =
  | "created"
  | "status_change"
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "quotation"
  | "document"
  | "payment"
  | "task"
  | "approval"
  | "ai"
  | "system";

export interface Activity {
  id: ID;
  created_at: string;
  deal_id: ID | null;
  entity_type: "deal" | "producer" | "buyer" | "product" | "finance" | "system";
  entity_id: ID | null;
  type: ActivityType;
  message: string;
  actor: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked" | "na";

export interface Attachment {
  name: string;
  url: string;
  size: number;
}

export interface Task extends Base {
  title: string;
  deal_id: ID | null;
  kind: "checklist" | "followup" | "general";
  group_name: string; // checklist の区分 (規制 / 書類 / 物流 ...)
  assignee_id: ID | null;
  due_date: string;
  status: TaskStatus;
  note: string;
  attachments: Attachment[];
  sort_order: number;
  auto_key: string; // 自動生成タスクの重複防止キー
}

export interface LineItem {
  product_id: ID | null;
  description: string;
  hs_code: string;
  quantity: number;
  unit: string;
  unit_price: number; // 見積通貨建て
  case_qty: number | null;
  weight_kg: number | null;
}

export interface Quotation extends Base {
  code: string;
  deal_id: ID | null;
  buyer_id: ID | null;
  issue_date: string;
  valid_until: string;
  currency: Currency;
  incoterm: Incoterm;
  port: string;
  payment_terms: string;
  lead_time: string;
  items: LineItem[];
  notes: string;
  status: "draft" | "sent" | "accepted" | "rejected";
}

export type DocType =
  | "quotation"
  | "proforma_invoice"
  | "commercial_invoice"
  | "packing_list"
  | "purchase_order"
  | "sales_confirmation"
  | "shipping_instruction"
  | "spec_sheet"
  | "origin_info"
  | "sample_request"
  | "contract";

export interface TradeDocument extends Base {
  code: string;
  type: DocType;
  deal_id: ID | null;
  title: string;
  issue_date: string;
  currency: Currency;
  incoterm: Incoterm;
  items: LineItem[];
  fields: Record<string, string>; // 書類固有の項目 (Port of Loading, Vessel 等)
  status: "draft" | "issued" | "signed" | "void";
  file_url: string;
}

export type PaymentStatus = "unbilled" | "billed" | "partial" | "paid";

export interface FinanceRecord extends Base {
  deal_id: ID;
  invoice_no: string;
  currency: Currency;
  exchange_rate: number;
  revenue: number; // JPY
  cost: number; // JPY
  invoice_amount: number; // 請求通貨建て
  invoice_date: string;
  payment_due: string;
  paid_date: string;
  paid_amount: number; // 請求通貨建て
  status: PaymentStatus;
  producer_payment: number; // JPY
  logistics_payment: number; // JPY
  notes: string;
}

export interface Member extends Base {
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface CompanySettings {
  company_name: string;
  company_name_en: string;
  address_en: string;
  phone: string;
  email: string;
  website: string;
  representative: string;
  bank_info: string;
  default_commission: number;
  fx_rates: Record<Currency, number>;
}

export interface Database {
  producers: Producer[];
  buyers: Buyer[];
  products: Product[];
  deals: Deal[];
  activities: Activity[];
  tasks: Task[];
  quotations: Quotation[];
  documents: TradeDocument[];
  finance: FinanceRecord[];
  members: Member[];
}

export type TableName = keyof Database;
export type Row<T extends TableName> = Database[T][number];
