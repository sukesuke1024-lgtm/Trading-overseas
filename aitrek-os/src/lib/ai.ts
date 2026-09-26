// AI 機能（仕様書 7）。
// - プロンプトはここで組み立て、/api/ai（Claude）へ送る
// - API キー未設定時やエラー時はテンプレートによる下書きを返す
// - AI の出力はすべて「下書き」。契約・支払・値決め・法務/税務/規制の最終判断は人間が行う
import { STAGES, countryLabel, countryOf, stageIndex, stageLabel } from "./constants";
import { calcCost } from "./cost";
import { today, yen, pct, addDays } from "./format";
import { activeDeals, alerts, monthly } from "./insights";
import type { Buyer, Database, Deal, Product } from "./types";

export type AiTask =
  | "sales_email"
  | "followup"
  | "proposal"
  | "deal_summary"
  | "meeting_summary"
  | "next_action"
  | "translate"
  | "checklist"
  | "quotation_help"
  | "market_research"
  | "weekly_report";

export const AI_TASKS: { key: AiTask; label: string; scope: ("buyer" | "deal" | "product" | "global")[] }[] = [
  { key: "sales_email", label: "営業Email作成", scope: ["buyer", "deal"] },
  { key: "followup", label: "Follow-up文作成", scope: ["buyer", "deal"] },
  { key: "proposal", label: "Buyer向け商品提案", scope: ["buyer"] },
  { key: "deal_summary", label: "商談要約", scope: ["deal"] },
  { key: "meeting_summary", label: "Meeting Note要約", scope: ["deal", "buyer", "global"] },
  { key: "next_action", label: "Next Action提案", scope: ["deal"] },
  { key: "quotation_help", label: "見積作成補助", scope: ["deal"] },
  { key: "checklist", label: "輸出Checklist候補生成", scope: ["deal", "product"] },
  { key: "translate", label: "商品説明翻訳（英・中・韓）", scope: ["product"] },
  { key: "market_research", label: "市場調査メモ", scope: ["product", "global"] },
  { key: "weekly_report", label: "Weekly Business Report", scope: ["global"] },
];

export const AI_GUARDRAIL =
  "あなたは日本の食品・商品の海外輸出を行う商社 AITREK の業務アシスタントです。出力はすべて人間が確認する下書きです。契約締結、金銭の支払、価格の最終決定、法務・税務・輸入規制の適合性を断定・確定してはいけません。規制や関税に触れる場合は『要確認』と明記し、確認先（当局・通関業者・専門家）を示してください。事実が不明な情報を創作しないでください。";

export type AiContext =
  | { kind: "buyer"; buyer: Buyer }
  | { kind: "deal"; deal: Deal }
  | { kind: "product"; product: Product }
  | { kind: "global" };

// ---------------- Matching ----------------

