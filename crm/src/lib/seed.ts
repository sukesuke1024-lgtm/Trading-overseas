import type { Activity, ActivityType, Contact, Data, Deal, Organization, StageId, Task } from "./types";
import { addDays, isoAt, todayStr } from "./dates";
import { stageOf } from "./constants";

export const DATA_VERSION = 1;

// 海外事業（日本産食品の輸出）を題材にしたデモデータ。社名・氏名はすべて架空。日付は「今日」基準で毎回新鮮に見えるよう生成する。
export function makeSeed(): Data {
  const t = todayStr();
  const d = (n: number) => addDays(t, n);

  const teams = [{ id: "t1", name: "海外営業チーム" }];
  const users: Data["users"] = [
    { id: "u1", name: "山田 恒一", email: "yamada@example.com", role: "admin", teamId: "t1", title: "代表取締役", hue: 215 },
    { id: "u2", name: "佐藤 美咲", email: "sato@example.com", role: "manager", teamId: "t1", title: "海外営業部 部長", hue: 160 },
    { id: "u3", name: "田中 蓮", email: "tanaka@example.com", role: "sales", teamId: "t1", title: "海外営業（東南アジア）", hue: 28 },
    { id: "u4", name: "鈴木 彩", email: "suzuki@example.com", role: "sales", teamId: "t1", title: "海外営業（北米・中東）", hue: 330 },
    { id: "u5", name: "李 浩然", email: "li@example.com", role: "sales", teamId: "t1", title: "海外営業（中華圏・韓国）", hue: 270 },
  ];

  const org = (id: string, name: string, country: string, city: string, segment: Organization["segment"], industry: string, source: Organization["source"], ownerId: string, url: string, memo: string, created: number): Organization =>
    ({ id, name, country, city, address: `${city}, ${country}`, segment, industry, source, ownerId, url, memo, createdAt: isoAt(created) });

  const organizations: Organization[] = [
    org("o1", "Lion City Fine Foods Pte. Ltd.", "シンガポール", "Singapore", "importer", "高級食材の輸入・卸", "展示会", "u3", "https://example.com/lioncity", "ホテル・高級レストラン向けに和牛を月次で輸入。コンテナ単位の定期取引を検討。", 160),
    org("o2", "Harbour & Co. Provisions", "香港", "Hong Kong", "distributor", "水産・食肉ディストリビューター", "紹介", "u5", "https://example.com/harbour", "水産の冷凍帯が強い。決済は L/C 希望のことが多い。", 140),
    org("o3", "Siam Gourmet Trading Co., Ltd.", "タイ", "Bangkok", "trading", "日本食材専門商社", "商談会", "u3", "https://example.com/siam", "日本食レストラン約120店舗に納入。青果・調味料に関心。", 120),
    org("o4", "Saigon Fresh Imports", "ベトナム", "Ho Chi Minh City", "importer", "青果・果物の輸入", "Web問い合わせ", "u3", "https://example.com/saigon", "いちご・柑橘。検疫（植物防疫）の条件確認が必要。", 45),
    org("o5", "Pacific Rim Provisions LLC", "米国", "Los Angeles", "distributor", "アジア食品ディストリビューター", "展示会", "u4", "https://example.com/pacificrim", "西海岸の日系・和食レストラン向け。酒類は別ライセンス保有。", 200),
    org("o6", "Al Noor Gourmet FZE", "UAE", "Dubai", "importer", "高級食材・ホテル向け", "紹介", "u4", "https://example.com/alnoor", "ハラール対応が必須。和牛はハラール屠畜の証明を要求。", 90),
    org("o7", "Taipei Umami Distribution", "台湾", "Taipei", "distributor", "日本食品の卸", "既存顧客", "u5", "https://example.com/umami", "既存取引あり。リピート発注と新商品の提案が中心。", 400),
    org("o8", "Kuala Select Sdn Bhd", "マレーシア", "Kuala Lumpur", "retailer", "高級スーパー（12店舗）", "展示会", "u3", "https://example.com/kualaselect", "日本フェア企画を検討。茶・菓子・調味料。", 75),
    org("o9", "Seoul Table Co., Ltd.", "韓国", "Seoul", "restaurant", "日本料理チェーン", "アウトバウンド", "u5", "https://example.com/seoultable", "水産の仕入れを一本化したい意向。", 30),
    org("o10", "Bluewater Seafood Imports Pty Ltd", "オーストラリア", "Sydney", "importer", "水産物の輸入", "紹介", "u4", "https://example.com/bluewater", "ホタテ・ブリ。年末需要の前倒し相談。", 110),
    org("o11", "Rhein Feinkost GmbH", "ドイツ", "Düsseldorf", "retailer", "日本食専門店・EC", "Web問い合わせ", "u4", "https://example.com/rhein", "日本酒・抹茶。EU の食品表示・輸入要件が論点。", 25),
    org("o12", "Jakarta Prime Foods", "インドネシア", "Jakarta", "ecommerce", "プレミアム食品EC", "アウトバウンド", "u3", "https://example.com/jprime", "ハラール認証の有無が前提。小ロットのテスト輸入から。", 18),
    org("o13", "東和フーズトレーディング", "日本", "東京", "trading", "国内商社（輸出代行）", "既存顧客", "u2", "https://example.com/towa", "国内の輸出代行パートナー。共同提案の窓口。", 300),
  ];

  const con = (id: string, orgId: string, name: string, department: string, title: string, email: string, phone: string, primary: boolean, dm: boolean, note = ""): Contact =>
    ({ id, orgId, name, department, title, email, phone, isPrimary: primary, isDecisionMaker: dm, note });
  const contacts: Contact[] = [
    con("c1", "o1", "Daniel Tan", "Purchasing", "Head of Procurement", "daniel.tan@example.com", "+65 6000 0001", true, true, "英語。朝9時台が連絡しやすい"),
    con("c2", "o1", "Priya Nair", "Operations", "Logistics Manager", "priya.nair@example.com", "+65 6000 0002", false, false),
    con("c3", "o2", "Kelvin Wong", "Trading", "Director", "kelvin.wong@example.com", "+852 6000 0003", true, true, "WeChat 可。L/C の経験が豊富"),
    con("c4", "o3", "Somchai Prasert", "Import", "Managing Director", "somchai@example.com", "+66 80 000 0004", true, true),
    con("c5", "o3", "Ploy Wattana", "Purchasing", "Buyer（青果・調味料）", "ploy@example.com", "+66 80 000 0005", false, false, "日本語が少し話せる"),
    con("c6", "o4", "Nguyen Minh Anh", "Import", "Procurement Manager", "minhanh@example.com", "+84 90 000 0006", true, false, "決裁は社長（Tran氏）"),
    con("c7", "o5", "Jennifer Cho", "Sales", "VP Sales", "jennifer.cho@example.com", "+1 310 000 0007", true, true),
    con("c8", "o5", "Mark Ellis", "Purchasing", "Category Manager（酒類）", "mark.ellis@example.com", "+1 310 000 0008", false, false),
    con("c9", "o6", "Omar Al-Farsi", "Purchasing", "General Manager", "omar@example.com", "+971 50 000 0009", true, true, "ハラール証明の原本を重視"),
    con("c10", "o7", "Vivian Lin", "Purchasing", "Senior Buyer", "vivian.lin@example.com", "+886 2 0000 0010", true, false),
    con("c11", "o7", "Jason Chen", "Management", "CEO", "jason.chen@example.com", "+886 2 0000 0011", false, true),
    con("c12", "o8", "Aisha Rahman", "Merchandising", "Merchandising Manager", "aisha@example.com", "+60 12 000 0012", true, true),
    con("c13", "o9", "Park Ji-ho", "Procurement", "Head of Procurement", "jiho.park@example.com", "+82 10 0000 0013", true, true),
    con("c14", "o10", "Oliver Grant", "Buying", "Buying Manager", "oliver.grant@example.com", "+61 400 000 014", true, true),
    con("c15", "o11", "Lena Hoffmann", "Einkauf", "Inhaberin", "lena@example.com", "+49 211 0000 15", true, true, "英語・ドイツ語"),
    con("c16", "o12", "Rizky Pratama", "Business Dev", "Business Development Lead", "rizky@example.com", "+62 811 000 0016", true, false),
    con("c17", "o13", "高橋 誠", "輸出事業部", "課長", "takahashi@example.com", "03-0000-0017", true, true),
  ];

  const mk = (id: string, name: string, orgId: string, contactId: string | null, ownerId: string, amount: number, currency: Deal["currency"], stage: StageId, closeIn: number | null, product: string, created: number, stageAgo: number, lostReason = "", memo = ""): Deal => {
    const st = stageOf(stage);
    return {
      id, name, orgId, contactId, ownerId, amount, currency, stage, probability: st.probability, expectedCloseDate: closeIn === null ? null : d(closeIn),
      lostReason, product, memo, createdAt: isoAt(created), stageChangedAt: isoAt(stageAgo), closedAt: st.kind === "won" || st.kind === "lost" ? isoAt(stageAgo) : null,
    };
  };
  const deals: Deal[] = [
    mk("d1", "和牛A5 月次コンテナ定期輸入", "o1", "c1", "u3", 48000, "SGD", "negotiation", 12, "和牛・精肉", 80, 3, "", "月1コンテナ（冷凍・約5トン）。価格は為替連動の条項を相談中。"),
    mk("d2", "冷凍ホタテ・ブリ 年末向け", "o2", "c3", "u5", 62000, "USD", "quotation", 20, "水産物・冷凍", 50, 6, "", "PI 提出済み。L/C 条件の回答待ち。"),
    mk("d3", "日本食レストラン向け 調味料セット", "o3", "c5", "u3", 18500, "USD", "proposal", 35, "調味料・加工食品", 40, 9),
    mk("d4", "いちご・柑橘 テスト輸入", "o4", "c6", "u3", 9800, "USD", "hearing", 50, "青果・果物", 30, 5, "", "植物防疫の条件を確認してから見積。"),
    mk("d5", "日本酒 西海岸ディストリビューション", "o5", "c8", "u4", 54000, "USD", "proposal", 30, "日本酒・焼酎", 70, 12),
    mk("d6", "和牛（ハラール対応）ホテル向け", "o6", "c9", "u4", 38000, "USD", "hearing", 45, "和牛・精肉", 35, 18, "", "ハラール屠畜の証明が取れる生産者を確認中。"),
    mk("d7", "抹茶・煎茶 リピート発注（Q4）", "o7", "c10", "u5", 3200000, "JPY", "negotiation", 8, "茶・抹茶", 60, 2, "", "既存取引。数量増の相談。"),
    mk("d8", "日本フェア企画 茶・菓子・調味料", "o8", "c12", "u3", 24000, "USD", "quotation", 25, "複数カテゴリー", 55, 4),
    mk("d9", "水産物 一本化仕入れ", "o9", "c13", "u5", 8500000, "JPY", "contact", 60, "水産物・冷凍", 20, 8),
    mk("d10", "ホタテ 年末前倒し", "o10", "c14", "u4", 41000, "AUD", "proposal", 28, "水産物・冷凍", 48, 7),
    mk("d11", "日本酒・抹茶 EC向け小ロット", "o11", "c15", "u4", 6800, "EUR", "lead", 70, "日本酒・焼酎", 10, 10, "", "EU の表示要件を先に整理する。"),
    mk("d12", "プレミアム食品 テスト輸入", "o12", "c16", "u3", 5200, "USD", "lead", 80, "調味料・加工食品", 14, 14),
    mk("d13", "米・日本酒 共同提案（輸出代行）", "o13", "c17", "u2", 5600000, "JPY", "hold", 90, "複数カテゴリー", 120, 30, "", "先方の社内体制が整うまで保留。来月再開予定。"),
    // 受注・失注（Customer 360 の「過去案件」・実績表示用）
    mk("d14", "和牛A5 スポット（9月便）", "o1", "c1", "u3", 21000, "SGD", "won", null, "和牛・精肉", 120, 22),
    mk("d15", "抹茶 Q3 発注", "o7", "c10", "u5", 2600000, "JPY", "won", null, "茶・抹茶", 130, 40),
    mk("d16", "冷凍ブリ トライアル", "o2", "c3", "u5", 14000, "USD", "won", null, "水産物・冷凍", 110, 60),
    mk("d17", "和牛 ミニマム提案", "o5", "c7", "u4", 33000, "USD", "lost", null, "和牛・精肉", 150, 70, "価格が合わない", "競合の米国産和牛との価格差が埋まらず。"),
    mk("d18", "青果 試験輸送", "o3", "c4", "u3", 7400, "USD", "won", null, "青果・果物", 100, 35),
  ];

  let aid = 0;
  const act = (type: ActivityType, orgId: string, contactId: string | null, dealId: string | null, userId: string, ago: number, summary: string, note = "", hour = 11): Activity =>
    ({ id: `a${++aid}`, type, orgId, contactId, dealId, userId, at: isoAt(ago, hour, (aid * 7) % 60), summary, note });
  const activities: Activity[] = [
    act("online", "o1", "c1", "d1", "u3", 1, "価格条件の最終打合せ（Online）", "為替連動条項（±3%で改定）を提案。Daniel は前向き。社内承認に1週間。", 9),
    act("email", "o1", "c2", "d1", "u3", 4, "物流条件の確認メール", "Priya から冷凍コンテナの受入枠について回答。"),
    act("visit", "o1", "c1", "d1", "u3", 18, "現地訪問・ショールーム確認", "取扱い商品の陳列、既存の仕入れ先を確認。", 15),
    act("expo", "o1", "c1", "d1", "u3", 160, "Food Expo で名刺交換", "和牛の月次輸入に関心。後日 Online を設定。", 14),
    act("quote", "o2", "c3", "d2", "u5", 6, "PI（見積）を提出", "ホタテ 6t／ブリ 4t、CIF Hong Kong。支払条件は L/C at sight 希望。"),
    act("call", "o2", "c3", "d2", "u5", 9, "条件のすり合わせ電話", "決済は L/C。為替ヘッジについて質問あり。", 16),
    act("referral", "o2", "c3", null, "u5", 140, "既存取引先からの紹介", "香港の水産ディストリビューターを紹介いただいた。"),
    act("material", "o3", "c5", "d3", "u3", 9, "調味料セットの資料とサンプル発送", "EMS で5種のサンプルを発送。到着は3日後の見込み。"),
    act("online", "o3", "c4", "d3", "u3", 20, "Somchai 氏と Online ミーティング", "120店舗への展開イメージを共有。まずは調味料から。"),
    act("email", "o4", "c6", "d4", "u3", 5, "検疫条件の確認依頼", "植物防疫（果実の輸入許可）の要件を確認いただくよう依頼。"),
    act("online", "o4", "c6", "d4", "u3", 28, "初回ヒアリング（Online）", "いちご・みかんのテスト輸入。決裁は社長。"),
    act("visit", "o5", "c7", "d5", "u4", 12, "ロサンゼルス訪問（Jennifer 氏）", "店頭・倉庫を確認。酒類の別ライセンスあり。", 14),
    act("email", "o5", "c8", "d5", "u4", 15, "日本酒5銘柄のスペックシート送付", "", 9),
    act("call", "o5", "c7", "d5", "u4", 40, "ライセンス要件の確認", "", 8),
    act("online", "o6", "c9", "d6", "u4", 18, "ハラール要件のヒアリング", "屠畜施設のハラール証明書（原本）が必須。"),
    act("email", "o6", "c9", "d6", "u4", 26, "初回提案資料の送付", "", 10),
    act("call", "o7", "c10", "d7", "u5", 2, "Q4 発注数量の相談", "前期比 +20% を希望。価格据置の可否を確認中。", 10),
    act("email", "o7", "c11", "d7", "u5", 7, "新商品（ほうじ茶）の案内", "", 9),
    act("visit", "o8", "c12", "d8", "u3", 4, "KL 本社訪問・フェア企画打合せ", "11月開催案。陳列什器の仕様を確認。", 14),
    act("quote", "o8", "c12", "d8", "u3", 8, "見積を提出（フェア用 商品セット）", ""),
    act("email", "o9", "c13", "d9", "u5", 8, "初回の問い合わせ返信", "水産の仕入れ一本化に関心。取扱い魚種の一覧を送付。"),
    act("call", "o10", "c14", "d10", "u4", 7, "年末の前倒し需要について", "ホタテ 3t を12月初旬に希望。"),
    act("email", "o11", "c15", "d11", "u4", 10, "Web フォームへの返信", "日本酒・抹茶の小ロット。EU 表示要件を確認中。"),
    act("email", "o12", "c16", "d12", "u3", 14, "初回アプローチ（Email）", "返信待ち。"),
    act("call", "o13", "c17", "d13", "u2", 30, "状況確認の電話", "社内体制が整うまで保留。来月に再連絡。"),
    act("email", "o1", "c1", "d14", "u3", 22, "9月便の出荷完了連絡", ""),
    act("email", "o7", "c10", "d15", "u5", 40, "Q3 発注の受注確認", ""),
    act("call", "o5", "c7", "d17", "u4", 70, "失注の連絡を受ける", "米国産和牛との価格差。条件再提案の余地は小さい。"),
  ];

  let tid = 0;
  const task = (title: string, type: ActivityType, orgId: string | null, dealId: string | null, contactId: string | null, assigneeId: string, due: number | null, next = true, done = false): Task =>
    ({ id: `k${++tid}`, title, type, orgId, dealId, contactId, assigneeId, dueDate: due === null ? null : d(due), status: done ? "done" : "open", isNextAction: next, createdAt: isoAt(3), doneAt: done ? isoAt(1) : null });
  const tasks: Task[] = [
    // 各進行案件の Next Action（1案件につき未完了の Next Action は最大1件）
    task("為替連動条項の社内承認を確認し、契約ドラフトを送る", "email", "o1", "d1", "c1", "u3", 2),
    task("L/C 条件の回答を確認し、ホタテの在庫を押さえる", "call", "o2", "d2", "c3", "u5", -1),
    task("サンプル到着の確認と感想ヒアリング", "call", "o3", "d3", "c5", "u3", 0),
    task("植物防疫の要件回答を受けて見積を作成", "quote", "o4", "d4", "c6", "u3", -3),
    task("日本酒 5銘柄の試飲サンプルを発送", "material", "o5", "d5", "c8", "u4", 3),
    task("ハラール屠畜の対応可能な生産者に証明書を依頼", "email", "o6", "d6", "c9", "u4", 5),
    task("数量増に対する価格回答（据置案）を提示", "call", "o7", "d7", "c10", "u5", 0),
    task("見積の回答確認と、フェア日程の最終確認（Online）", "online", "o8", "d8", "c12", "u3", 2),
    task("取扱い魚種と価格表を送り、Online を設定", "email", "o9", "d9", "c13", "u5", 1),
    task("年末向け ホタテ 3t の見積案内", "quote", "o10", "d10", "c14", "u4", 4),
    task("EU 向け表示要件（ラベル）を整理して回答", "email", "o11", "d11", "c15", "u4", 6),
    task("初回アプローチへの返信を催促（フォローアップ）", "email", "o12", "d12", "c16", "u3", 1),
    // 保留案件も「再開の確認」を Next Action として持たせる
    task("再開の確認電話", "call", "o13", "d13", "c17", "u2", 25),
    // 単独 Task
    task("来月の Food Expo の訪問アポ依頼リストを作成", "other", null, null, null, "u3", 3, false),
    task("Pacific Rim の価格表（2026年版）を更新", "other", "o5", null, null, "u4", 0, false),
    task("香港出張の訪問先調整", "other", "o2", null, null, "u5", 7, false),
    task("【完了】Lion City 見積書の再送", "email", "o1", "d1", "c1", "u3", -2, false, true),
  ];
  // d12 は Next Action を意図的に未設定にする（「Next Action 未設定」警告の表示確認用デモ）
  tasks.splice(tasks.findIndex((x) => x.dealId === "d12"), 1);

  return { version: DATA_VERSION, teams, users, organizations, contacts, deals, activities, tasks, audit: [] };
}
