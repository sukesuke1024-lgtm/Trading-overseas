// 与信審査（取引先の信用力の評価）。大手商社・海外取引のある企業で一般に行われる与信管理の考え方を、
// 「誰が見ても同じ結論になる」透明な計算に落としたもの（純関数）。
//  ・定量（財務）＋定性（信用情報・取引実績・属性）＋コンプライアンスで100点満点 → 社内格付 S/A/B/C/D（重大な懸念は NG）
//  ・情報が足りない項目は中立点にし、「情報充足度」を表示（足りないまま高格付けにしない＝ブラックボックスを作らない）
//  ・国別リスクで格付けと取引条件に上限をかける
//  ・限度額＝純資産基準・月商基準の小さいほう × 国別係数 ＋ 保険・保全でカバーされる額
//  ・格付け × 国別リスクで、許容できる決済条件と必要な保全策を決める
// 点数・係数・PD は「社内の暫定ルール」。実運用では自社の実績・審査会で見直すこと（公的な統計値ではない）。

export type Rating = "S" | "A" | "B" | "C" | "D" | "NG";
export type CountryRank = "A" | "B" | "C" | "D" | "E";
export type PayKey = "advance" | "partial" | "lc" | "dp" | "da" | "oa";
export type Tri = "ok" | "cond" | "ng";

export interface CreditInput {
  // 財務（わかる範囲で。空欄は「不明」として中立点）
  equityRatio: number | null;        // 自己資本比率（%）
  currentRatio: number | null;       // 流動比率（%）
  ordinaryMargin: number | null;     // 売上高経常利益率（%）
  revenueGrowth: number | null;      // 売上成長率（%）
  debtToSalesMonths: number | null;  // 有利子負債の月商倍率（か月）
  netWorthJPY: number | null;        // 純資産（円換算）
  annualRevenueJPY: number | null;   // 年商（円換算）
  // 信用情報・取引実績
  paymentRecord: "excellent" | "good" | "slow" | "delinquent" | "unknown";
  externalScore: number | null;      // 外部信用調査会社の評点（0〜100 に換算した値）
  yearsInBusiness: number | null;
  history: "none" | "under1" | "1to3" | "over3";   // 当社との取引実績
  management: 1 | 2 | 3 | 4 | 5 | null;            // 経営者・体制の評価（5が良い）
  industryRisk: 1 | 2 | 3 | 4 | 5 | null;          // 業種リスク（1が低い）
  // コンプライアンス（確認できたか）
  registryVerified: boolean;         // 現地の商業登記等で実在・代表者を確認
  ownerVerified: boolean;            // 実質的支配者（UBO）を確認
  sanctions: "clear" | "hit" | "notDone";          // 制裁リスト照会
  antiSocial: "clear" | "hit" | "notDone";         // 反社・不正関与の確認
  adverseNews: "none" | "minor" | "serious" | "notChecked";   // 訴訟・不祥事の報道
  // 国
  countryRank: CountryRank;
  // 保全
  insuredJPY: number;                // 貿易保険・取引信用保険の付保額（円）
  insuredRate: number;               // 付保率（%、例 90）
  securedJPY: number;                // 前払い・確認付L/C・保証など、保全済みの額（円）
}

export const EMPTY_INPUT: CreditInput = {
  equityRatio: null, currentRatio: null, ordinaryMargin: null, revenueGrowth: null, debtToSalesMonths: null, netWorthJPY: null, annualRevenueJPY: null,
  paymentRecord: "unknown", externalScore: null, yearsInBusiness: null, history: "none", management: null, industryRisk: null,
  registryVerified: false, ownerVerified: false, sanctions: "notDone", antiSocial: "notDone", adverseNews: "notChecked",
  countryRank: "C", insuredJPY: 0, insuredRate: 90, securedJPY: 0,
};

