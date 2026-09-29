// 架空の東証プライム上場企業「株式会社ミライホールディングス」の社内ポータル用シードデータ。
// 実在の企業・個人とは関係ありません。

export const COMPANY = {
  name: "株式会社ミライホールディングス",
  short: "ミライHD",
  market: "東証プライム",
  code: "0000",
};

export type Role = "employee" | "approver" | "admin";
export const ROLE_LABEL: Record<Role, string> = {
  employee: "一般社員",
  approver: "承認者（部長）",
  admin: "全社管理者",
};

export type Employee = {
  id: string;
  name: string;
  kana: string;
  dept: string;
  title: string;
  ext: string;
  email: string;
  location: string;
  joined: string;
  skills: string[];
};

export const DEPARTMENTS = [
  "経営企画部", "人事部", "総務部", "経理財務部", "法務・コンプライアンス部",
  "情報システム部", "営業本部", "海外事業部", "研究開発部", "生産技術部",
];

const raw: [string, string, string, string, string, string, string][] = [
  ["山田 太郎", "やまだ たろう", "経営企画部", "部長", "本社 18F", "2009-04-01", "中期経営計画,M&A"],
  ["佐藤 花子", "さとう はなこ", "人事部", "部長", "本社 15F", "2008-04-01", "採用,労務"],
  ["鈴木 一郎", "すずき いちろう", "総務部", "課長", "本社 14F", "2012-04-01", "施設管理,株主総会"],
  ["高橋 美咲", "たかはし みさき", "経理財務部", "部長", "本社 17F", "2010-04-01", "連結決算,IFRS"],
  ["田中 健", "たなか けん", "法務・コンプライアンス部", "部長", "本社 16F", "2007-04-01", "契約法務,内部統制"],
  ["伊藤 直樹", "いとう なおき", "情報システム部", "部長", "本社 13F", "2006-04-01", "基幹システム,情報セキュリティ"],
  ["渡辺 由美", "わたなべ ゆみ", "営業本部", "本部長", "大阪支社", "2005-04-01", "法人営業,アライアンス"],
  ["中村 大輔", "なかむら だいすけ", "海外事業部", "部長", "本社 19F", "2011-04-01", "北米,英語"],
  ["小林 さくら", "こばやし さくら", "研究開発部", "主任研究員", "つくば研究所", "2015-04-01", "AI,材料開発"],
  ["加藤 誠", "かとう まこと", "生産技術部", "課長", "名古屋工場", "2013-04-01", "生産管理,品質保証"],
  ["吉田 遥", "よしだ はるか", "人事部", "主任", "本社 15F", "2018-04-01", "研修企画,ダイバーシティ"],
  ["山本 拓也", "やまもと たくや", "営業本部", "主任", "本社 12F", "2017-04-01", "新規開拓,SaaS"],
  ["松本 恵", "まつもと めぐみ", "経理財務部", "担当", "本社 17F", "2021-04-01", "経費精算,支払"],
  ["井上 翔", "いのうえ しょう", "情報システム部", "担当", "本社 13F", "2020-04-01", "ヘルプデスク,ネットワーク"],
  ["木村 彩", "きむら あや", "海外事業部", "担当", "本社 19F", "2019-04-01", "中国語,貿易実務"],
  ["林 亮太", "はやし りょうた", "研究開発部", "研究員", "つくば研究所", "2022-04-01", "データ分析,Python"],
  ["清水 優", "しみず ゆう", "総務部", "担当", "本社 14F", "2023-04-01", "備品管理,受付"],
  ["山口 龍", "やまぐち りゅう", "生産技術部", "担当", "名古屋工場", "2016-04-01", "設備保全,安全衛生"],
  ["斎藤 真理", "さいとう まり", "法務・コンプライアンス部", "担当", "本社 16F", "2019-10-01", "個人情報保護,知財"],
  ["森 大和", "もり やまと", "経営企画部", "担当", "本社 18F", "2024-04-01", "IR,市場分析"],
];

