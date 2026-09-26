// 初回起動時のサンプルデータ（すべて架空の企業・人物）。Settings から削除・再投入できる。
import { applyCost, changeStage, createDeal, log, prepareBuyer, updateFinance, updateTask } from "./automation";
import { DEFAULT_FX } from "./constants";
import { addDays, today } from "./format";
import { emptyDb } from "./store/adapter";
import { Tx } from "./store/tx";
import type { Buyer, CompanySettings, DealStage, Producer, Product } from "./types";

export const defaultSettings = (): CompanySettings => ({
  company_name: "株式会社AITREK",
  company_name_en: "AITREK Inc.",
  address_en: "Sapporo, Hokkaido, Japan",
  phone: "",
  email: "trade@aitrek.jp",
  website: "https://www.aitrek.jp",
  representative: "",
  bank_info: "",
  default_commission: 15,
  fx_rates: { ...DEFAULT_FX },
});

const blankProducer = (): Omit<Producer, "id" | "created_at" | "updated_at"> => ({
  code: "", company_name: "", brand_name: "", contact_name: "", phone: "", email: "", address: "", prefecture: "北海道",
  website: "", categories: [], main_products: "", sku_count: null, wholesale_price: "", moq: "", capacity: "", inventory: "",
  shelf_life: "", storage_temp: "常温", export_experience: "なし", available_countries: [], certifications: [], image_url: "",
  docs_url: "", contract_status: "未契約", commission_rate: null, last_contact_at: "", next_action: "", next_action_date: "", notes: "",
});

const blankBuyer = (): Omit<Buyer, "id" | "created_at" | "updated_at"> => ({
  code: "", country: "", city: "", company_name: "", business_type: "輸入業者", website: "", contact_name: "", position: "",
  email: "", phone: "", whatsapp: "", linkedin: "", desired_products: "", price_range: "", desired_moq: "", incoterms: "FOB",
  payment_terms: "", import_history: "", status: "Lead", currency: "", last_contact_at: "", next_contact_at: "", notes: "",
});

const blankProduct = (): Omit<Product, "id" | "created_at" | "updated_at"> => ({
  code: "", producer_id: null, name: "", name_en: "", category: "", sku: "", jan: "", hs_code: "", ingredients: "", net_content: "",
  cost_price: null, domestic_wholesale_price: null, export_price: null, moq: null, case_qty: null, weight_kg: null, size: "",
  shelf_life: "", storage: "", certifications: [], export_restrictions: "", target_countries: [], image_url: "", description_en: "",
  description_zh: "", description_ko: "", status: "候補",
});

export const blanks = { producer: blankProducer, buyer: blankBuyer, product: blankProduct };

const NEXT_ACTION: Partial<Record<DealStage, string>> = {
  lead: "初回営業Email送付",
  contacted: "オンライン商談の日程調整",
  meeting: "希望価格帯・MOQのヒアリング",
  quotation: "Quotation送付・価格承認",
  sample: "Sample評価のFollow-up",
  negotiation: "価格・支払条件の最終調整",
  order: "Shipping Quote取得・ブッキング",
  shipment: "B/L受領・Buyerへ書類送付",
  payment: "入金確認（期限超過）",
  repeat: "次回発注のヒアリング",
};