export interface Item { key: string; group: "財務" | "信用情報" | "取引・属性" | "コンプライアンス"; label: string; max: number; points: number; known: boolean; reason: string }
export interface Policy {
  ratingMin: Record<"S" | "A" | "B" | "C", number>;                 // 格付けの下限点
  netWorthRatio: Record<Exclude<Rating, "NG">, number>;             // 純資産に対する限度の割合
  revenueMonths: Record<Exclude<Rating, "NG">, number>;             // 月商の何か月分まで
  floorLimitJPY: Record<Exclude<Rating, "NG">, number>;             // 財務が不明なときの最低枠（取引実績ベース）
  countryFactor: Record<CountryRank, number>;
  pd: Record<Exclude<Rating, "NG">, number>;                        // 想定デフォルト率（%、暫定）
  approvalAboveJPY: number;                                         // この額以上の限度は役員承認
  reviewMonths: number;                                             // 再審査の期限
  minCompleteness: number;                                          // これ未満は B 止まり（情報不足）
}
export const DEFAULT_POLICY: Policy = {
  ratingMin: { S: 85, A: 70, B: 55, C: 40 },
  netWorthRatio: { S: 0.15, A: 0.10, B: 0.05, C: 0.02, D: 0 },
  revenueMonths: { S: 3, A: 2, B: 1.5, C: 1, D: 0 },
  floorLimitJPY: { S: 30_000_000, A: 15_000_000, B: 5_000_000, C: 1_000_000, D: 0 },
  countryFactor: { A: 1, B: 0.8, C: 0.6, D: 0.4, E: 0.2 },
  pd: { S: 0.1, A: 0.5, B: 2, C: 6, D: 15 },
  approvalAboveJPY: 10_000_000,
  reviewMonths: 12,
  minCompleteness: 60,
};

const band = (v: number | null, max: number, steps: [number, number][], higherIsBetter = true) => {
  // steps: [しきい値, 得点割合(0〜1)]。v が不明なら中立（max×0.5）
  if (v === null || Number.isNaN(v)) return { points: max * 0.5, known: false, reason: "不明（中立点）" };
  const sorted = [...steps].sort((a, b) => (higherIsBetter ? b[0] - a[0] : a[0] - b[0]));
  for (const [t, r] of sorted) if (higherIsBetter ? v >= t : v <= t) return { points: max * r, known: true, reason: `${v}` };
  return { points: 0, known: true, reason: `${v}` };
};

