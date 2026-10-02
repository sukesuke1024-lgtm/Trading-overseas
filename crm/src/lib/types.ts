// データモデル（仕様書 §5：users / teams / organizations / contacts / deals / activities / tasks ＋ deal_stages / audit）
// 最終接触・次回予定・Next Action は「入力させず」活動／Task から導出する。

export type Role = "admin" | "manager" | "sales";

export interface Team { id: string; name: string }
export interface User { id: string; name: string; email: string; role: Role; teamId: string; title: string; hue: number }

export type StageId = "lead" | "contact" | "hearing" | "proposal" | "quotation" | "negotiation" | "won" | "lost" | "hold";
export interface Stage { id: StageId; label: string; en: string; probability: number; kind: "open" | "won" | "lost" | "hold"; hint: string }

export type Segment = "importer" | "distributor" | "retailer" | "restaurant" | "ecommerce" | "trading" | "other";
export type Source = "展示会" | "紹介" | "Web問い合わせ" | "既存顧客" | "アウトバウンド" | "商談会" | "その他";

export interface Organization {
  id: string; name: string; url: string; country: string; city: string; address: string;
  industry: string; segment: Segment; source: Source; ownerId: string; memo: string; createdAt: string;
}

export interface Contact {
  id: string; orgId: string; name: string; department: string; title: string; email: string; phone: string;
  isPrimary: boolean; isDecisionMaker: boolean; note: string;
}

export type Currency = "JPY" | "USD" | "SGD" | "HKD" | "EUR" | "AUD" | "THB";

export interface Deal {
  id: string; name: string; orgId: string; contactId: string | null; ownerId: string;
  amount: number; currency: Currency; stage: StageId; probability: number;
  expectedCloseDate: string | null; lostReason: string; product: string; memo: string;
  createdAt: string; stageChangedAt: string; closedAt: string | null;
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

export interface AuditEntry { id: string; at: string; userId: string; action: string; entity: string; label: string }

export interface Data {
  version: number;
  teams: Team[]; users: User[]; organizations: Organization[]; contacts: Contact[];
  deals: Deal[]; activities: Activity[]; tasks: Task[]; audit: AuditEntry[];
}
