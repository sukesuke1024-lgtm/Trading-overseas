// データモデル（仕様書 §5：users / teams / organizations / contacts / deals / activities / tasks ＋ deal_stages / audit）
// 最終接触・次回予定・Next Action は「入力させず」活動／Task から導出する。
import type { CreditInput, Policy, Rating } from "./credit.ts";
// 追加（海外事業向け）：products（カタログ）/ deal lines（明細）/ sales・journals（売上と仕訳）/ fx_forwards（為替予約）/ notices（営業部のお知らせ）/ mail_logs（一斉送信の記録）

export type Role = "admin" | "manager" | "sales";

export interface Team { id: string; name: string }
/** 従業員名簿（社内ポータルの従業員マスタと同じ番号・氏名・部署）。権限は ポータル「管理者→admin／役員→manager／従業員→sales」に対応 */
export interface User {
  id: string; employeeNo: string; name: string; kana: string; email: string; role: Role; teamId: string;
  title: string; dept: string; hue: number; fromPortal: boolean;
}

export type StageId = "lead" | "contact" | "hearing" | "proposal" | "quotation" | "negotiation" | "won" | "lost" | "hold";
export interface Stage { id: StageId; label: string; en: string; probability: number; kind: "open" | "won" | "lost" | "hold"; hint: string }

export type Segment = "importer" | "distributor" | "retailer" | "restaurant" | "ecommerce" | "trading" | "other";
export type Source = "展示会" | "紹介" | "Web問い合わせ" | "既存顧客" | "アウトバウンド" | "商談会" | "その他";

export interface Screening { at: string; by: string; query: string; result: "clear" | "review" | "hit"; matches: number; dataDate: string | null }
export interface Organization {
  id: string; name: string; url: string; country: string; city: string; address: string;
  industry: string; segment: Segment; source: Source; ownerId: string; memo: string; createdAt: string;
  /** 制裁リストの照会結果（最新） */
  screening: Screening | null;
}

export type Lang = "ja" | "en";
export interface Contact {
  id: string; orgId: string; name: string; department: string; title: string; email: string; phone: string;
  isPrimary: boolean; isDecisionMaker: boolean; note: string;
  /** メール配信の停止希望（オプトアウト）。true の相手には一斉送信しない */
  optOut: boolean; lang: Lang;
}

export type Currency = "JPY" | "USD" | "SGD" | "HKD" | "EUR" | "AUD" | "THB";
export type PayTerm = "advance" | "partial" | "lc" | "dp" | "da" | "oa" | "";
export type Incoterm = "EXW" | "FOB" | "CFR" | "CIF" | "DAP" | "DDP" | "";

export interface DealLine { id: string; productId: string; name: string; qty: number; unit: string; unitPrice: number }
export interface Decision { result: "go" | "conditional" | "stop" | "hold"; label: string; conditions: string[]; path: string[]; at: string; by: string }

export interface Deal {
  id: string; name: string; orgId: string; contactId: string | null; ownerId: string;
  /** 明細（lines）がある場合は Σ(数量×単価) と常に一致させる */
  amount: number; currency: Currency; stage: StageId; probability: number;
  expectedCloseDate: string | null; lostReason: string; product: string; memo: string;
  createdAt: string; stageChangedAt: string; closedAt: string | null;
  lines: DealLine[]; payTerm: PayTerm; incoterm: Incoterm; decision: Decision | null;
}

export type ActivityType = "call" | "email" | "visit" | "online" | "expo" | "referral" | "material" | "quote" | "other";

export interface Activity {
  id: string; type: ActivityType; orgId: string; contactId: string | null; dealId: string | null;
  userId: string; at: string; summary: string; note: string;
}

export interface Task {
  id: string; title: string; type: ActivityType; orgId: string | null; dealId: string | null; contactId: string | null;
  assigneeId: string; dueDate: string | null; status: "open" | "done"; isNextAction: boolean;
  createdAt: string; doneAt: string | null;
}

// ---- 商品カタログ ----
export type ProductCategory = "和牛・精肉" | "水産物・冷凍" | "日本酒・焼酎" | "茶・抹茶" | "青果・果物" | "調味料・加工食品" | "米・穀物";
export interface Product {
  id: string; sku: string; name: string; nameEn: string; category: ProductCategory; producer: string; origin: string;
  spec: string; specEn: string; unit: string; moq: number; storage: "冷凍" | "冷蔵" | "常温"; shelfLife: string;
  /** 仕入原価（円／単位）。社外向けのカタログ・チラシには出さない */
  costJPY: number;
  /** 標準の販売価格（USD／単位・FOB）。見積・明細の初期値 */
  priceUSD: number;
  hsCode: string; certs: string[]; desc: string; descEn: string; active: boolean;
}

// ---- 売上と仕訳（売上金額と仕訳金額を一致させる）----
export interface SaleLine { desc: string; qty: number; unit: string; unitPrice: number }
export interface Sale {
  id: string; no: string; dealId: string; orgId: string; date: string; currency: Currency; lines: SaleLine[];
  /** 外貨建て売上額＝Σ(数量×単価)。円換算額＝round(外貨額×計上レート)。仕訳の売上高と一致する */
  amount: number; rate: number; amountJPY: number;
  status: "計上済" | "入金済"; paidDate: string | null; receivedJPY: number | null; bankFeeJPY: number | null;
}
export interface JournalLine { account: string; side: "D" | "C"; amount: number }
export interface Journal { id: string; date: string; memo: string; saleId: string; kind: "売上" | "入金"; partner: string; lines: JournalLine[] }

export interface FxForward {
  id: string; bank: string; currency: Currency; amount: number; rate: number; tradeDate: string; settleDate: string;
  dealId: string | null; note: string; status: "open" | "settled";
}

export interface NoticeUrl { label: string; url: string }
export interface Notice { id: string; title: string; body: string; urls: NoticeUrl[]; pinned: boolean; date: string; authorId: string }

export interface MailLog { id: string; at: string; userId: string; subject: string; count: number; filter: string; via: string; attachments: number }

// ---- 与信審査 ----
export interface CreditResultSnap { score: number; rating: Rating; limitJPY: number; coveredJPY: number; totalLimitJPY: number; completeness: number; expectedLossRate: number; needsApproval: boolean }
export interface CreditReview {
  id: string; orgId: string; createdAt: string; createdBy: string; input: CreditInput; result: CreditResultSnap;
  status: "draft" | "submitted" | "approved" | "rejected"; approverId: string; decidedAt: string | null; comment: string; validUntil: string;
}

export interface AuditEntry { id: string; at: string; userId: string; action: string; entity: string; label: string }

export interface Data {
  version: number;
  teams: Team[]; users: User[]; organizations: Organization[]; contacts: Contact[];
  deals: Deal[]; activities: Activity[]; tasks: Task[]; audit: AuditEntry[];
  products: Product[]; sales: Sale[]; journals: Journal[]; forwards: FxForward[]; notices: Notice[]; mailLogs: MailLog[];
  creditReviews: CreditReview[]; creditPolicy: Policy;
}
