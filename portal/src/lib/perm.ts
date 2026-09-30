// 権限（職務分掌）。UIの表示制御とサーバー側の書き込み検証の両方で同じ定義を使う。
export type RoleName = "employee" | "approver" | "finance" | "auditor" | "admin";

export const can = {
  /** 会計データ（仕訳・試算表・決算書）の閲覧 */
  viewAccounting: (r: RoleName) => r === "finance" || r === "admin" || r === "auditor",
  /** 仕訳の起票・給与計算・月次締め */
  writeAccounting: (r: RoleName) => r === "finance" || r === "admin",
  /** 給与データの閲覧・計算（一般社員は自分の明細のみ） */
  viewPayroll: (r: RoleName) => r === "finance" || r === "admin",
  /** 監査ログ・提出パッケージの出力 */
  audit: (r: RoleName) => r === "admin" || r === "auditor" || r === "finance",
  /** お知らせ・上場準備など全社設定 */
  admin: (r: RoleName) => r === "admin",
};
