import type { Role } from "./types";

export type Action =
  | "record.edit" // Producer / Buyer / Product / Deal / Task / 見積 / 書類の作成・更新
  | "record.delete" // 重要でないレコードの削除 (Task, 見積, 書類, 商品)
  | "finance.edit" // 請求情報の入力
  | "contract.approve" // 契約承認 (Contract 以降へのステージ移動を含む)
  | "price.change" // 価格承認・見積単価の手動変更
  | "payment" // 入金確定・支払
  | "buyer.delete"
  | "producer.delete"
  | "user.manage" // User 追加・権限変更
  | "settings.edit";

const CRITICAL: Action[] = [
  "contract.approve",
  "price.change",
  "payment",
  "buyer.delete",
  "producer.delete",
  "user.manage",
  "settings.edit",
];

const MATRIX: Record<Role, Action[]> = {
  owner: ["record.edit", "record.delete", "finance.edit", ...CRITICAL],
  admin: ["record.edit", "record.delete", "finance.edit", ...CRITICAL],
  sales: ["record.edit", "record.delete"],
  trade_ops: ["record.edit", "record.delete"],
  finance: ["record.edit", "finance.edit"],
  marketing: ["record.edit"],
  viewer: [],
  // AI Agent は下書き（作成・更新）のみ。削除・承認・金銭操作は不可。
  ai_agent: ["record.edit"],
};

export const can = (role: Role | undefined, action: Action) => !!role && MATRIX[role].includes(action);

export const ACTION_LABELS: Record<Action, string> = {
  "record.edit": "レコード作成・更新",
  "record.delete": "レコード削除（Task・見積・書類・商品）",
  "finance.edit": "請求情報の入力",
  "contract.approve": "契約承認",
  "price.change": "Price変更・価格承認",
  payment: "Payment（入金確定）",
  "buyer.delete": "Buyer削除",
  "producer.delete": "Producer削除",
  "user.manage": "User追加・権限変更",
  "settings.edit": "システム設定変更",
};

export const ALL_ACTIONS = Object.keys(ACTION_LABELS) as Action[];

export const denyMessage = (action: Action) =>
  CRITICAL.includes(action)
    ? `「${ACTION_LABELS[action]}」は Owner / Admin のみ実行できます。`
    : `現在の Role では「${ACTION_LABELS[action]}」を実行できません。`;