export const EMPLOYEES: Employee[] = raw.map((r, i) => ({
  id: `E${String(1001 + i)}`,
  name: r[0],
  kana: r[1],
  dept: r[2],
  title: r[3],
  ext: String(2000 + i * 7 + 11),
  email: `${["yamada", "sato", "suzuki", "takahashi", "tanaka", "ito", "watanabe", "nakamura", "kobayashi", "kato", "yoshida", "yamamoto", "matsumoto", "inoue", "kimura", "hayashi", "shimizu", "yamaguchi", "saito", "mori"][i]}@mirai-hd.example`,
  location: r[4],
  joined: r[5],
  skills: r[6].split(","),
}));

// ログイン中ユーザー（デモ）
export const ME_ID = "E1012"; // 山本 拓也（営業本部 主任）
export const MANAGER_ID = "E1007"; // 渡辺 由美（営業本部 本部長）

export function empById(id: string) {
  return EMPLOYEES.find((e) => e.id === id);
}

// ---------- お知らせ ----------
export type NewsCategory = "全社" | "人事" | "IR" | "IT・セキュリティ" | "総務" | "コンプライアンス" | "イベント";
export const NEWS_CATEGORIES: NewsCategory[] = ["全社", "人事", "IR", "IT・セキュリティ", "総務", "コンプライアンス", "イベント"];

export type News = {
  id: string;
  title: string;
  body: string;
  category: NewsCategory;
  date: string;
  important: boolean;
  author: string;
};

export const NEWS_SEED: News[] = [
  { id: "n1", title: "【重要】2026年度 第2四半期 決算説明会（社内向け配信）のご案内", body: "10月30日（木）16:00より、経営陣による第2四半期決算の社内向け説明会をオンライン配信します。決算内容はインサイダー情報に該当する場合があるため、公表前の社外への共有は厳禁です。視聴URLは社内ポータルの「イベント」から確認してください。", category: "IR", date: "2026-09-26", important: true, author: "経営企画部" },
  { id: "n2", title: "【必須】情報セキュリティ eラーニング受講期限（10月15日）", body: "全社員を対象とした年次の情報セキュリティ研修の受講期限が近づいています。未受講の方は「研修」ページから受講してください。期限を過ぎた場合は所属長へ通知されます。", category: "IT・セキュリティ", date: "2026-09-25", important: true, author: "情報システム部" },
  { id: "n3", title: "2026年10月1日付 組織変更・人事異動のお知らせ", body: "10月1日付で海外事業部に「アジア推進室」を新設します。詳細な異動者リストは「社員名簿」の組織図に反映済みです。", category: "人事", date: "2026-09-24", important: false, author: "人事部" },
  { id: "n3b", title: "標的型メールにご注意ください（取引先を装った添付ファイル）", body: "取引先を装い、パスワード付きZIPを添付する不審メールが確認されています。開封せず、情報セキュリティ窓口（内線2999）へ転送のうえ削除してください。", category: "IT・セキュリティ", date: "2026-09-22", important: true, author: "情報システム部" },
  { id: "n4", title: "本社ビル 定期電気設備点検に伴う停電（10月12日 日曜）", body: "10月12日（日）8:00〜18:00、法定点検のため本社ビル全館が停電します。休日出勤の予定がある場合は事前に総務部へご相談ください。", category: "総務", date: "2026-09-20", important: false, author: "総務部" },
  { id: "n5", title: "ハラスメント相談窓口（社内・社外）の連絡先を更新しました", body: "社外の専門機関による相談窓口を追加しました。相談者のプライバシーは厳守され、相談したことによる不利益な取り扱いは禁止されています。", category: "コンプライアンス", date: "2026-09-18", important: false, author: "法務・コンプライアンス部" },
  { id: "n6", title: "全社キックオフ「Mirai Day 2026」参加者募集", body: "11月14日（金）、東京国際フォーラムにて全社キックオフを開催します。現地参加とオンライン参加を選べます。10月10日までに参加登録をお願いします。", category: "イベント", date: "2026-09-16", important: false, author: "経営企画部" },
  { id: "n7", title: "経費精算システムのアップデート（領収書AI読み取りの精度向上）", body: "10月1日から、領収書の自動読み取りに新エンジンを導入します。インボイス制度に対応した登録番号の検証機能も追加されます。", category: "全社", date: "2026-09-12", important: false, author: "経理財務部" },
  { id: "n8", title: "在宅勤務制度の一部改定（月10日 → 月12日）", body: "2026年10月より、在宅勤務の上限を月10日から月12日に引き上げます。詳細は文書ライブラリの「在宅勤務規程（改定第4版）」を参照してください。", category: "人事", date: "2026-09-08", important: false, author: "人事部" },
];

