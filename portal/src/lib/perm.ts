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
  /** 社内規程などの文書の登録・更新（管理者） */
  manageDocs: (r: RoleName) => r === "admin",
  /** 業務カレンダーの予定の登録・更新（役員・管理者）。閲覧は全社員 */
  editCalendar: (r: RoleName) => r === "executive" || r === "admin",
  /** 業務日報：全員分の閲覧とコメント（役員・管理者） */
  viewAllReports: (r: RoleName) => r === "executive" || r === "admin",
  /** KPIの定義・目標の設定（管理者）。担当者は自分のKPIの実績を入力できる */
  manageKpis: (r: RoleName) => r === "admin",
  /** リモート接続先の登録（管理者）。従業員は自分に割り当てられた接続先だけ見える */
  manageRemotes: (r: RoleName) => r === "admin",
  /** 有給の付与日数の編集・全員分の閲覧 */
  viewAllLeave: (r: RoleName) => r === "executive" || r === "admin",
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
  { label: "社内規程などの文書", employee: "閲覧・確認", executive: "閲覧・確認", admin: "登録・更新" },
  { label: "業務カレンダー（全社共通）", employee: "閲覧", executive: "閲覧・予定の登録", admin: "閲覧・予定の登録" },
  { label: "業務日報", employee: "自分の日報", executive: "全員分を閲覧・コメント", admin: "全員分を閲覧・コメント" },
  { label: "KPI", employee: "全社KPI・自分のKPI（担当分は実績入力）", executive: "全KPIを閲覧", admin: "定義・目標・実績の編集" },
  { label: "リモート接続先", employee: "自分に割り当てられたPCのみ", executive: "全て閲覧", admin: "登録・編集" },
  { label: "有給管理", employee: "自分の残日数", executive: "全員分を閲覧", admin: "全員分を閲覧・付与日数の調整" },
];