export function scoreItems(i: CreditInput): Item[] {
  const items: Item[] = [];
  const add = (key: string, group: Item["group"], label: string, max: number, r: { points: number; known: boolean; reason: string }, unit = "") =>
    items.push({ key, group, label, max, points: Math.round(r.points * 10) / 10, known: r.known, reason: r.known && unit ? `${r.reason}${unit}` : r.reason });
  add("equity", "財務", "自己資本比率", 12, band(i.equityRatio, 12, [[50, 1], [40, 0.85], [30, 0.65], [20, 0.4], [10, 0.2]]), "%");
  add("current", "財務", "流動比率", 8, band(i.currentRatio, 8, [[200, 1], [150, 0.85], [120, 0.65], [100, 0.4], [80, 0.2]]), "%");
  add("margin", "財務", "売上高経常利益率", 8, band(i.ordinaryMargin, 8, [[8, 1], [5, 0.85], [3, 0.65], [1, 0.4], [0, 0.2]]), "%");
  add("growth", "財務", "売上成長率", 4, band(i.revenueGrowth, 4, [[10, 1], [3, 0.8], [0, 0.6], [-10, 0.3]]), "%");
  add("debt", "財務", "有利子負債（月商倍率）", 8, band(i.debtToSalesMonths, 8, [[1, 1], [2, 0.8], [3, 0.6], [4, 0.4], [6, 0.2]], false), "か月");
  const pay = { excellent: 1, good: 0.8, slow: 0.35, delinquent: 0, unknown: 0.5 }[i.paymentRecord];
  add("pay", "信用情報", "支払実績（他社への支払い状況）", 12, { points: 12 * pay, known: i.paymentRecord !== "unknown", reason: { excellent: "非常に良好", good: "良好", slow: "遅れがち", delinquent: "延滞あり", unknown: "不明（中立点）" }[i.paymentRecord] });
  add("ext", "信用情報", "外部信用調査の評点", 8, band(i.externalScore, 8, [[80, 1], [65, 0.8], [50, 0.55], [35, 0.3]]), "点");
  add("years", "取引・属性", "業歴", 5, band(i.yearsInBusiness, 5, [[20, 1], [10, 0.8], [5, 0.6], [2, 0.35]]), "年");
  const h = { none: 0.3, under1: 0.5, "1to3": 0.8, over3: 1 }[i.history];
  add("history", "取引・属性", "当社との取引実績", 8, { points: 8 * h, known: i.history !== "none", reason: { none: "取引なし（初回）", under1: "1年未満", "1to3": "1〜3年", over3: "3年以上" }[i.history] });
  add("mgmt", "取引・属性", "経営者・体制", 5, { points: i.management ? (5 * (i.management - 1)) / 4 : 2.5, known: i.management !== null, reason: i.management ? `${i.management}/5` : "不明（中立点）" });
  add("industry", "取引・属性", "業種リスク", 2, { points: i.industryRisk ? (2 * (5 - i.industryRisk)) / 4 : 1, known: i.industryRisk !== null, reason: i.industryRisk ? `${i.industryRisk}/5（低いほど良い）` : "不明（中立点）" });
  add("registry", "コンプライアンス", "商業登記等で実在・代表者を確認", 5, { points: i.registryVerified ? 5 : 0, known: true, reason: i.registryVerified ? "確認済み" : "未確認" });
  add("ubo", "コンプライアンス", "実質的支配者（UBO）を確認", 4, { points: i.ownerVerified ? 4 : 0, known: true, reason: i.ownerVerified ? "確認済み" : "未確認" });
  add("sanc", "コンプライアンス", "制裁リスト照会", 5, { points: i.sanctions === "clear" ? 5 : 0, known: i.sanctions !== "notDone", reason: { clear: "該当なし", hit: "該当あり（NG）", notDone: "未実施" }[i.sanctions] });
  add("anti", "コンプライアンス", "反社・不正関与の確認", 3, { points: i.antiSocial === "clear" ? 3 : 0, known: i.antiSocial !== "notDone", reason: { clear: "該当なし", hit: "該当あり（NG）", notDone: "未実施" }[i.antiSocial] });
  const news = { none: 1, minor: 0.5, serious: 0, notChecked: 0.4 }[i.adverseNews];
  add("news", "コンプライアンス", "訴訟・不祥事の報道", 3, { points: 3 * news, known: i.adverseNews !== "notChecked", reason: { none: "なし", minor: "軽微なものあり", serious: "重大なものあり", notChecked: "未確認" }[i.adverseNews] });
  return items;
}

export interface Result {
  score: number; max: number; completeness: number; rating: Rating; ratingBeforeCap: Rating;
  items: Item[]; missing: string[]; stops: string[]; notes: string[];
  limitJPY: number; limitBasis: string; coveredJPY: number; totalLimitJPY: number;
  pd: number; expectedLossRate: number; needsApproval: boolean;
}