// ---------- 文書 ----------
export type Doc = { id: string; title: string; kind: "規程" | "マニュアル" | "様式" | "ガイドライン"; owner: string; revised: string; version: string; summary: string; tags: string[] };
export const DOCS: Doc[] = [
  { id: "d1", title: "就業規則", kind: "規程", owner: "人事部", revised: "2026-04-01", version: "第12版", summary: "労働時間・休日・休暇・服務規律・懲戒に関する基本規程。", tags: ["勤務", "休暇", "服務"] },
  { id: "d2", title: "在宅勤務規程", kind: "規程", owner: "人事部", revised: "2026-09-08", version: "改定第4版", summary: "在宅勤務の対象者、申請方法、上限日数（月12日）、機器貸与に関する規程。", tags: ["在宅", "テレワーク"] },
  { id: "d3", title: "旅費規程", kind: "規程", owner: "経理財務部", revised: "2025-10-01", version: "第7版", summary: "国内・海外出張の日当、宿泊費上限、交通機関のクラス等を定める。", tags: ["出張", "経費"] },
  { id: "d4", title: "経費精算マニュアル", kind: "マニュアル", owner: "経理財務部", revised: "2026-09-12", version: "v3.2", summary: "領収書の取り扱い、インボイス対応、精算締め日と承認フロー。", tags: ["経費", "インボイス"] },
  { id: "d5", title: "情報セキュリティ基本方針", kind: "ガイドライン", owner: "情報システム部", revised: "2026-01-15", version: "第6版", summary: "情報資産の分類、パスワード、私物端末、クラウド利用の遵守事項。", tags: ["セキュリティ", "ISMS"] },
  { id: "d6", title: "インサイダー取引防止規程", kind: "規程", owner: "法務・コンプライアンス部", revised: "2025-12-01", version: "第5版", summary: "重要事実の管理、自社株売買の事前届出、売買禁止期間を定める。", tags: ["IR", "コンプライアンス"] },
  { id: "d7", title: "反社会的勢力対応マニュアル", kind: "マニュアル", owner: "法務・コンプライアンス部", revised: "2025-06-01", version: "第3版", summary: "取引開始時の確認、契約書の暴排条項、発見時のエスカレーション手順。", tags: ["取引", "コンプライアンス"] },
  { id: "d8", title: "稟議規程・決裁権限表", kind: "規程", owner: "経営企画部", revised: "2026-04-01", version: "第9版", summary: "案件金額別の決裁者と承認ルート。100万円未満は部長、1,000万円以上は取締役会。", tags: ["稟議", "権限"] },
  { id: "d9", title: "休暇申請書（様式）", kind: "様式", owner: "人事部", revised: "2025-04-01", version: "様式1", summary: "年次有給・特別休暇の申請様式。ワークフローからの電子申請を推奨。", tags: ["休暇"] },
  { id: "d10", title: "個人情報取扱ガイドライン", kind: "ガイドライン", owner: "法務・コンプライアンス部", revised: "2026-03-01", version: "第4版", summary: "個人情報保護法に基づく取得・利用・委託・漏えい時対応。", tags: ["個人情報", "法令"] },
  { id: "d11", title: "BCP（事業継続計画）行動マニュアル", kind: "マニュアル", owner: "総務部", revised: "2026-02-01", version: "第3版", summary: "大規模地震・システム障害時の安否確認と参集基準、代替拠点。", tags: ["防災", "BCP"] },
  { id: "d12", title: "ワークフロー操作ガイド", kind: "マニュアル", owner: "情報システム部", revised: "2026-05-20", version: "v2.0", summary: "各種申請の入力方法、代理承認、差戻し時の対応を画面つきで解説。", tags: ["申請", "ワークフロー"] },
];

