// システム更新履歴。修正を反映するたびに先頭へ追記する（夜間更新の PR にも含める）。
// version は package.json と揃える。

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD（反映日）
  kind: "feature" | "fix" | "security";
  items: string[];
  pr?: number;
}

export const CHANGELOG: Release[] = [
  {
    version: "1.1.0",
    date: "2026-09-27",
    kind: "feature",
    items: [
      "訂正履歴：すべてのレコードの作成・訂正・削除を変更前後の値つきで記録し、Owner/Admin は任意の変更を元に戻せるように",
      "PC・スマホ・タブレットにアプリとしてインストール可能（PWA）。iPhone のノッチ・ホームバーや入力時の拡大にも対応",
      "新しいバージョンの通知と、利用者の操作による更新の適用",
      "不具合の自動検知と報告（個人情報・取引データは送信しない）",
      "夜間更新：承認済みの修正のみ毎日 2:00（日本時間）に本番へ反映",
      "個人利用向けに、登録済みメンバー以外のログインを拒否",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-26",
    kind: "feature",
    items: ["AITREK OS 初版（Dashboard / CRM / Deal Pipeline / 輸出原価 / Checklist / 書類 / Finance / Tasks / AI）"],
    pr: 1,
  },
];

export const APP_VERSION = CHANGELOG[0].version;