const ORDER: Rating[] = ["S", "A", "B", "C", "D", "NG"];
const worse = (a: Rating, b: Rating) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function evaluate(i: CreditInput, p: Policy = DEFAULT_POLICY): Result {
  const items = scoreItems(i);
  const max = items.reduce((a, x) => a + x.max, 0);
  const score = Math.round(items.reduce((a, x) => a + x.points, 0) * 10) / 10;
  const pct = (score / max) * 100;
  const completeness = Math.round((items.filter((x) => x.known).reduce((a, x) => a + x.max, 0) / max) * 100);
  const missing = items.filter((x) => !x.known).map((x) => x.label);
  const stops: string[] = []; const notes: string[] = [];
  if (i.sanctions === "hit") stops.push("制裁リストに該当：取引不可（法令違反のおそれ）");
  if (i.antiSocial === "hit") stops.push("反社・不正関与に該当：取引不可");
  if (i.adverseNews === "serious") stops.push("重大な訴訟・不祥事の報道：審査会での判断が必要（原則、取引しない）");
  if (!i.registryVerified) notes.push("商業登記等で実在を確認できるまでは、取引を始めない（前払いのみ可）");
  if (i.sanctions === "notDone") notes.push("制裁リスト照会が未実施：実施するまで契約・出荷しない");

  let base: Rating = pct >= p.ratingMin.S ? "S" : pct >= p.ratingMin.A ? "A" : pct >= p.ratingMin.B ? "B" : pct >= p.ratingMin.C ? "C" : "D";
  const ratingBeforeCap = base;
  if (completeness < p.minCompleteness) { base = worse(base, "B"); notes.push(`情報充足度が ${completeness}%（基準 ${p.minCompleteness}%）のため、格付けは B 止まり。不足情報を集めると上がる可能性があります`); }
  const capByCountry: Record<CountryRank, Rating> = { A: "S", B: "S", C: "A", D: "B", E: "C" };
  if (worse(base, capByCountry[i.countryRank]) !== base) notes.push(`国別リスク（${i.countryRank}）のため、格付けの上限を ${capByCountry[i.countryRank]} に制限`);
  base = worse(base, capByCountry[i.countryRank]);
  if (!i.registryVerified) base = worse(base, "C");
  const rating: Rating = stops.length && (i.sanctions === "hit" || i.antiSocial === "hit") ? "NG" : stops.length ? worse(base, "D") : base;

  // 限度額
  const r = rating === "NG" ? "D" : rating;
  const byNet = i.netWorthJPY !== null ? i.netWorthJPY * p.netWorthRatio[r] : null;
  const byRev = i.annualRevenueJPY !== null ? (i.annualRevenueJPY / 12) * p.revenueMonths[r] : null;
  let limit = 0; let basis = "";
  if (rating === "NG") { limit = 0; basis = "取引不可（NG）"; }
  else if (byNet !== null && byRev !== null) { limit = Math.min(byNet, byRev); basis = byNet <= byRev ? "純資産基準（純資産 × 格付け別の割合）" : "月商基準（月商 × 格付け別の月数）"; }
  else if (byNet !== null || byRev !== null) { limit = (byNet ?? byRev) as number; basis = byNet !== null ? "純資産基準（月商が不明）" : "月商基準（純資産が不明）"; }
  else { limit = p.floorLimitJPY[r]; basis = "財務が不明のため、格付け別の最低枠（取引実績ベース）"; }
  limit = Math.floor((limit * p.countryFactor[i.countryRank]) / 10_000) * 10_000;
  const covered = rating === "NG" ? 0 : Math.floor(i.insuredJPY * (i.insuredRate / 100) + i.securedJPY);
  const total = limit + covered;
  const pd = rating === "NG" ? 100 : p.pd[r];
  const unsecuredShare = total > 0 ? Math.max(0, limit) / total : 1;
  const lgd = 0.6 * unsecuredShare + 0.1 * (1 - unsecuredShare); // 無保全の損失率60%、保全済み部分は10%（暫定）
  return { score, max, completeness, rating, ratingBeforeCap, items, missing, stops, notes, limitJPY: limit, limitBasis: basis, coveredJPY: covered, totalLimitJPY: total, pd, expectedLossRate: Math.round(pd * lgd * 100) / 100, needsApproval: total >= p.approvalAboveJPY };
}

// ---- 取引条件マトリクス：格付け × 国別リスク → 許容できる決済条件と必要な保全 ----
export const PAY_LABEL: Record<PayKey, string> = { advance: "前払い（T/T 全額）", partial: "一部前払い", lc: "L/C（信用状）", dp: "D/P", da: "D/A", oa: "O/A（後払い）" };
export interface TermRule { status: Tri; need: string }
const LEVEL: Record<Exclude<Rating, "NG">, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

