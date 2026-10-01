// H-LINK 社内ポータルの基本定義（会社情報・権限・従業員の型・マスタの選択肢）。
// 従業員の個人情報（給与額・生年月日・マイナンバー等）はここにも seed にも含めない。実データは管理者が Excel から取り込む。

export const COMPANY = {
  name: "H-LINK",
  short: "H-LINK",
  ceo: "長尾 晃佑",
  tagline: "つなぐ、越える、食の可能性をひらく。",
  /** 画面に出す版表示（更新が反映されたか確認する目安） */
  version: "版 2026.10.1-PIN",
  /** ログインできない・PINを忘れた人の連絡先の表示（NEXT_PUBLIC_HELPDESK で変更） */
  helpdesk: process.env.NEXT_PUBLIC_HELPDESK ?? "人事・情報システム担当",
};

/** 権限（3区分）。従業員＝自分のみ／役員＝全社の閲覧（読み取り専用）／管理者＝全社の閲覧と編集・Excel連携 */
export type Role = "employee" | "executive" | "admin";
export const ROLE_LABEL: Record<Role, string> = { employee: "従業員", executive: "役員", admin: "管理者" };
export const ROLE_DESC: Record<Role, string> = {
  employee: "自分の勤怠入力・申請のみ。他の人の勤怠・従業員情報は見られません。",
  executive: "全社の勤怠・従業員・経理を閲覧（読み取り専用）。承認者になれます。",
  admin: "全社の閲覧と編集、従業員マスタの取込、Excel連携、権限の設定、月次締め。",
};
export const ROLES: Role[] = ["admin", "executive", "employee"];

// 賃金計算ブック「⑲手当・職種マスタ」と同じ選択肢
export const EMPLOYMENT_TYPES = ["正社員", "契約社員", "嘱託社員", "再雇用社員", "パートタイマー", "アルバイト", "準社員", "派遣社員", "役員", "執行役員", "業務委託", "その他"];
export const JOBS = ["代表取締役", "取締役", "執行役員", "監査役", "本部長", "部長", "次長", "課長", "係長", "主任", "総務", "人事", "経理・財務", "法務", "情報システム", "経営企画", "広報", "購買", "営業", "営業事務", "販売", "店舗管理", "カスタマーサポート", "コールセンター", "マーケティング", "商品企画", "研究開発", "設計", "生産管理", "品質管理", "製造", "施工管理", "技術サービス", "物流・倉庫", "ドライバー", "医療・介護", "調理", "清掃", "警備", "その他"];
export const EXEC_JOBS = ["代表取締役", "取締役", "執行役員", "監査役"];

export type Employee = {
  id: string; // 従業員番号（ログインID）。賃金計算ブックの④従業員マスタと同じ "001" 形式
  name: string;
  kana?: string;
  employment: string; // 雇用区分
  job: string; // 職種
  wageType?: string; // 賃金形態（金額は保持しない）
  scheduled: number; // 所定労働時間（時間/日）
  joined?: string;
  left?: string;
  paidGranted?: number; // 有給付与日数（今期の有効日数・繰越込み。未設定なら入社日から法定で算出）
  dept?: string; // 部署（組織図）
  bossId?: string; // 上司の従業員番号（組織図）
  email?: string; // 会社メール（PIN再設定の本人確認に使う。管理者・役員以外には非公開）
  role: Role;
  sample?: boolean; // デモ用のサンプル
};

/** 職種・雇用区分から既定の権限を決める（役員系の職種は「役員」。管理者は管理者が指定する） */
export function defaultRole(job: string, employment: string): Role {
  return EXEC_JOBS.includes(job) || employment === "役員" || employment === "執行役員" ? "executive" : "employee";
}

/** 社長（代表取締役）。承認ルートの既定の承認者 */
export const PRESIDENT_ID = "001";
export const PRESIDENT: Employee = { id: PRESIDENT_ID, name: COMPANY.ceo, employment: "役員", job: "代表取締役", scheduled: 7.5, role: "admin", dept: "経営" };

