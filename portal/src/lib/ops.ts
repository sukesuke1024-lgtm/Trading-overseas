// 18項目の追加機能（ファイル・関与先・与信/反社・問い合わせBox・固定資産・福利厚生・保存期間）の型と純粋関数。
import type { Employee, Workflow } from "./data.ts";
import { PRESIDENT_ID } from "./data.ts";

const p2 = (n: number) => String(n).padStart(2, "0");

// ---------- 役職者・事業部 ----------
const MANAGER_JOBS = ["部長", "本部長", "次長", "取締役", "執行役員", "代表取締役"];
/** 「役員・部長」：役員・管理者の権限を持つ人、または職種が部長クラスの人 */
export const isLead = (e: Pick<Employee, "role" | "job"> | undefined) => !!e && (e.role !== "employee" || MANAGER_JOBS.includes(e.job));
export const UNASSIGNED_DEPT = "（事業部未設定）";
export const deptOf = (e: Pick<Employee, "dept"> | undefined) => e?.dept || UNASSIGNED_DEPT;

// ---------- ファイル（文書管理・給与明細・源泉徴収票・申請添付・アーカイブ） ----------
export const FILE_KINDS = ["共有", "規程添付", "給与明細", "賞与明細", "源泉徴収票", "申請添付", "アーカイブ"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
/** 全社＝全員／事業部＝同じ事業部＋役員・管理者／役員・部長＝役員・管理者・部長／本人＝本人（＋管理者）／申請＝申請者・承認者／管理者＝管理者のみ */
export const FILE_SCOPES = ["全社", "事業部", "役員・部長", "本人", "申請", "管理者"] as const;
export type FileScope = (typeof FILE_SCOPES)[number];
export type FileRec = {
  id: string; name: string; size: number; mime: string; kind: FileKind; scope: FileScope;
  dept?: string; ownerId?: string; wfId?: string; docId?: string; period?: string; note?: string;
  uploadedBy: string; at: string;
};
export const PAY_KINDS: FileKind[] = ["給与明細", "賞与明細", "源泉徴収票"];
/** 「001_給与明細_2026-09.pdf」「001_源泉徴収票_2025.pdf」のようなファイル名から、従業員番号・種別・期間を読み取る（一括登録用） */
export function parsePayName(name: string): { empId: string; kind: FileKind; period: string } | null {
  const base = name.replace(/\.[^.]+$/, ""), tk = base.split(/[_＿]/);
  if (tk.length < 3) return null;
  const kind: FileKind | null = /源泉/.test(tk[1]) ? "源泉徴収票" : /賞与/.test(tk[1]) ? "賞与明細" : /給与/.test(tk[1]) ? "給与明細" : null;
  const m = tk[2].match(/^(\d{4})(?:[-年\/]?(\d{1,2})月?)?$/);
  if (!kind || !m || !/^[A-Za-z0-9]{1,12}$/.test(tk[0])) return null;
  const period = kind === "源泉徴収票" || !m[2] ? m[1] : `${m[1]}-${m[2].padStart(2, "0")}`;
  return kind !== "源泉徴収票" && !m[2] ? null : { empId: tk[0].toUpperCase(), kind, period };
}
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "png", "jpg", "jpeg", "gif"];
export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
/** 受け付けるファイルか（拡張子・サイズ・名前）。実行ファイル等は不可 */
export function checkUpload(name: string, size: number): string | null {
  if (!name || name.length > 200 || /[\\/\0]/.test(name)) return "ファイル名が正しくありません。";
  if (!ALLOWED_EXT.includes(extOf(name))) return `この形式は登録できません（使えるもの：${ALLOWED_EXT.join("・")}）。`;
  if (size <= 0) return "空のファイルです。";
  if (size > MAX_FILE_BYTES) return `ファイルが大きすぎます（上限 ${MAX_FILE_BYTES / 1024 / 1024}MB）。`;
  return null;
}
export const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`);
export type Viewer = { id: string; role: Employee["role"]; dept: string; lead: boolean };
export const viewerOf = (e: Employee): Viewer => ({ id: e.id, role: e.role, dept: deptOf(e), lead: isLead(e) });
/** そのファイルを閲覧・ダウンロードできるか（画面とサーバーで同じ判定） */
export function canSeeFile(f: FileRec, v: Viewer, wf?: Pick<Workflow, "applicantId" | "steps" | "type">): boolean {
  if (v.role === "admin") return true;
  switch (f.scope) {
    case "全社": return true;
    case "事業部": return v.role === "executive" || v.dept === f.dept;
    case "役員・部長": return v.lead;
    case "本人": return f.ownerId === v.id;
    case "申請": return !!wf && (wf.applicantId === v.id || wf.steps.some((s) => s.approverId === v.id) || (v.role === "executive" && wf.type !== "異動変更届")); // 個人情報を含む変更届は、届出者・承認者・管理者だけ
    case "管理者": return false;
  }
}
/** ダウンロードに「PINの再入力（ステップアップ認証）」が必要か */
export const needsStepUp = (f: FileRec) => PAY_KINDS.includes(f.kind) || f.scope === "役員・部長" || f.kind === "アーカイブ";

// ---------- 関与先マスタ・与信/反社 ----------
export type Client = { code: string; name: string; dept: string; kana?: string; corpNo?: string; contact?: string; note?: string; active: boolean };
export const isClientCode = (c: string) => /^[A-Za-z0-9-]{2,16}$/.test(c);
export const CHECK_KINDS = ["与信", "反社"] as const;
export const CHECK_RESULTS = ["問題なし", "要注意", "取引不可", "確認中"] as const;
export type CreditCheck = { id: string; clientCode: string; kind: (typeof CHECK_KINDS)[number]; result: (typeof CHECK_RESULTS)[number]; source: string; note?: string; checkedBy: string; at: string; limit?: number };
export const EXT_KINDS = ["与信", "反社", "公的情報", "その他"] as const;
/** 外部の調査サービス・公的サイトへのリンク。事業部ごとに、外部サービス上のアカウントID（accountId）を持てる */
export type ExtLink = { id: string; name: string; url: string; kind: (typeof EXT_KINDS)[number]; dept: string; accountId?: string; note?: string };
export const isHttps = (u: string) => /^https:\/\/[^\s"'<>]{3,300}$/.test(u);
export const DEFAULT_EXT_LINKS: ExtLink[] = [
  { id: "x-houjin", name: "国税庁 法人番号公表サイト", url: "https://www.houjin-bangou.nta.go.jp/", kind: "公的情報", dept: "", note: "法人番号・所在地・商号の確認" },
  { id: "x-invoice", name: "国税庁 適格請求書発行事業者公表サイト", url: "https://www.invoice-kohyo.nta.go.jp/", kind: "公的情報", dept: "", note: "登録番号（T＋13桁）の確認" },
  { id: "x-kanpo", name: "官報（破産・会社法公告の確認）", url: "https://www.kanpo.go.jp/", kind: "公的情報", dept: "", note: "破産・解散等の公告" },
  { id: "x-npa", name: "警察庁 暴力団排除", url: "https://www.npa.go.jp/bureau/soumu/seisaku/", kind: "反社", dept: "", note: "暴力団排除に関する公的情報" },
];
export const latestCheck = (list: CreditCheck[], code: string, kind: CreditCheck["kind"]) => list.filter((c) => c.clientCode === code && c.kind === kind).sort((a, b) => b.at.localeCompare(a.at))[0];

// ---------- 問い合わせ・ヘルプデスクのメールBox ----------
export const MAIL_CATEGORIES = ["総務", "人事", "経理", "情シス・PC", "営業・業務", "ツールの使い方", "ハラスメント相談", "その他"] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];
export const MAIL_STATUS = ["未対応", "対応中", "完了"] as const;
export type MailThreadItem = { by: string; at: string; body: string };
/** toType: 個人（社員へ）／事業部（事業部のみんなへ）／窓口（管理部の窓口へ）。anon=匿名（ハラスメント相談など。担当者には送信者を表示しない） */
export type Mail = { id: string; from: string; anon?: boolean; toType: "個人" | "事業部" | "窓口"; toId: string; category: MailCategory; subject: string; body: string; at: string; status: (typeof MAIL_STATUS)[number]; thread: MailThreadItem[] };
export function canSeeMail(m: Mail, v: Viewer): boolean {
  if (m.from === v.id) return true;
  if (m.toType === "個人") return m.toId === v.id;
  if (m.toType === "事業部") return v.role !== "employee" ? v.role === "admin" || v.role === "executive" : v.dept === m.toId;
  return v.role === "admin"; // 窓口
}
export const mailReadKey = (m: Mail) => `m:${m.id}:${m.thread.length}`;
export const isMailUnread = (m: Mail, read: string[], uid: string) => !read.includes(mailReadKey(m)) && (m.thread.length ? m.thread[m.thread.length - 1].by !== uid : m.from !== uid);
/** 匿名メールは、送信者本人以外には送信者を見せない */
export const maskMail = (m: Mail, uid: string): Mail => (m.anon && m.from !== uid ? { ...m, from: "匿名", thread: m.thread.map((t) => (t.by === m.from ? { ...t, by: "匿名" } : t)) } : m);
export const HELPDESK_FAQ: { cat: MailCategory; q: string; a: string }[] = [
  { cat: "ハラスメント相談", q: "ハラスメントを受けた・見た場合は？", a: "パワハラ・セクハラ・マタハラ等は、このヘルプデスクの「ハラスメント相談」から相談できます。「匿名」を選ぶと担当者に送信者は表示されません。内容は管理者（人事）のみが閲覧し、相談したことを理由とする不利益取扱いは禁止されています。緊急の場合は人事担当へ直接ご連絡ください。" },
  { cat: "情シス・PC", q: "PCが起動しない・動作が遅い", a: "①再起動 ②ネットワーク接続の確認 ③空き容量の確認をお試しください。解決しない場合は、機種名（固定資産台帳の資産番号）とエラーメッセージを添えて「情シス・PC」へ相談してください。" },
  { cat: "情シス・PC", q: "パスワード・PINを忘れた／ログインできない", a: "ログイン画面の「ログインできない・PINをお忘れの方はこちら」から再設定できます。認証アプリを紛失した場合は、管理者へ再設定を申請してください。" },
  { cat: "ツールの使い方", q: "勤怠の入力を間違えた", a: "「勤怠」画面で該当日の始業・終業・休憩を修正できます（管理者は他の人の分も修正可能）。月末の締め後の修正は管理者へご相談ください。" },
  { cat: "ツールの使い方", q: "経費精算・稟議の出し方", a: "メニューの「経費精算」「決裁・稟議書」から申請します。金額に応じて承認ルートが自動で決まります（職務権限規程のページで確認できます）。領収書は申請に添付してください。" },
  { cat: "ツールの使い方", q: "リモートで社内PCを使いたい", a: "「リモート接続」に自分のPCが登録されていれば、社内VPNに接続したうえで接続できます。登録がない場合は、情シス・PCへ依頼してください。" },
  { cat: "人事", q: "住所や氏名が変わった", a: "メニューの「異動・変更届」から届け出てください。戸籍・住民票などの添付が必要な場合があります。" },
  { cat: "経理", q: "給与明細・源泉徴収票を見たい", a: "メニューの「給与明細・源泉徴収票」からいつでもダウンロードできます（PINの再入力が必要です）。" },
];

// ---------- 固定資産台帳 ----------
export const ASSET_CATEGORIES = ["PC", "スマートフォン", "タブレット", "周辺機器", "USB・記憶媒体", "ネットワーク機器", "什器・備品", "ソフトウェア", "その他"] as const;
export const ASSET_STATUS = ["使用中", "保管", "修理中", "廃棄・売却"] as const;
export type Asset = {
  id: string; name: string; category: (typeof ASSET_CATEGORIES)[number]; maker?: string; model?: string; serial?: string; mgmtId?: string;
  purchaseDate: string; cost: number; usefulLife: number; assigneeId?: string; dept?: string; location?: string; status: (typeof ASSET_STATUS)[number]; disposedAt?: string; note?: string;
};
/** 法定耐用年数の目安（PC4年・サーバー5年・スマホ等は4年・什器5〜8年・ソフトウェア5年）。会社の取扱いは税理士に確認 */
export const DEFAULT_LIFE: Record<Asset["category"], number> = { PC: 4, スマートフォン: 4, タブレット: 4, 周辺機器: 4, "USB・記憶媒体": 4, ネットワーク機器: 6, "什器・備品": 8, ソフトウェア: 5, その他: 5 };
/** 定額法（残存価額なし・備忘価額1円）の月割償却。10万円未満は少額資産として取得時に全額費用（簿価0）として扱う目安 */
export function bookValue(a: Asset, on: string): { value: number; accumulated: number; monthly: number; expensed: boolean } {
  if (a.status === "廃棄・売却" && a.disposedAt && a.disposedAt <= on) return { value: 0, accumulated: a.cost, monthly: 0, expensed: false };
  if (a.cost < 100_000) return { value: 0, accumulated: a.cost, monthly: 0, expensed: true };
  const [py, pm] = a.purchaseDate.split("-").map(Number), [oy, om] = on.split("-").map(Number);
  const months = Math.max(0, Math.min((oy - py) * 12 + (om - pm) + 1, a.usefulLife * 12)); // 取得月から月割
  const monthly = Math.floor((a.cost - 1) / (a.usefulLife * 12));
  const accumulated = months >= a.usefulLife * 12 ? a.cost - 1 : monthly * months;
  return { value: a.cost - accumulated, accumulated, monthly, expensed: false };
}
export const nextAssetId = (list: Asset[], cat: Asset["category"]) => {
  const prefix = { PC: "PC", スマートフォン: "SP", タブレット: "TB", 周辺機器: "PR", "USB・記憶媒体": "US", ネットワーク機器: "NW", "什器・備品": "FX", ソフトウェア: "SW", その他: "OT" }[cat];
  const n = Math.max(0, ...list.filter((a) => a.id.startsWith(prefix + "-")).map((a) => Number(a.id.split("-")[1]) || 0)) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
};

// ---------- 福利厚生 ----------
export const BENEFIT_CATEGORIES = ["福利厚生クラブ", "住宅・家賃補助", "通勤・各種手当", "慶弔見舞金", "健康・医療", "退職金・共済", "教育・研修・資格", "その他"] as const;
export type Benefit = { id: string; title: string; category: (typeof BENEFIT_CATEGORIES)[number]; summary: string; body: string; link?: string; contact?: string; updatedAt: string; updatedBy: string };
/** 雛形（金額・条件は入れていない。自社の規程に合わせて管理者が編集する） */
export const BENEFIT_TEMPLATES: Omit<Benefit, "id" | "updatedAt" | "updatedBy">[] = [
  { title: "福利厚生クラブ（外部サービス）", category: "福利厚生クラブ", summary: "宿泊・レジャー・飲食・育児介護などの割引サービス", body: "【自社の契約内容に合わせて編集してください】\n・サービス名／会員ID・パスワードの案内方法\n・利用できるメニュー\n・退職時の取扱い", contact: "管理部" },
  { title: "住宅手当・家賃補助", category: "住宅・家賃補助", summary: "対象者・支給額・申請方法", body: "【自社の賃金規程に合わせて編集してください】\n・対象（世帯主・賃貸住まい等）\n・支給額・支給月\n・必要書類（賃貸借契約書の写し等）\n・申請は「異動・変更届」から", contact: "管理部" },
  { title: "通勤手当", category: "通勤・各種手当", summary: "通勤経路の変更は届出が必要です", body: "【自社の賃金規程に合わせて編集してください】\n・支給の上限・算定方法\n・経路変更時は「異動・変更届」を提出", contact: "管理部" },
  { title: "慶弔見舞金", category: "慶弔見舞金", summary: "結婚・出産・傷病・弔事の際の給付", body: "【自社の慶弔規程に合わせて編集してください】\n・対象となる事由と金額\n・申請方法と必要書類", contact: "管理部" },
  { title: "健康診断・産業医面談", category: "健康・医療", summary: "年1回の定期健康診断（法定）", body: "【自社の運用に合わせて編集してください】\n・実施時期・受診場所\n・再検査・産業医面談の案内", contact: "管理部" },
  { title: "退職金・共済制度", category: "退職金・共済", summary: "中小企業退職金共済（中退共）等", body: "【自社の加入状況に合わせて編集してください】", contact: "管理部" },
];

// ---------- 保存期間（履歴の自動アーカイブ） ----------
export type Retention = { attendance: number; reports: number; mails: number; workflows: number; audit: number }; // 月数
export const DEFAULT_RETENTION: Retention = { attendance: 36, reports: 24, mails: 24, workflows: 36, audit: 60 };
export const RETENTION_LABEL: Record<keyof Retention, string> = { attendance: "勤怠（日別）", reports: "業務日報", mails: "問い合わせ（完了分）", workflows: "申請・承認（完了分）", audit: "監査ログ（コピーのみ・削除しない）" };
export function cutoffDate(today: string, months: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(Math.min(d, last))}`;
}

// ---------- IPアドレスの許可範囲（社内LAN・VPN） ----------
const ipToInt = (ip: string) => { const p = ip.split("."); return p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) < 256) ? ((Number(p[0]) << 24) | (Number(p[1]) << 16) | (Number(p[2]) << 8) | Number(p[3])) >>> 0 : null; };
export function isValidNet(net: string): boolean {
  const [ip, bits] = net.trim().split("/");
  return ipToInt(ip) !== null && (bits === undefined || (/^\d{1,2}$/.test(bits) && Number(bits) <= 32));
}
/** IPv4 が許可リスト（"192.168.1.0/24" や単独IP）のどれかに入るか。リストが空なら制限なし */
export function ipAllowed(ip: string, nets: string[]): boolean {
  if (nets.length === 0) return true;
  const v = ip.replace(/^::ffff:/, ""), n = ipToInt(v);
  if (n === null) return false;
  return nets.some((net) => {
    const [base, bits] = net.trim().split("/"), b = ipToInt(base);
    if (b === null) return false;
    const len = bits === undefined ? 32 : Number(bits), mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}
export { PRESIDENT_ID };