// ---------- 研修 ----------
export type Course = { id: string; title: string; category: string; minutes: number; required: boolean; due?: string; progress: number };
export const COURSES: Course[] = [
  { id: "c1", title: "情報セキュリティ 2026年度版", category: "コンプライアンス", minutes: 30, required: true, due: "2026-10-15", progress: 40 },
  { id: "c2", title: "インサイダー取引防止", category: "コンプライアンス", minutes: 20, required: true, due: "2026-11-30", progress: 0 },
  { id: "c3", title: "ハラスメント防止（管理職・一般）", category: "コンプライアンス", minutes: 25, required: true, due: "2026-12-15", progress: 100 },
  { id: "c4", title: "個人情報保護の基礎", category: "コンプライアンス", minutes: 20, required: true, due: "2026-10-31", progress: 100 },
  { id: "c5", title: "ロジカルシンキング入門", category: "ビジネススキル", minutes: 90, required: false, progress: 15 },
  { id: "c6", title: "財務諸表の読み方", category: "ビジネススキル", minutes: 120, required: false, progress: 0 },
  { id: "c7", title: "生成AI活用ガイド（業務利用の注意点）", category: "DX", minutes: 45, required: false, progress: 60 },
  { id: "c8", title: "ビジネス英語 Level 2", category: "語学", minutes: 180, required: false, progress: 0 },
];

// ---------- 会議室 ----------
export const ROOMS = [
  { id: "r1", name: "本社 12F 大会議室 A", cap: 20, floor: "12F", equip: ["プロジェクタ", "Web会議", "ホワイトボード"] },
  { id: "r2", name: "本社 12F 会議室 B", cap: 8, floor: "12F", equip: ["モニタ", "Web会議"] },
  { id: "r3", name: "本社 13F 会議室 C", cap: 6, floor: "13F", equip: ["モニタ"] },
  { id: "r4", name: "本社 15F 面談室 1", cap: 4, floor: "15F", equip: ["防音"] },
  { id: "r5", name: "本社 19F 役員会議室", cap: 14, floor: "19F", equip: ["プロジェクタ", "Web会議"] },
  { id: "r6", name: "オンライン専用ブース", cap: 1, floor: "12F", equip: ["Web会議"] },
];
export const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// ---------- FAQ ----------
export const FAQ = [
  { q: "パスワードを忘れました。どうすればよいですか？", a: "ポータルのログイン画面「パスワードを再設定」から本人確認（多要素認証）のうえ再設定できます。アカウントがロックされた場合はヘルプデスク（内線2999）へ。", cat: "IT" },
  { q: "私物のスマートフォンで会社のメールを見てもよいですか？", a: "MDM（モバイル端末管理）に登録した端末のみ利用できます。情報システム部の「私物端末利用申請」を提出してください。", cat: "IT" },
  { q: "有給休暇の残日数はどこで確認できますか？", a: "「勤怠」ページの休暇残高で確認できます。付与日と時効（2年）も表示されます。", cat: "人事" },
  { q: "出産・育児に関する制度を教えてください。", a: "産前産後休業、育児休業（最長2歳まで）、短時間勤務、子の看護休暇があります。詳細は就業規則および人事部の制度ガイドを参照してください。", cat: "人事" },
  { q: "領収書を紛失した場合の経費精算は？", a: "「領収書紛失理由書」を添付のうえ申請してください。1万円以上は原則認められないため、事前に経理財務部へ相談してください。", cat: "経理" },
  { q: "取引先から接待を受けてよいですか？", a: "社会通念上の範囲（1人あたり5,000円程度）を超える接待・贈答は、コンプライアンス部へ事前に相談・届出が必要です。公務員等は一切不可です。", cat: "コンプライアンス" },
  { q: "自社株を売買する際の手続きは？", a: "インサイダー取引防止規程に基づき、事前に法務・コンプライアンス部へ届出が必要です。決算前後の売買禁止期間にご注意ください。", cat: "コンプライアンス" },
  { q: "地震などの災害時に安否確認はどう行われますか？", a: "震度5強以上で安否確認メールが自動配信されます。30分以内に返信してください。返信がない場合は所属長に通知されます。", cat: "総務" },
];