export function termMatrix(rating: Rating, country: CountryRank): Record<PayKey, TermRule> {
  if (rating === "NG") return { advance: { status: "ng", need: "取引不可" }, partial: { status: "ng", need: "取引不可" }, lc: { status: "ng", need: "取引不可" }, dp: { status: "ng", need: "取引不可" }, da: { status: "ng", need: "取引不可" }, oa: { status: "ng", need: "取引不可" } };
  // 国別リスクが D/E は、後払い系を1段階厳しくする
  const lvl = Math.min(4, LEVEL[rating] + (country === "D" ? 1 : country === "E" ? 2 : 0));
  const lcBankRisk = country === "D" || country === "E";
  return {
    advance: { status: "ok", need: "出荷前に全額入金を確認（入金確認後に出荷）" },
    partial: lvl <= 1 ? { status: "ok", need: "前払い 20〜30% 以上、残金は B/L 日付から30日以内" } : lvl === 2 ? { status: "cond", need: "前払い 40% 以上。残金は B/L コピーと引換えに近い条件" } : lvl === 3 ? { status: "cond", need: "前払い 50% 以上（原価＋諸費用を前払いでカバー）" } : { status: "ng", need: "前払い100%のみ" },
    lc: lvl <= 2 && !lcBankRisk ? { status: "ok", need: "取消不能・一覧払い（at sight）。書類条件を船積前に確認" } : lvl <= 3 || lcBankRisk ? { status: "cond", need: "日本の銀行の確認（コンファーム）付き。確認手数料を価格に織り込む" } : { status: "cond", need: "確認付きのみ。発行銀行が大手でなければ撤退" },
    dp: lvl <= 1 ? { status: "ok", need: "受取拒否時の返送・転売先を確保。貿易保険の付保を推奨" } : lvl === 2 ? { status: "cond", need: "貿易保険の付保が必須。受取拒否時の手当を確保" } : { status: "ng", need: "D/P は不可（前払い・確認付L/Cへ）" },
    da: lvl === 0 ? { status: "ok", need: "期日60日以内。限度額内" } : lvl === 1 ? { status: "cond", need: "期日60日以内。限度額を超える分は貿易保険で付保" } : lvl === 2 ? { status: "cond", need: "貿易保険の付保が必須。期日45日以内" } : { status: "ng", need: "D/A は不可" },
    oa: lvl === 0 ? { status: "ok", need: "期日90日以内。限度額内。月次で残高を確認" } : lvl === 1 ? { status: "cond", need: "期日60日以内。限度額内。超過分は付保" } : lvl === 2 ? { status: "cond", need: "貿易保険の付保が必須。期日30〜45日以内。少額から開始" } : { status: "ng", need: "O/A は不可" },
  };
}

// ---- エクスポージャー（現在の与信使用額） ----
export interface ExposureInput { arJPY: number; pipelineJPY: number }
export function usage(limitTotal: number, e: ExposureInput) {
  const confirmed = e.arJPY, withPipeline = e.arJPY + e.pipelineJPY;
  const rate = limitTotal > 0 ? confirmed / limitTotal : confirmed > 0 ? Infinity : 0;
  const rateWith = limitTotal > 0 ? withPipeline / limitTotal : withPipeline > 0 ? Infinity : 0;
  return { confirmed, withPipeline, rate, rateWith, level: rate > 1 ? "over" : rateWith > 1 ? "future-over" : rate > 0.8 ? "warn" : "ok" } as const;
}

export const COUNTRY_RANK_LABEL: Record<CountryRank, string> = { A: "A（低い）", B: "B（やや低い）", C: "C（中程度）", D: "D（高い）", E: "E（非常に高い）" };
/** 社内の初期値（暫定）。実際の判断は NEXI の国カテゴリー・OECD 国別リスク分類・外務省の安全情報などの最新情報で必ず見直す */
export const COUNTRY_DEFAULT_RANK: Record<string, CountryRank> = { 日本: "A", 米国: "A", ドイツ: "A", オーストラリア: "A", シンガポール: "A", 香港: "B", 台湾: "B", 韓国: "B", マレーシア: "B", タイ: "C", ベトナム: "C", インドネシア: "C", UAE: "B" };
export const rankOf = (country: string): CountryRank => COUNTRY_DEFAULT_RANK[country] ?? "C";

/** 満期（再審査期限）の日付文字列 */
export function validUntil(from: string, months: number) {
  const d = new Date(from + "T00:00:00"); d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
