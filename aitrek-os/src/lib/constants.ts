import type { DealStage, Incoterm, PaymentStatus, Role, TaskStatus, DocType } from "./types";

export const STAGES: { key: DealStage; label: string; probability: number }[] = [
  { key: "lead", label: "Lead", probability: 5 },
  { key: "contacted", label: "Contacted", probability: 10 },
  { key: "meeting", label: "Meeting", probability: 15 },
  { key: "requirement", label: "Requirement", probability: 20 },
  { key: "matching", label: "Product Matching", probability: 25 },
  { key: "quotation", label: "Quotation", probability: 35 },
  { key: "sample", label: "Sample", probability: 45 },
  { key: "negotiation", label: "Negotiation", probability: 60 },
  { key: "contract", label: "Contract", probability: 80 },
  { key: "order", label: "Order", probability: 90 },
  { key: "shipment", label: "Shipment", probability: 95 },
  { key: "payment", label: "Payment", probability: 98 },
  { key: "repeat", label: "Repeat", probability: 100 },
];

export const LOST_STAGE = { key: "lost" as const, label: "Lost", probability: 0 };

export const stageLabel = (s: DealStage) =>
  s === "lost" ? LOST_STAGE.label : STAGES.find((x) => x.key === s)?.label ?? s;

export const stageIndex = (s: DealStage) => STAGES.findIndex((x) => x.key === s);

/** 成約済み（Contract 以降）とみなすステージ */
export const isWon = (s: DealStage) => s !== "lost" && stageIndex(s) >= stageIndex("contract");

export const INCOTERMS: { key: Incoterm; label: string }[] = [
  { key: "EXW", label: "EXW — 工場渡し" },
  { key: "FCA", label: "FCA — 運送人渡し" },
  { key: "FOB", label: "FOB — 本船渡し" },
  { key: "CFR", label: "CFR — 運賃込み" },
  { key: "CIF", label: "CIF — 運賃・保険料込み" },
  { key: "DAP", label: "DAP — 仕向地持込渡し" },
  { key: "DDP", label: "DDP — 関税込持込渡し" },
];

export interface CountryInfo {
  code: string;
  name: string;
  name_en: string;
  currency: string;
  dial: string;
  flag: string;
  region: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "US", name: "アメリカ", name_en: "United States", currency: "USD", dial: "+1", flag: "🇺🇸", region: "North America" },
  { code: "CA", name: "カナダ", name_en: "Canada", currency: "CAD", dial: "+1", flag: "🇨🇦", region: "North America" },
  { code: "SG", name: "シンガポール", name_en: "Singapore", currency: "SGD", dial: "+65", flag: "🇸🇬", region: "Southeast Asia" },
  { code: "HK", name: "香港", name_en: "Hong Kong", currency: "HKD", dial: "+852", flag: "🇭🇰", region: "East Asia" },
  { code: "TW", name: "台湾", name_en: "Taiwan", currency: "TWD", dial: "+886", flag: "🇹🇼", region: "East Asia" },
  { code: "CN", name: "中国", name_en: "China", currency: "CNY", dial: "+86", flag: "🇨🇳", region: "East Asia" },
  { code: "KR", name: "韓国", name_en: "South Korea", currency: "KRW", dial: "+82", flag: "🇰🇷", region: "East Asia" },
  { code: "TH", name: "タイ", name_en: "Thailand", currency: "THB", dial: "+66", flag: "🇹🇭", region: "Southeast Asia" },
  { code: "VN", name: "ベトナム", name_en: "Vietnam", currency: "VND", dial: "+84", flag: "🇻🇳", region: "Southeast Asia" },
  { code: "MY", name: "マレーシア", name_en: "Malaysia", currency: "MYR", dial: "+60", flag: "🇲🇾", region: "Southeast Asia" },
  { code: "PH", name: "フィリピン", name_en: "Philippines", currency: "PHP", dial: "+63", flag: "🇵🇭", region: "Southeast Asia" },
  { code: "ID", name: "インドネシア", name_en: "Indonesia", currency: "IDR", dial: "+62", flag: "🇮🇩", region: "Southeast Asia" },
  { code: "AU", name: "オーストラリア", name_en: "Australia", currency: "AUD", dial: "+61", flag: "🇦🇺", region: "Oceania" },
  { code: "NZ", name: "ニュージーランド", name_en: "New Zealand", currency: "NZD", dial: "+64", flag: "🇳🇿", region: "Oceania" },
  { code: "GB", name: "イギリス", name_en: "United Kingdom", currency: "GBP", dial: "+44", flag: "🇬🇧", region: "Europe" },
  { code: "FR", name: "フランス", name_en: "France", currency: "EUR", dial: "+33", flag: "🇫🇷", region: "Europe" },
  { code: "DE", name: "ドイツ", name_en: "Germany", currency: "EUR", dial: "+49", flag: "🇩🇪", region: "Europe" },
  { code: "NL", name: "オランダ", name_en: "Netherlands", currency: "EUR", dial: "+31", flag: "🇳🇱", region: "Europe" },
  { code: "IT", name: "イタリア", name_en: "Italy", currency: "EUR", dial: "+39", flag: "🇮🇹", region: "Europe" },
  { code: "AE", name: "UAE", name_en: "United Arab Emirates", currency: "AED", dial: "+971", flag: "🇦🇪", region: "Middle East" },
  { code: "SA", name: "サウジアラビア", name_en: "Saudi Arabia", currency: "SAR", dial: "+966", flag: "🇸🇦", region: "Middle East" },
  { code: "IN", name: "インド", name_en: "India", currency: "INR", dial: "+91", flag: "🇮🇳", region: "South Asia" },
  { code: "MX", name: "メキシコ", name_en: "Mexico", currency: "MXN", dial: "+52", flag: "🇲🇽", region: "Latin America" },
  { code: "BR", name: "ブラジル", name_en: "Brazil", currency: "BRL", dial: "+55", flag: "🇧🇷", region: "Latin America" },
];