// ---------- ワークフロー ----------
export type WfType = "経費精算" | "休暇申請" | "出張申請" | "稟議" | "IT機器・アカウント申請";
export const WF_TYPES: { type: WfType; desc: string }[] = [
  { type: "経費精算", desc: "交通費・接待交際費・立替金などの精算" },
  { type: "休暇申請", desc: "年次有給休暇、特別休暇、振替休日" },
  { type: "出張申請", desc: "国内・海外出張の事前申請" },
  { type: "稟議", desc: "契約・投資・購買などの決裁申請" },
  { type: "IT機器・アカウント申請", desc: "PC・ソフトウェア・アクセス権の申請" },
];
export type WfStatus = "承認待ち" | "承認済" | "差戻し" | "却下" | "取下げ";
export type WfStep = { approverId: string; label: string; state: "待機" | "承認待ち" | "承認" | "差戻し" | "却下"; at?: string; comment?: string };
export type Workflow = {
  id: string;
  type: WfType;
  title: string;
  applicantId: string;
  amount?: number;
  detail: string;
  createdAt: string;
  status: WfStatus;
  steps: WfStep[];
};

export const WF_SEED: Workflow[] = [
  { id: "WF-2026-0412", type: "経費精算", title: "9月 顧客訪問 交通費・会食費", applicantId: "E1012", amount: 48620, detail: "大阪・名古屋 顧客訪問（新幹線・タクシー）および会食1件（5,000円/人×3名）", createdAt: "2026-09-27", status: "承認待ち", steps: [{ approverId: "E1007", label: "所属長", state: "承認待ち" }, { approverId: "E1004", label: "経理財務部", state: "待機" }] },
  { id: "WF-2026-0409", type: "休暇申請", title: "年次有給休暇 10/20〜10/21", applicantId: "E1012", detail: "私用のため。担当案件は佐藤様に引き継ぎ済み。", createdAt: "2026-09-24", status: "承認済", steps: [{ approverId: "E1007", label: "所属長", state: "承認", at: "2026-09-25", comment: "承認します。" }] },
  { id: "WF-2026-0402", type: "稟議", title: "営業支援SaaS導入（年額 4,800,000円）", applicantId: "E1007", amount: 4800000, detail: "商談管理の統一とレポート自動化のため。3社比較の結果、A社を選定。", createdAt: "2026-09-20", status: "承認待ち", steps: [{ approverId: "E1007", label: "起案部門長", state: "承認", at: "2026-09-20" }, { approverId: "E1006", label: "情報システム部（セキュリティ審査）", state: "承認待ち" }, { approverId: "E1004", label: "経理財務部", state: "待機" }, { approverId: "E1001", label: "経営企画部", state: "待機" }] },
  { id: "WF-2026-0398", type: "出張申請", title: "シンガポール出張 11/4〜11/7", applicantId: "E1008", amount: 385000, detail: "現地パートナーとの契約交渉。航空券（ビジネス）・ホテル3泊。", createdAt: "2026-09-18", status: "承認待ち", steps: [{ approverId: "E1007", label: "所属長", state: "承認待ち" }, { approverId: "E1004", label: "経理財務部", state: "待機" }] },
  { id: "WF-2026-0391", type: "IT機器・アカウント申請", title: "ノートPC 更新（3年経過）", applicantId: "E1012", detail: "現行機のバッテリー劣化により交換希望。", createdAt: "2026-09-10", status: "差戻し", steps: [{ approverId: "E1007", label: "所属長", state: "差戻し", at: "2026-09-11", comment: "資産管理番号を追記してください。" }] },
];
