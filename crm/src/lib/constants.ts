import type { ActivityType, Currency, Role, Segment, Source, Stage, StageId } from "./types";

/**
 * 営業ステージ。仕様書の初期案（Lead→First Contact→Qualification→Hearing→Proposal→Quotation→Negotiation→Won/Lost/On Hold）から
 * 「Qualification」を「Hearing」に統合（現場では見極めとヒアリングを同じ打合せで行うため）し、有効ステージを6段階にした。
 */
export const STAGES: Stage[] = [
  { id: "lead", label: "リード", en: "Lead", probability: 10, kind: "open", hint: "接点獲得。まだ会話していない" },
  { id: "contact", label: "初回接触", en: "First Contact", probability: 20, kind: "open", hint: "担当者と初回の連絡が取れた" },
  { id: "hearing", label: "ヒアリング", en: "Hearing", probability: 35, kind: "open", hint: "ニーズ・予算・決裁者・時期を確認中" },
  { id: "proposal", label: "提案", en: "Proposal", probability: 50, kind: "open", hint: "商品・条件を提案／サンプル提供中" },
  { id: "quotation", label: "見積", en: "Quotation", probability: 65, kind: "open", hint: "見積／PI を提出済み" },
  { id: "negotiation", label: "交渉", en: "Negotiation", probability: 80, kind: "open", hint: "価格・条件・契約の最終調整" },
  { id: "won", label: "受注", en: "Won", probability: 100, kind: "won", hint: "受注確定" },
  { id: "lost", label: "失注", en: "Lost", probability: 0, kind: "lost", hint: "失注（理由必須）" },
  { id: "hold", label: "保留", en: "On Hold", probability: 0, kind: "hold", hint: "先方都合で一時停止" },
];
export const OPEN_STAGES = STAGES.filter((s) => s.kind === "open");
export const stageOf = (id: StageId): Stage => STAGES.find((s) => s.id === id)!;
export const isOpen = (id: StageId) => stageOf(id).kind === "open";

export const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "call", label: "電話" }, { id: "email", label: "Email" }, { id: "visit", label: "訪問" },
  { id: "online", label: "Online" }, { id: "expo", label: "展示会" }, { id: "referral", label: "紹介" },
  { id: "material", label: "資料送付" }, { id: "quote", label: "見積提出" }, { id: "other", label: "その他" },
];
export const activityLabel = (t: ActivityType) => ACTIVITY_TYPES.find((a) => a.id === t)?.label ?? t;

export const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "importer", label: "輸入業者" }, { id: "distributor", label: "卸・ディストリビューター" },
  { id: "retailer", label: "小売" }, { id: "restaurant", label: "飲食チェーン" },
  { id: "ecommerce", label: "EC・オンライン" }, { id: "trading", label: "商社" }, { id: "other", label: "その他" },
];
export const segmentLabel = (s: Segment) => SEGMENTS.find((x) => x.id === s)?.label ?? s;

export const SOURCES: Source[] = ["展示会", "紹介", "Web問い合わせ", "既存顧客", "アウトバウンド", "商談会", "その他"];

export const LOST_REASONS = ["価格が合わない", "競合に決定", "時期・予算の都合", "輸入規制・検疫の壁", "物流・納期の条件", "先方の担当者が不在・異動", "連絡が取れなくなった", "その他"];

export const PRODUCTS = ["和牛・精肉", "水産物・冷凍", "日本酒・焼酎", "茶・抹茶", "青果・果物", "調味料・加工食品", "米・穀物", "複数カテゴリー"];

export const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: "admin", label: "Admin", desc: "全データの閲覧・編集・削除、ユーザー／権限管理、監査ログ" },
  { id: "manager", label: "Manager", desc: "全データの閲覧・編集・削除、チーム分析、監査ログの閲覧" },
  { id: "sales", label: "Sales", desc: "全データの閲覧、自分が担当する顧客・案件・Task の編集" },
];

// デモ用の固定為替（JPY換算。実運用では設定画面／外部レート）
export const FX: Record<Currency, number> = { JPY: 1, USD: 152, SGD: 113, HKD: 19.5, EUR: 165, AUD: 99, THB: 4.3 };
export const toJPY = (amount: number, c: Currency) => Math.round(amount * FX[c]);

export const COUNTRY_FLAG: Record<string, string> = {
  シンガポール: "🇸🇬", 香港: "🇭🇰", タイ: "🇹🇭", ベトナム: "🇻🇳", 米国: "🇺🇸", UAE: "🇦🇪", 台湾: "🇹🇼",
  マレーシア: "🇲🇾", 韓国: "🇰🇷", オーストラリア: "🇦🇺", ドイツ: "🇩🇪", インドネシア: "🇮🇩", 日本: "🇯🇵",
};
export const COUNTRIES = Object.keys(COUNTRY_FLAG);
export const flag = (country: string) => COUNTRY_FLAG[country] ?? "🌐";