export function matchProductsForBuyer(db: Database, buyer: Buyer) {
  const wants = `${buyer.desired_products} ${buyer.notes}`.toLowerCase();
  return db.products
    .filter((p) => p.status !== "停止")
    .map((p) => {
      let score = 20;
      const reasons: string[] = [];
      if (p.target_countries.includes(buyer.country)) {
        score += 30;
        reasons.push("対応国");
      }
      const producer = db.producers.find((x) => x.id === p.producer_id);
      if (producer?.available_countries.includes(buyer.country) && !p.target_countries.includes(buyer.country)) {
        score += 15;
        reasons.push("生産者対応国");
      }
      const words = [p.category, ...p.category.split(/[・品]/), p.name, p.name_en].filter((w) => w && w.length >= 2);
      if (words.some((w) => wants.includes(w.toLowerCase()))) {
        score += 30;
        reasons.push("希望商品に一致");
      }
      if (["販売中", "輸出可能"].includes(p.status)) {
        score += 10;
        reasons.push(p.status);
      }
      if (buyer.desired_products.includes("Halal") && !p.certifications.includes("Halal")) {
        score -= 20;
        reasons.push("Halal未取得");
      }
      return { product: p, score: Math.max(0, Math.min(100, score)), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------- Context text ----------------

function buyerText(b: Buyer) {
  return `Buyer: ${b.company_name}（${countryOf(b.country)?.name_en ?? b.country}, ${b.city}）業態:${b.business_type} 担当:${b.contact_name} ${b.position} 希望商品:${b.desired_products} 価格帯:${b.price_range} MOQ:${b.desired_moq} Incoterms:${b.incoterms} 支払:${b.payment_terms} 輸入実績:${b.import_history} メモ:${b.notes}`;
}

function productText(p: Product) {
  return `商品:${p.name}（${p.name_en}）カテゴリ:${p.category} 内容量:${p.net_content} 原材料:${p.ingredients} HS:${p.hs_code} 保存:${p.storage} 賞味期限:${p.shelf_life} 認証:${p.certifications.join("/")} MOQ:${p.moq ?? ""} 説明(EN):${p.description_en}`;
}

function dealText(db: Database, d: Deal) {
  const b = db.buyers.find((x) => x.id === d.buyer_id);
  const p = db.products.find((x) => x.id === d.product_id);
  const r = calcCost(d.cost);
  const tasks = db.tasks.filter((t) => t.deal_id === d.id);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "na");
  const acts = db.activities.filter((a) => a.deal_id === d.id).slice(0, 12);
  return [
    `Deal ${d.code}: ${d.title}`,
    `Status: ${stageLabel(d.stage)} / 確度 ${d.probability}% / 期限 ${d.deadline} / Next: ${d.next_action}`,
    `数量 ${d.quantity} / ${d.incoterm} / ${d.currency} / 売上見込 ${yen(r.revenue)} / 粗利 ${yen(r.profit)}（${pct(r.margin)}）/ 単価 ${r.unitPriceFx.toFixed(2)} ${d.currency}`,
    b ? buyerText(b) : "",
    p ? productText(p) : "",
    `未完了Task(${open.length}/${tasks.length}): ${open.slice(0, 10).map((t) => `${t.title}(${t.due_date})`).join("、")}`,
    `最近のActivity: ${acts.map((a) => a.message).join(" / ")}`,
    `メモ: ${d.notes}`,
  ].join("\n");
}

function globalText(db: Database) {
  const m = monthly(db);
  const act = activeDeals(db);
  const al = alerts(db).slice(0, 10);
  return [
    `今日: ${today()}`,
    `今月売上 ${yen(m.revenue)} / 粗利 ${yen(m.profit)}（${pct(m.margin)}）`,
    `進行中Deal ${act.length}件: ${act.slice(0, 15).map((d) => `${d.code} ${d.title} [${stageLabel(d.stage)}] 期限${d.deadline}`).join(" / ")}`,
    `Alert: ${al.map((a) => a.title).join(" / ")}`,
    `Producer ${db.producers.length}社 / Buyer ${db.buyers.length}社 / 商品 ${db.products.length}件`,
  ].join("\n");
}

const INSTR: Record<AiTask, string> = {
  sales_email: "Buyer 向けの初回営業 Email を英語で作成してください（件名付き、150〜220語、押し売りにならず、具体的な商品提案とサンプル提供の打診を含む）。最後に日本語で要点を3行で添えてください。",
  followup: "直近の状況を踏まえた Follow-up Email を英語で作成してください（件名付き、120語程度）。次の具体的アクションを1つ提案してください。",
  proposal: "Buyer の希望に合う商品提案を作成してください。候補商品ごとに提案理由・想定価格帯の考え方・確認事項を日本語で箇条書きにし、最後に英語の提案文（100語程度）を付けてください。",
  deal_summary: "この商談の要約を日本語で作成してください：現状、論点、リスク、次の一手（担当・期限の目安付き）。",
  meeting_summary: "以下の Meeting Note を日本語で要約してください：決定事項、宿題（誰が・いつまで）、未決事項、次回アジェンダ。",
  next_action: "この Deal の Next Action を優先度順に3つ提案してください。各項目に理由と期限の目安を付けてください。",
  quotation_help: "見積作成のための確認リストと、Buyer に送る見積送付メール（英語）を作成してください。価格は現状の試算値を参照値として扱い、最終価格は承認が必要と明記してください。",
  checklist: "この商品・輸出国に対して、標準Checklist以外に確認すべき項目の候補を挙げてください（規制・ラベル・物流・書類）。各項目に『要確認』の確認先を添えてください。",
  translate: "商品説明を英語・簡体中国語・韓国語で作成してください。誇大表現や効能の断定は避け、原材料・保存方法・特徴を簡潔に。見出しで言語を分けてください。",
  market_research: "この商品カテゴリの主要輸出候補国について、市場性の仮説・想定競合・価格帯・参入時の確認事項を日本語でまとめてください。推測は推測と明記してください。",
  weekly_report: "代表者向けの Weekly Business Report を日本語で作成してください：今週の数字、進捗した案件、止まっている案件と原因、今週の最優先アクション5つ、リスク。",
};

export function buildPrompt(db: Database, task: AiTask, ctx: AiContext, note = "") {
  let body = "";
  if (ctx.kind === "buyer") {
    body = buyerText(ctx.buyer);
    if (task === "proposal") body += "\n候補商品:\n" + matchProductsForBuyer(db, ctx.buyer).slice(0, 5).map((m) => `- ${productText(m.product)}（スコア${m.score}）`).join("\n");
    const deals = db.deals.filter((d) => d.buyer_id === ctx.buyer.id);
    if (deals.length) body += "\n関連Deal: " + deals.map((d) => `${d.code} ${d.title} [${stageLabel(d.stage)}]`).join(" / ");
  } else if (ctx.kind === "deal") body = dealText(db, ctx.deal);
  else if (ctx.kind === "product") {
    body = productText(ctx.product);
    const producer = db.producers.find((x) => x.id === ctx.product.producer_id);
    if (producer) body += `\n生産者: ${producer.company_name}（${producer.address}）輸出経験:${producer.export_experience}`;
    if (task === "checklist") body += `\n対象国: ${ctx.product.target_countries.join(", ")}`;
  } else body = globalText(db);
  return `${INSTR[task]}\n\n# データ\n${body}${note ? `\n\n# 追加メモ・Meeting Note\n${note}` : ""}`;
}

// ---------------- Template fallback ----------------

export function templateDraft(db: Database, task: AiTask, ctx: AiContext, note = ""): string {
  const buyer = ctx.kind === "buyer" ? ctx.buyer : ctx.kind === "deal" ? db.buyers.find((b) => b.id === ctx.deal.buyer_id) : undefined;
  const deal = ctx.kind === "deal" ? ctx.deal : undefined;
  const product = ctx.kind === "product" ? ctx.product : deal ? db.products.find((p) => p.id === deal.product_id) : buyer ? matchProductsForBuyer(db, buyer)[0]?.product : undefined;
  const first = buyer?.contact_name?.split(" ")[0] || "there";

  switch (task) {
    case "sales_email":
      return `Subject: Premium Hokkaido ${product?.category === "菓子" ? "confectionery" : "products"} for ${buyer?.company_name ?? "your company"}

Dear ${first},

I hope this message finds you well. I'm reaching out from AITREK, a Hokkaido-based trading company that connects carefully selected Japanese producers with importers and retailers overseas.

Given ${buyer?.company_name ?? "your company"}'s focus on ${buyer?.desired_products || "Japanese food products"}, I believe ${product ? `our ${product.name_en || product.name}` : "our Hokkaido product line-up"} could be a strong fit for your customers in ${countryOf(buyer?.country)?.name_en ?? "your market"}.
${product ? `\n- ${product.name_en || product.name}: ${product.description_en || product.net_content}\n- Storage: ${product.storage || "-"} / Shelf life: ${product.shelf_life || "-"}\n- MOQ: ${product.moq ?? "negotiable"}\n` : ""}
We handle export documentation and logistics end-to-end, and we would be happy to send samples and a price list on ${buyer?.incoterms || "FOB"} terms.

Would you be open to a short call next week?

Best regards,
AITREK Inc.

---
【要点】
・${buyer?.company_name ?? "Buyer"} の希望（${buyer?.desired_products || "—"}）に合わせて商品提案
・サンプル送付と価格表の提示を打診
・次週の打ち合わせを依頼
※テンプレート下書きです（Claude 未接続）。送信前に内容を確認してください。`;
    case "followup":
      return `Subject: Following up — ${deal?.title ?? product?.name_en ?? "our proposal"}

Dear ${first},

Thank you again for your time. I wanted to follow up on ${deal ? `our discussion regarding ${product?.name_en || deal.title}` : "my previous message"}.
${deal?.stage === "sample" ? "\nHave the samples arrived safely? We would greatly appreciate your team's feedback on taste, packaging and pricing.\n" : deal?.stage === "quotation" ? "\nPlease let us know if you have any questions about the quotation we sent. We are flexible on quantity and shipping schedule.\n" : "\nI'd be glad to share additional product details or arrange samples at your convenience.\n"}
As a next step, could we schedule a 20-minute call ${deal?.deadline ? `before ${deal.deadline}` : "next week"}?

Best regards,
AITREK Inc.

※テンプレート下書きです（Claude 未接続）。`;
    case "proposal": {
      const ms = buyer ? matchProductsForBuyer(db, buyer).slice(0, 3) : [];
      return `【${buyer?.company_name ?? "Buyer"} 向け 商品提案（下書き）】\n\n${ms
        .map((m, i) => `${i + 1}. ${m.product.name}（スコア ${m.score}）\n   ・理由：${m.reasons.join("、") || "—"}\n   ・参考原価：${yen(m.product.cost_price)} / MOQ ${m.product.moq ?? "—"}\n   ・確認事項：輸入国規制・ラベル要件・賞味期限（${m.product.shelf_life || "—"}）`)
        .join("\n\n")}\n\n※価格は輸出原価計算で試算の上、Owner/Admin の承認後に提示してください。`;
    }
    case "deal_summary":
    case "next_action": {
      if (!deal) return "Deal を選択してください。";
      const open = db.tasks.filter((t) => t.deal_id === deal.id && t.status !== "done" && t.status !== "na").sort((a, b) => a.due_date.localeCompare(b.due_date));
      const overdue = open.filter((t) => t.due_date && t.due_date < today());
      const nextStage = STAGES[stageIndex(deal.stage) + 1];
      const r = calcCost(deal.cost);
      if (task === "deal_summary")
        return `【${deal.code} 商談要約（下書き）】\n■現状：${stageLabel(deal.stage)}（確度 ${deal.probability}%）${buyer ? ` / ${buyer.company_name}（${countryLabel(buyer.country)}）` : ""}\n■条件：${deal.quantity}個 / ${deal.incoterm} / 売上見込 ${yen(r.revenue)} / 粗利 ${yen(r.profit)}（${pct(r.margin)}）\n■未完了Task：${open.length}件${overdue.length ? `（期限超過 ${overdue.length}件：${overdue.slice(0, 3).map((t) => t.title).join("、")}）` : ""}\n■リスク：${[!deal.price_approved && "価格未承認", overdue.length && "期限超過Taskあり", r.margin < 0.1 && "粗利率10%未満"].filter(Boolean).join("、") || "特になし"}\n■次の一手：${deal.next_action || (nextStage ? `${nextStage.label} へ進めるための準備` : "Repeat 提案")}`;
      return `【${deal.code} Next Action 提案（下書き）】\n1. ${overdue[0] ? `期限超過「${overdue[0].title}」を完了（本日中）` : open[0] ? `「${open[0].title}」を ${open[0].due_date} までに完了` : "Buyer に進捗共有"}\n2. ${!deal.price_approved ? "輸出原価を確定し Owner/Admin の価格承認を取得（2日以内）" : nextStage ? `${nextStage.label} ステージへ進める準備（${addDays(today(), 5)} 目安）` : "Repeat 発注のヒアリング"}\n3. ${buyer ? `${buyer.contact_name || "Buyer"} へ Follow-up 連絡（${addDays(today(), 2)}）` : "Buyer 設定"}`;
    }
    case "meeting_summary":
      return note
        ? `【Meeting Note 要約（簡易・下書き）】\n${note
            .split(/\n|。/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8)
            .map((s) => `・${s}`)
            .join("\n")}\n\n※Claude 未接続のため簡易要約です。決定事項・宿題を確認してください。`
        : "Meeting Note を入力してください。";
    case "quotation_help":
      if (!deal) return "Deal を選択してください。";
      return `【見積作成チェック】\n□ 数量・単位（${deal.quantity}）\n□ Incoterms（${deal.incoterm}）と仕向港\n□ 通貨（${deal.currency}）と為替（${deal.cost.fx_rate}）\n□ 有効期限・Lead time\n□ Payment Terms（${deal.payment_terms || "未設定"}）\n□ 価格承認（${deal.price_approved ? "承認済" : "未承認 → Owner/Admin 承認が必要"}）\n\nSubject: Quotation — ${product?.name_en ?? deal.title}\n\nDear ${first},\nPlease find attached our quotation on ${deal.incoterm} terms. The quotation is valid for 30 days. Let us know if you have any questions.\n\nBest regards,\nAITREK Inc.`;
    case "checklist":
      return `【追加確認候補（下書き）】\n・賞味期限の残存期間要件（輸入国・Buyer 基準）→ Buyer に確認\n・輸入国の食品添加物ポジティブリストとの照合 → 輸入者/当局に要確認\n・栄養成分表示・原産国表示の現地要件 → 要確認\n・パレット・カートン表示（Shipping Mark）→ Buyer 指示を確認\n・温度記録（${product?.storage || "常温"}）の要否 → 物流会社に確認\n・放射性物質検査証明・産地証明の要否 → 輸入国規制を要確認`;
    case "translate":
      return product
        ? `## English\n${product.name_en || product.name}\n${product.description_en || `Made in Hokkaido, Japan. Net content: ${product.net_content}. Storage: ${product.storage}. Best before: ${product.shelf_life}.`}\n\n## 简体中文\n${product.description_zh || `北海道制造。净含量：${product.net_content}。保存方法：${product.storage}。保质期：${product.shelf_life}。`}\n\n## 한국어\n${product.description_ko || `홋카이도산. 내용량: ${product.net_content}. 보관방법: ${product.storage}. 유통기한: ${product.shelf_life}.`}\n\n※テンプレート下書き（Claude 未接続）。ネイティブ確認を推奨。`
        : "商品を選択してください。";
    case "market_research":
      return `【市場調査メモ（下書き）】\n対象：${product?.category ?? "全カテゴリ"}\n・候補国：${product?.target_countries.map((c) => countryLabel(c)).join("、") || "香港、台湾、シンガポール"}\n・仮説：日本産・北海道ブランドへの信頼が高く、プレミアム価格帯で受容余地あり（要検証）\n・確認事項：競合日本ブランドの店頭価格、輸入規制、現地流通マージン\n※Claude 接続時は詳細な分析を生成します。`;
    case "weekly_report": {
      const m = monthly(db);
      const al = alerts(db);
      const act = activeDeals(db);
      return `【Weekly Business Report（${today()}）】\n\n■数字\n・今月売上 ${yen(m.revenue)} / 粗利 ${yen(m.profit)}（${pct(m.margin)}）\n・進行中Deal ${act.length}件\n\n■止まっている案件\n${al.filter((a) => a.level !== "info").slice(0, 5).map((a) => `・${a.title}（${a.detail}）`).join("\n") || "・なし"}\n\n■今週の最優先アクション\n${al.slice(0, 5).map((a, i) => `${i + 1}. ${a.title}`).join("\n") || "1. 新規Leadの開拓"}\n\n※テンプレート版（Claude 未接続）。`;
    }
  }
}