/** デモ（GitHub Pages）専用のサンプル。サーバー版には入らない */
export const SAMPLE_EMPLOYEES: Employee[] = [
  { id: "901", name: "サンプル 役員", kana: "サンプル ヤクイン", employment: "役員", job: "取締役", scheduled: 7.5, role: "executive", sample: true, dept: "経営", bossId: "001", email: "901@hlink.example", joined: "2020-04-01" },
  { id: "902", name: "サンプル 従業員", kana: "サンプル ジュウギョウイン", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", sample: true, dept: "営業部", bossId: "901", email: "902@hlink.example", joined: "2024-04-01" },
  { id: "903", name: "サンプル 管理者", kana: "サンプル カンリシャ", employment: "正社員", job: "経理・財務", scheduled: 7.5, role: "admin", sample: true, dept: "管理部", bossId: "001", email: "903@hlink.example", joined: "2022-10-01" },
];

// ---------- お知らせ ----------
export type NewsCategory = "全社" | "慶弔" | "新入社員" | "人事" | "勤怠・給与" | "総務" | "システム" | "その他";
export const NEWS_CATEGORIES: NewsCategory[] = ["全社", "慶弔", "新入社員", "人事", "勤怠・給与", "総務", "システム", "その他"];
export type News = { id: string; title: string; body: string; category: NewsCategory; date: string; important: boolean; author: string };
export const NEWS_SEED: News[] = [
  { id: "n1", title: "社内ポータルの運用を開始します", body: "勤怠の入力・申請と承認は、このポータルから行います。入力した勤怠は Excel（勤怠ブック→賃金計算ブック）へ反映され、給与計算につながります。\n操作で困ったときは管理者にご連絡ください。", category: "全社", date: "2026-10-01", important: true, author: "管理者" },
  { id: "n2", title: "勤怠入力のルール（始業・終業・休憩）", body: "・所定労働時間は 8:30〜17:00（休憩60分）の7.5時間です。\n・日をまたぐ勤務は、終業時刻を 25:00 のように入力できます。\n・コアタイム（11:00〜15:00）にご注意ください。", category: "勤怠・給与", date: "2026-10-01", important: false, author: "管理者" },
];

// ---------- ワークフロー ----------
export type WfType = "経費精算" | "休暇申請" | "出張申請" | "稟議" | "IT機器・アカウント申請" | "異動変更届";
export const WF_TYPES: { type: WfType; desc: string }[] = [
  { type: "経費精算", desc: "交通費・接待交際費・立替金などの精算" },
  { type: "休暇申請", desc: "年次有給休暇、特別休暇、振替休日" },
  { type: "出張申請", desc: "国内・海外出張の事前申請" },
  { type: "稟議", desc: "稟議書・決裁（契約・投資・購買など）" },
  { type: "IT機器・アカウント申請", desc: "PC・ソフトウェア・アクセス権の申請" },
  { type: "異動変更届", desc: "住所・氏名・家族・通勤・口座などの変更届（人事）" },
];
export type WfStatus = "承認待ち" | "承認済" | "差戻し" | "却下" | "取下げ";
export type WfStep = { approverId: string; label: string; state: "待機" | "承認待ち" | "承認" | "差戻し" | "却下"; at?: string; comment?: string };
/** 申請・承認の操作記録。いつ（サーバー時刻）・誰が・何をしたか・理由を残す（社長・役員も同じ） */
export type WfEvent = { at: string; by: string; action: "申請" | "承認" | "差戻し" | "却下" | "取下げ" | "修正再申請"; reason?: string };
export type Workflow = {
  id: string; type: WfType; title: string; applicantId: string; amount?: number;
  category?: string; taxKind?: string; invoiceNo?: string; // 経費精算：勘定科目コード・税区分・適格請求書の登録番号
  from?: string; to?: string; // 休暇申請：期間
  detail: string; createdAt: string; status: WfStatus; steps: WfStep[];
  history?: WfEvent[];
};