export function buildSeed() {
  const settings = defaultSettings();
  const tx = new Tx(emptyDb(), "System");

  const owner = tx.insert("members", { name: "代表（Owner）", email: "owner@aitrek.jp", role: "owner", active: true });
  const sales = tx.insert("members", { name: "海外営業 担当", email: "sales@aitrek.jp", role: "sales", active: true });
  const ops = tx.insert("members", { name: "貿易実務 担当", email: "ops@aitrek.jp", role: "trade_ops", active: true });
  tx.insert("members", { name: "経理 担当", email: "finance@aitrek.jp", role: "finance", active: true });
  tx.insert("members", { name: "AI Agent", email: "agent@aitrek.jp", role: "ai_agent", active: true });

  const d = (n: number) => addDays(today(), n);

  const producers = [
    { company_name: "北の浜水産株式会社", brand_name: "HAMA NO KAI", contact_name: "佐藤", email: "info@kitanohama.example.jp", phone: "0138-00-0000", address: "北海道函館市", categories: ["水産品", "水産加工品"], main_products: "冷凍ホタテ貝柱、いくら醤油漬", sku_count: 12, wholesale_price: "ホタテ 1kg ¥4,200〜", moq: "100kg", capacity: "月 5t", inventory: "3t", shelf_life: "冷凍 18ヶ月", storage_temp: "冷凍", export_experience: "あり（香港・台湾）", available_countries: ["HK", "TW", "SG", "US"], certifications: ["HACCP", "FDA登録"], contract_status: "契約済", commission_rate: 12, last_contact_at: d(-3), next_action: "新規サイズ規格の見積依頼", next_action_date: d(4) },
    { company_name: "十勝ミルクファーム", brand_name: "TOKACHI CREAM", contact_name: "高橋", email: "sales@tokachi-milk.example.jp", phone: "0155-00-0000", address: "北海道帯広市", categories: ["乳製品", "菓子"], main_products: "ナチュラルチーズ、ミルクジャム", sku_count: 8, wholesale_price: "チーズ 200g ¥780", moq: "500個", capacity: "月 20,000個", inventory: "8,000個", shelf_life: "冷蔵 90日", storage_temp: "冷蔵", export_experience: "なし", available_countries: ["SG", "HK", "TH"], certifications: ["HACCP"], contract_status: "交渉中", commission_rate: 15, last_contact_at: d(-9), next_action: "輸出向けラベル案の共有", next_action_date: d(2) },
    { company_name: "旭川製菓", brand_name: "ASAHI SWEETS", contact_name: "伊藤", email: "export@asahikawa-seika.example.jp", phone: "0166-00-0000", address: "北海道旭川市", categories: ["菓子"], main_products: "ホワイトチョコクッキー、バターサンド", sku_count: 15, wholesale_price: "1箱 ¥620", moq: "1,000箱", capacity: "月 50,000箱", inventory: "12,000箱", shelf_life: "常温 180日", storage_temp: "常温", export_experience: "あり（台湾・韓国）", available_countries: ["TW", "KR", "SG", "US", "TH", "PH"], certifications: ["HACCP", "ISO22000"], contract_status: "契約済", commission_rate: 15, last_contact_at: d(-1), next_action: "春季限定品の輸出可否確認", next_action_date: d(7) },
    { company_name: "ニセコ醸造所", brand_name: "NISEKO BREW", contact_name: "渡辺", email: "hello@niseko-brew.example.jp", phone: "0136-00-0000", address: "北海道虻田郡ニセコ町", categories: ["酒類", "飲料"], main_products: "クラフトビール、シードル", sku_count: 6, wholesale_price: "330ml ¥310", moq: "50ケース", capacity: "月 3,000ケース", inventory: "600ケース", shelf_life: "冷蔵 120日", storage_temp: "冷蔵", export_experience: "なし", available_countries: ["SG", "AU"], certifications: [], contract_status: "未契約", commission_rate: null, last_contact_at: d(-20), next_action: "輸出向け価格表の依頼", next_action_date: d(-2) },
    { company_name: "富良野ファーム", brand_name: "FURANO FIELDS", contact_name: "中村", email: "farm@furano-fields.example.jp", phone: "0167-00-0000", address: "北海道富良野市", categories: ["農産品", "調味料"], main_products: "メロン、玉ねぎドレッシング", sku_count: 5, wholesale_price: "ドレッシング ¥420", moq: "300本", capacity: "月 10,000本", inventory: "4,000本", shelf_life: "常温 12ヶ月", storage_temp: "常温", export_experience: "あり（香港）", available_countries: ["HK", "SG", "MY"], certifications: ["JFS-B"], contract_status: "契約済", commission_rate: 18, last_contact_at: d(-5), next_action: "", next_action_date: "" },
  ].map((p, i) => tx.insert("producers", { ...blankProducer(), ...p, code: `PRD-${String(i + 1).padStart(4, "0")}` }));

  const products = [
    { producer: 0, name: "北海道産 冷凍ホタテ貝柱 1kg", name_en: "Hokkaido Frozen Scallop Adductor 1kg", category: "水産品", sku: "HK-SC-1K", hs_code: "0307.22", ingredients: "ホタテガイ（北海道産）", net_content: "1kg", cost_price: 4200, domestic_wholesale_price: 5200, export_price: 6300, moq: 100, case_qty: 10, weight_kg: 1.1, storage: "冷凍", shelf_life: "18ヶ月", certifications: ["HACCP", "FDA登録"], target_countries: ["HK", "TW", "SG", "US"], status: "販売中", description_en: "Sashimi-grade scallop adductors harvested in Hokkaido and flash-frozen to lock in sweetness." },
    { producer: 0, name: "いくら醤油漬 500g", name_en: "Salmon Roe Marinated in Soy Sauce 500g", category: "水産加工品", sku: "HK-IK-500", hs_code: "1604.32", ingredients: "さけ卵、醤油（小麦・大豆を含む）、みりん", net_content: "500g", cost_price: 5800, domestic_wholesale_price: 7000, export_price: 8600, moq: 50, case_qty: 20, weight_kg: 0.6, storage: "冷凍", shelf_life: "12ヶ月", certifications: ["HACCP"], target_countries: ["HK", "SG"], status: "輸出可能" },
    { producer: 1, name: "十勝ナチュラルチーズ 200g", name_en: "Tokachi Natural Cheese 200g", category: "乳製品", sku: "TC-CH-200", hs_code: "0406.90", ingredients: "生乳、食塩", net_content: "200g", cost_price: 780, domestic_wholesale_price: 950, export_price: 1200, moq: 500, case_qty: 24, weight_kg: 0.25, storage: "冷蔵", shelf_life: "90日", certifications: ["HACCP"], target_countries: ["SG", "HK", "TH"], status: "準備中" },
    { producer: 2, name: "ホワイトチョコクッキー 12枚入", name_en: "Hokkaido White Chocolate Cookies 12pcs", category: "菓子", sku: "AS-WC-12", hs_code: "1905.31", ingredients: "小麦粉、砂糖、バター、ホワイトチョコレート、卵", net_content: "12枚", cost_price: 620, domestic_wholesale_price: 780, export_price: 980, moq: 1000, case_qty: 30, weight_kg: 0.3, storage: "常温", shelf_life: "180日", certifications: ["HACCP", "ISO22000"], target_countries: ["TW", "KR", "SG", "US", "TH", "PH"], status: "販売中", description_en: "Buttery langue de chat cookies sandwiching Hokkaido white chocolate.", description_zh: "北海道白巧克力夹心饼干，奶香浓郁。", description_ko: "홋카이도 화이트 초콜릿을 샌드한 버터 쿠키." },
    { producer: 2, name: "バターサンド 6個入", name_en: "Butter Sandwich Biscuits 6pcs", category: "菓子", sku: "AS-BS-06", hs_code: "1905.90", ingredients: "小麦粉、バター、レーズン、ホワイトチョコレート", net_content: "6個", cost_price: 840, domestic_wholesale_price: 1050, export_price: 1320, moq: 500, case_qty: 24, weight_kg: 0.35, storage: "常温", shelf_life: "120日", certifications: ["HACCP"], target_countries: ["TW", "SG"], status: "輸出可能" },
    { producer: 3, name: "ニセコ クラフトビール IPA 330ml", name_en: "Niseko Craft IPA 330ml", category: "酒類", sku: "NB-IPA-330", hs_code: "2203.00", ingredients: "麦芽、ホップ", net_content: "330ml", cost_price: 310, domestic_wholesale_price: 380, export_price: 520, moq: 1200, case_qty: 24, weight_kg: 0.55, storage: "冷蔵", shelf_life: "120日", certifications: [], target_countries: ["SG", "AU"], status: "候補", export_restrictions: "アルコール度数表示・現地酒税ラベル要" },
    { producer: 4, name: "富良野玉ねぎドレッシング 300ml", name_en: "Furano Onion Dressing 300ml", category: "調味料", sku: "FF-OD-300", hs_code: "2103.90", ingredients: "玉ねぎ、醤油、醸造酢、砂糖、植物油", net_content: "300ml", cost_price: 420, domestic_wholesale_price: 520, export_price: 690, moq: 300, case_qty: 12, weight_kg: 0.4, storage: "常温", shelf_life: "12ヶ月", certifications: ["JFS-B"], target_countries: ["HK", "SG", "MY"], status: "販売中" },
  ].map((p, i) => {
    const { producer, ...rest } = p;
    return tx.insert("products", { ...blankProduct(), ...rest, producer_id: producers[producer].id, code: `PD-${String(i + 1).padStart(4, "0")}` });
  });

  const buyers = [
    { company_name: "Harbour Fresh Trading Ltd.", city: "Hong Kong", business_type: "輸入業者", contact_name: "Kelvin Wong", position: "Purchasing Manager", email: "kelvin@harbourfresh.example.hk", phone: "+852 5555 0101", desired_products: "冷凍水産品、いくら", price_range: "中〜高価格帯", desired_moq: "1パレット〜", incoterms: "CIF", payment_terms: "T/T 30% deposit, 70% before shipment", import_history: "日本産水産品を年間 20コンテナ", status: "取引中" },
    { company_name: "Lion City Gourmet Pte. Ltd.", city: "Singapore", business_type: "スーパー", contact_name: "Rachel Tan", position: "Category Buyer", email: "rachel@lioncitygourmet.example.sg", phone: "+65 6555 0102", desired_products: "日本の菓子・乳製品", price_range: "プレミアム", desired_moq: "混載可", incoterms: "CIF", payment_terms: "Net 30", import_history: "日本食品 200SKU 以上を販売", status: "商談中" },
    { company_name: "Formosa Sweets Co.", city: "Taipei", business_type: "卸売", contact_name: "Jason Lin", position: "Director", email: "jason@formosasweets.example.tw", phone: "+886 2 5555 0103", desired_products: "北海道の焼菓子", price_range: "中価格帯", desired_moq: "1,000箱", incoterms: "FOB", payment_terms: "T/T 100% in advance", import_history: "日本菓子の輸入 5年", status: "取引中" },
    { company_name: "Pacific Table Inc.", city: "Los Angeles", business_type: "飲食", contact_name: "Emily Carter", position: "Head Chef / Owner", email: "emily@pacifictable.example.com", phone: "+1 213 555 0104", desired_products: "刺身用ホタテ", price_range: "高価格帯", desired_moq: "100kg", incoterms: "DDP", payment_terms: "Net 30", import_history: "輸入代行業者経由", status: "Contacted" },
    { company_name: "Seoul Dessert Lab", city: "Seoul", business_type: "EC", contact_name: "Minji Park", position: "MD", email: "minji@dessertlab.example.kr", phone: "+82 2 5555 0105", desired_products: "話題性のある菓子", price_range: "中価格帯", desired_moq: "500箱", incoterms: "CFR", payment_terms: "T/T 100% in advance", status: "Lead" },
    { company_name: "Siam Japan Foods Co., Ltd.", city: "Bangkok", business_type: "輸入業者", contact_name: "Somchai P.", position: "Import Manager", email: "somchai@siamjapanfoods.example.th", phone: "+66 2 555 0106", desired_products: "チーズ、菓子", price_range: "中〜高価格帯", desired_moq: "混載", incoterms: "CIF", payment_terms: "L/C at sight", status: "Lead" },
    { company_name: "Kuala Fresh Mart Sdn. Bhd.", city: "Kuala Lumpur", business_type: "小売", contact_name: "Aisyah Rahman", position: "Buyer", email: "aisyah@kualafresh.example.my", phone: "+60 3 5555 0107", desired_products: "調味料（Halal対応）", price_range: "中価格帯", desired_moq: "300本", incoterms: "FOB", payment_terms: "T/T 30 days after B/L", status: "商談中" },
  ].map((b, i) =>
    tx.insert("buyers", {
      ...blankBuyer(),
      ...(prepareBuyer(b) as Partial<Buyer>),
      code: `BY-${String(i + 1).padStart(4, "0")}`,
      last_contact_at: d(-(i * 3 + 1)),
      next_contact_at: d(i * 2 - 2),
    } as Omit<Buyer, "id" | "created_at" | "updated_at">),
  );

  // 案件（buyer, product, qty, 最終ステージ）
  const plans: { b: number; p: number; qty: number; stage: DealStage; owner: string; costs: Partial<import("./types").CostInputs>; deadline: number }[] = [
    { b: 0, p: 0, qty: 800, stage: "repeat", owner: sales.id, deadline: -10, costs: { packing: 24000, inspection: 15000, domestic_transport: 38000, warehouse: 20000, customs_export: 30000, international_freight: 180000, insurance_rate: 0.3 } },
    { b: 2, p: 3, qty: 3000, stage: "payment", owner: sales.id, deadline: -3, costs: { packing: 30000, domestic_transport: 45000, warehouse: 15000, customs_export: 28000 } },
    { b: 0, p: 1, qty: 200, stage: "shipment", owner: ops.id, deadline: 5, costs: { packing: 12000, inspection: 18000, domestic_transport: 32000, warehouse: 16000, customs_export: 30000, international_freight: 120000, insurance_rate: 0.3 } },
    { b: 1, p: 3, qty: 1500, stage: "order", owner: sales.id, deadline: 12, costs: { packing: 20000, domestic_transport: 30000, warehouse: 10000, customs_export: 25000, international_freight: 90000, insurance_rate: 0.3 } },
    { b: 1, p: 2, qty: 600, stage: "sample", owner: sales.id, deadline: 6, costs: { packing: 8000, domestic_transport: 20000, customs_export: 25000, international_freight: 70000, insurance_rate: 0.3 } },
    { b: 3, p: 0, qty: 100, stage: "quotation", owner: owner.id, deadline: 3, costs: { packing: 6000, inspection: 12000, domestic_transport: 25000, warehouse: 8000, customs_export: 30000, international_freight: 95000, insurance_rate: 0.3, duty_rate: 0, local_cost: 60000 } },
    { b: 6, p: 6, qty: 600, stage: "negotiation", owner: sales.id, deadline: 9, costs: { packing: 9000, domestic_transport: 22000, warehouse: 6000, customs_export: 25000 } },
    { b: 4, p: 4, qty: 800, stage: "meeting", owner: sales.id, deadline: 15, costs: { packing: 10000, domestic_transport: 25000, customs_export: 25000, international_freight: 60000 } },
    { b: 5, p: 2, qty: 500, stage: "contacted", owner: sales.id, deadline: -1, costs: {} },
    { b: 5, p: 3, qty: 1000, stage: "lead", owner: sales.id, deadline: 20, costs: {} },
  ];

  const deals = plans.map((pl) => {
    let deal = createDeal(
      tx,
      { buyer_id: buyers[pl.b].id, product_id: products[pl.p].id, quantity: pl.qty, owner_id: pl.owner, deadline: d(pl.deadline) },
      settings,
    );
    applyCost(tx, deal.id, { ...deal.cost, ...pl.costs, quantity: pl.qty });
    deal = tx.find("deals", deal.id)!;
    return { deal, pl };
  });

  // ステージを順に進めて自動処理（Task・Finance）を発生させる
  const order: DealStage[] = ["contacted", "meeting", "requirement", "matching", "quotation", "sample", "negotiation", "contract", "order", "shipment", "payment", "repeat"];
  for (const { deal, pl } of deals) {
    tx.update("deals", deal.id, { price_approved: order.indexOf(pl.stage) >= order.indexOf("quotation"), contract_approved: order.indexOf(pl.stage) >= order.indexOf("contract") });
    for (const s of order) {
      if (order.indexOf(s) > order.indexOf(pl.stage)) break;
      changeStage(tx, tx.find("deals", deal.id)!, s);
    }
    // 進捗に応じて Checklist を完了させる
    const progress = Math.max(0, order.indexOf(pl.stage) + 1) / order.length;
    const items = tx.all("tasks").filter((t) => t.deal_id === deal.id && t.kind === "checklist").sort((a, b) => a.sort_order - b.sort_order);
    items.slice(0, Math.floor(items.length * progress)).forEach((t) => updateTask(tx, t, { status: "done" }));
    // 過去ステージで自動生成された Follow-up は完了扱い（現ステージのものだけ残す）
    const keep: Partial<Record<DealStage, string>> = { quotation: "quotation_create", sample: "sample_followup", payment: "payment_check", repeat: "repeat_sales" };
    tx.all("tasks")
      .filter((t) => t.deal_id === deal.id && t.kind === "followup" && t.auto_key !== keep[pl.stage])
      .forEach((t) => tx.update("tasks", t.id, { status: "done" }));
    tx.update("deals", deal.id, { next_action: NEXT_ACTION[pl.stage] ?? "要件ヒアリング" });
  }

  // Finance の状態
  for (const f of tx.all("finance")) {
    const deal = tx.find("deals", f.deal_id)!;
    if (deal.stage === "repeat") {
      updateFinance(tx, f, { status: "billed", invoice_date: d(-40), payment_due: d(-10) });
      updateFinance(tx, tx.find("finance", f.id)!, { status: "paid", paid_date: d(-12), paid_amount: f.invoice_amount });
    } else if (deal.stage === "payment") {
      updateFinance(tx, f, { status: "billed", invoice_date: d(-35), payment_due: d(-5) });
    } else if (deal.stage === "shipment") {
      updateFinance(tx, f, { status: "billed", invoice_date: d(-2), payment_due: d(28) });
    }
  }

  // Quotation サンプル
  const qd = deals[5].deal;
  const qdeal = tx.find("deals", qd.id)!;
  const prod = products[0];
  tx.insert("quotations", {
    code: "QT-0001",
    deal_id: qdeal.id,
    buyer_id: qdeal.buyer_id,
    issue_date: d(-1),
    valid_until: d(29),
    currency: qdeal.currency,
    incoterm: qdeal.incoterm,
    port: "Los Angeles, USA",
    payment_terms: "Net 30",
    lead_time: "3-4 weeks after order confirmation",
    items: [{ product_id: prod.id, description: prod.name_en, hs_code: prod.hs_code, quantity: qdeal.quantity, unit: "kg", unit_price: Math.round((qdeal.expected_revenue / qdeal.quantity / qdeal.cost.fx_rate) * 100) / 100, case_qty: prod.case_qty, weight_kg: prod.weight_kg }],
    notes: "Prices are subject to final confirmation of shipping schedule.",
    status: "sent",
  });
  log(tx, "quotation", "Quotation QT-0001 を作成", { deal_id: qdeal.id });

  // 個別 Task
  tx.insert("tasks", { title: "北海道フードフェア出展の申込", deal_id: null, kind: "general", group_name: "", assignee_id: owner.id, due_date: d(5), status: "todo", note: "", attachments: [], sort_order: 0, auto_key: "" });
  tx.insert("tasks", { title: "ニセコ醸造所へ輸出向け価格表を再依頼", deal_id: null, kind: "general", group_name: "", assignee_id: sales.id, due_date: d(-2), status: "in_progress", note: "", attachments: [], sort_order: 0, auto_key: "" });

  // Activity の時刻をばらす（デモ用）
  const acts = tx.all("activities");
  acts.forEach((a, i) => {
    (a as { created_at: string }).created_at = new Date(Date.now() - i * 1000 * 60 * 47).toISOString();
  });

  return { db: tx.db, settings };
}
