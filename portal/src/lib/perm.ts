// 権限（職務分掌）。画面の表示制御とサーバー側の書き込み検証の両方で同じ定義を使う。
export type RoleName = "employee" | "executive" | "admin";

export const can = {
  /** 全社員の勤怠・月次集計の閲覧（役員・管理者） */
  viewAllAttendance: (r: RoleName) => r === "executive" || r === "admin",
  /** 他の人の勤怠の入力・修正（管理者のみ） */
  editAttendanceOfOthers: (r: RoleName) => r === "admin",
  /** 従業員マスタの取込・編集、権限の設定（管理者のみ） */
  manageEmployees: (r: RoleName) => r === "admin",
  /** 従業員名簿の閲覧（役員・管理者）。従業員には自分以外の詳細は見せない */
  viewEmployees: (r: RoleName) => r === "executive" || r === "admin",
  /** Excel連携・CSV出力（管理者） */
  excel: (r: RoleName) => r === "admin",
  /** 経理（決算書・仕訳）の閲覧／編集 */
  viewAccounting: (r: RoleName) => r === "executive" || r === "admin",
  writeAccounting: (r: RoleName) => r === "admin",
  /** 監査ログ・提出パッケージ */
  audit: (r: RoleName) => r === "executive" || r === "admin",
  /** お知らせの投稿・全社設定（管理者） */
  admin: (r: RoleName) => r === "admin",
  /** 全申請の閲覧（役員・管理者）。従業員は自分の申請と自分が承認者のものだけ */
  viewAllWorkflows: (r: RoleName) => r === "executive" || r === "admin",
};

/** 権限ごとの閲覧・編集範囲（権限の説明画面用） */
export const PERMISSION_MATRIX: { label: string; employee: string; executive: string; admin: string }[] = [
  { label: "自分の勤怠入力・月次集計", employee: "入力・閲覧", executive: "入力・閲覧", admin: "入力・閲覧" },
  { label: "他の人の勤怠・全員の月次集計", employee: "—", executive: "閲覧のみ", admin: "閲覧・修正" },
  { label: "従業員マスタ（名簿・権限）", employee: "—", executive: "閲覧のみ", admin: "取込・編集・権限設定" },
  { label: "申請・承認", employee: "自分の申請", executive: "全申請を閲覧・承認", admin: "全申請を閲覧・承認" },
  { label: "経理（決算書・仕訳帳）", employee: "—", executive: "閲覧のみ", admin: "閲覧・起票・月次締め" },
  { label: "Excel連携（勤怠ブック→賃金計算ブック）・CSV出力", employee: "—", executive: "—", admin: "可" },
  { label: "監査ログ・監査出力", employee: "—", executive: "閲覧・出力", admin: "閲覧・出力" },
  { label: "お知らせの投稿・全社設定", employee: "—", executive: "—", admin: "可" },
];