export const countryOf = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code);
export const countryLabel = (code: string | null | undefined) => {
  const c = countryOf(code);
  return c ? `${c.flag} ${c.name}` : code || "—";
};

/** Settings の初期為替レート (1 通貨あたりの円)。Settings 画面で更新する。 */
export const DEFAULT_FX: Record<string, number> = {
  JPY: 1,
  USD: 150,
  EUR: 163,
  GBP: 192,
  SGD: 112,
  HKD: 19.2,
  TWD: 4.7,
  CNY: 21,
  KRW: 0.108,
  THB: 4.3,
  VND: 0.0059,
  MYR: 33,
  PHP: 2.6,
  IDR: 0.0093,
  AUD: 98,
  NZD: 89,
  CAD: 108,
  AED: 40.8,
  SAR: 40,
  INR: 1.75,
  MXN: 8.2,
  BRL: 27,
};

export const CURRENCIES = Object.keys(DEFAULT_FX);

export const PRODUCT_CATEGORIES = [
  "水産品",
  "水産加工品",
  "畜産品",
  "乳製品",
  "農産品",
  "米・穀物",
  "菓子",
  "調味料",
  "飲料",
  "酒類",
  "冷凍食品",
  "健康食品",
  "日用品・雑貨",
  "その他",
];

export const STORAGE_TEMPS = ["常温", "冷蔵", "冷凍"];

export const CERTIFICATIONS = [
  "HACCP",
  "ISO22000",
  "FSSC22000",
  "JFS-B",
  "JFS-C",
  "有機JAS",
  "Halal",
  "Kosher",
  "MSC",
  "FDA登録",
  "GACC登録",
];

export const PRODUCER_CONTRACT_STATUS = ["未契約", "交渉中", "契約済", "停止"];
export const BUYER_STATUS = ["Lead", "Contacted", "商談中", "取引中", "休眠", "NG"];
export const BUSINESS_TYPES = ["輸入業者", "卸売", "小売", "スーパー", "EC", "飲食", "ホテル", "代理店", "その他"];
export const PRODUCT_STATUS = ["候補", "準備中", "輸出可能", "販売中", "停止"];
export const PAYMENT_TERMS = ["T/T 100% in advance", "T/T 30% deposit, 70% before shipment", "T/T 30 days after B/L", "L/C at sight", "D/P", "Net 30"];

export const ROLES: { key: Role; label: string; description: string }[] = [
  { key: "owner", label: "Owner", description: "全権限。契約・価格・支払の最終承認" },
  { key: "admin", label: "Admin", description: "Owner と同等の業務権限・ユーザー管理" },
  { key: "sales", label: "Sales", description: "Buyer / Producer / Deal / 見積の作成・更新" },
  { key: "trade_ops", label: "Trade Operations", description: "輸出Checklist・書類・物流の管理" },
  { key: "finance", label: "Finance", description: "請求・入金・支払の管理（入金確定は承認者）" },
  { key: "marketing", label: "Marketing", description: "商品情報・多言語説明・営業素材" },
  { key: "viewer", label: "Viewer", description: "閲覧のみ" },
  { key: "ai_agent", label: "AI Agent", description: "下書き作成のみ。確定操作は不可" },
];

export const roleLabel = (r: Role) => ROLES.find((x) => x.key === r)?.label ?? r;

export const TASK_STATUS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "未着手" },
  { key: "in_progress", label: "進行中" },
  { key: "blocked", label: "保留" },
  { key: "done", label: "完了" },
  { key: "na", label: "対象外" },
];
export const taskStatusLabel = (s: TaskStatus) => TASK_STATUS.find((x) => x.key === s)?.label ?? s;

export const PAYMENT_STATUS: { key: PaymentStatus; label: string }[] = [
  { key: "unbilled", label: "未請求" },
  { key: "billed", label: "請求済" },
  { key: "partial", label: "一部入金" },
  { key: "paid", label: "入金済" },
];
export const paymentStatusLabel = (s: PaymentStatus) => PAYMENT_STATUS.find((x) => x.key === s)?.label ?? s;

export const DOC_TYPES: { key: DocType; label: string; short: string }[] = [
  { key: "quotation", label: "Quotation", short: "QT" },
  { key: "proforma_invoice", label: "Proforma Invoice", short: "PI" },
  { key: "commercial_invoice", label: "Commercial Invoice", short: "CI" },
  { key: "packing_list", label: "Packing List", short: "PL" },
  { key: "purchase_order", label: "Purchase Order", short: "PO" },
  { key: "sales_confirmation", label: "Sales Confirmation", short: "SC" },
  { key: "shipping_instruction", label: "Shipping Instruction", short: "SI" },
  { key: "spec_sheet", label: "Product Specification Sheet", short: "SPEC" },
  { key: "origin_info", label: "Origin Information", short: "ORG" },
  { key: "sample_request", label: "Sample Request", short: "SR" },
  { key: "contract", label: "Sales Contract", short: "CT" },
];
export const docTypeLabel = (t: DocType) => DOC_TYPES.find((x) => x.key === t)?.label ?? t;
