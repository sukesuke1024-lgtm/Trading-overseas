// 仕様書「6. 自動化」のルールをここに集約する。
// すべて Tx 上で動くので、元の操作と自動処理は 1 トランザクションで保存される。
import { buildChecklist } from "./checklist";
import { COUNTRIES, STAGES, countryOf, isWon, paymentStatusLabel, stageIndex, stageLabel } from "./constants";
import { calcCost, defaultCost } from "./cost";
import { addDays, today } from "./format";
import type { Tx } from "./store/tx";
import { nextCode } from "./store/tx";
import type { ActivityType, Buyer, CompanySettings, Deal, DealStage, FinanceRecord, Product, Task } from "./types";

export function log(
  tx: Tx,
  type: ActivityType,
  message: string,
  opts: { deal_id?: string | null; entity_type?: "deal" | "producer" | "buyer" | "product" | "finance" | "system"; entity_id?: string | null } = {},
) {
  tx.insert("activities", {
    deal_id: opts.deal_id ?? null,
    entity_type: opts.entity_type ?? (opts.deal_id ? "deal" : "system"),
    entity_id: opts.entity_id ?? opts.deal_id ?? null,
    type,
    message,
    actor: tx.actor,
  });
}

/** 自動タスク。auto_key が既にあれば作らない（重複防止） */
export function autoTask(tx: Tx, dealId: string | null, autoKey: string, title: string, dueInDays: number, extra: Partial<Task> = {}) {
  if (dealId && tx.all("tasks").some((t) => t.deal_id === dealId && t.auto_key === autoKey)) return null;
  const deal = tx.find("deals", dealId);
  const task = tx.insert("tasks", {
    title,
    deal_id: dealId,
    kind: "followup",
    group_name: "",
    assignee_id: deal?.owner_id ?? null,
    due_date: addDays(today(), dueInDays),
    status: "todo",
    note: "",
    attachments: [],
    sort_order: 0,
    auto_key: autoKey,
    ...extra,
  });
  log(tx, "task", `Task自動生成：${title}`, { deal_id: dealId });
  return task;
}

// ---------- Buyer ----------

/** 電話番号・Email/Webサイトのドメインから国を推定する（Buyer登録 → Country自動設定） */
export function inferCountry(b: Partial<Buyer>): string {
  const phone = (b.phone || b.whatsapp || "").replace(/[\s-()]/g, "");
  if (phone.startsWith("+")) {
    const hit = [...COUNTRIES].sort((a, z) => z.dial.length - a.dial.length).find((c) => phone.startsWith(c.dial));
    if (hit) return hit.dial === "+1" ? "US" : hit.code;
  }
  const domain = (b.email?.split("@")[1] || b.website?.replace(/^https?:\/\//, "").split("/")[0] || "").toLowerCase();
  const tld = domain.split(".").pop() || "";
  const map: Record<string, string> = { uk: "GB", sg: "SG", hk: "HK", tw: "TW", cn: "CN", kr: "KR", th: "TH", vn: "VN", my: "MY", ph: "PH", id: "ID", au: "AU", nz: "NZ", fr: "FR", de: "DE", nl: "NL", it: "IT", ae: "AE", sa: "SA", in: "IN", mx: "MX", br: "BR", ca: "CA", us: "US" };
  return map[tld] ?? "";
}

export function prepareBuyer(b: Partial<Buyer>): Partial<Buyer> {
  const country = b.country || inferCountry(b);
  return { ...b, country, currency: b.currency || countryOf(country)?.currency || "USD" };
}

// ---------- Product ----------

export function prepareProduct(tx: Tx, p: Partial<Product>): Partial<Product> {
  const producer = tx.find("producers", p.producer_id);
  return {
    ...p,
    category: p.category || producer?.categories?.[0] || "",
    storage: p.storage || producer?.storage_temp || "",
    certifications: p.certifications?.length ? p.certifications : producer?.certifications ?? [],
  };
}

// ---------- Deal ----------

export interface NewDealInput {
  title?: string;
  buyer_id: string | null;
  product_id: string | null;
  producer_id?: string | null;
  country?: string;
  quantity?: number;
  incoterm?: Deal["incoterm"];
  stage?: DealStage;
  deadline?: string;
  next_action?: string;
  owner_id?: string | null;
  notes?: string;
}

export function createDeal(tx: Tx, input: NewDealInput, settings: CompanySettings) {
  const buyer = tx.find("buyers", input.buyer_id);
  const product = tx.find("products", input.product_id);
  const producerId = input.producer_id || product?.producer_id || null;
  const producer = tx.find("producers", producerId);
  const country = input.country || buyer?.country || "";
  const currency = buyer?.currency || countryOf(country)?.currency || "USD";
  const quantity = input.quantity ?? product?.moq ?? 0;
  const incoterm = input.incoterm || (buyer?.incoterms as Deal["incoterm"]) || "FOB";
  const stage = input.stage ?? "lead";
  const fee = producer?.commission_rate ?? settings.default_commission;

  const cost = defaultCost({
    incoterm: ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"].includes(incoterm) ? incoterm : "FOB",
    currency,
    fx_rate: settings.fx_rates[currency] ?? 1,
    quantity,
    unit_cost: product?.cost_price ?? 0,
    fee_value: fee,
  });
  const r = calcCost(cost);

  const deal = tx.insert("deals", {
    code: nextCode(tx.all("deals"), "DL-"),
    title: input.title || [buyer?.company_name, product?.name].filter(Boolean).join(" × ") || "新規案件",
    buyer_id: input.buyer_id,
    producer_id: producerId,
    product_id: input.product_id,
    country,
    quantity,
    unit: "pcs",
    currency,
    incoterm: cost.incoterm,
    payment_terms: buyer?.payment_terms || "",
    expected_revenue: r.revenue,
    expected_profit: r.profit,
    probability: STAGES.find((s) => s.key === stage)?.probability ?? 5,
    stage,
    next_action: input.next_action || "要件ヒアリング",
    deadline: input.deadline || addDays(today(), 14),
    owner_id: input.owner_id ?? null,
    cost,
    price_approved: false,
    contract_approved: false,
    notes: input.notes || "",
  });

  log(tx, "created", `Deal作成：${deal.code} ${deal.title}`, { deal_id: deal.id });

  // Deal作成 → Export Checklist生成（商品 × 輸出国）
  if (country) generateChecklist(tx, deal, product);
  return deal;
}

export function generateChecklist(tx: Tx, deal: Deal, product?: Product | null) {
  const items = buildChecklist(deal.country, product);
  const existing = new Set(tx.all("tasks").filter((t) => t.deal_id === deal.id && t.kind === "checklist").map((t) => t.auto_key));
  const base = deal.created_at.slice(0, 10);
  let added = 0;
  items.forEach((it, i) => {
    if (existing.has(`cl:${it.key}`)) return;
    tx.insert("tasks", {
      title: it.title,
      deal_id: deal.id,
      kind: "checklist",
      group_name: it.group,
      assignee_id: deal.owner_id,
      due_date: addDays(base, it.offset),
      status: "todo",
      note: "",
      attachments: [],
      sort_order: i,
      auto_key: `cl:${it.key}`,
    });
    added++;
  });
  if (added) log(tx, "system", `Export Checklist を自動生成（${countryOf(deal.country)?.name ?? deal.country} × ${product?.name ?? "商品未設定"}：${added}項目）`, { deal_id: deal.id });
  return added;
}

/** Deal の原価計算を更新し、売上・利益の見込みを同期する */
export function applyCost(tx: Tx, dealId: string, cost: Deal["cost"]) {
  const r = calcCost(cost);
  const deal = tx.update("deals", dealId, {
    cost,
    quantity: cost.quantity,
    incoterm: cost.incoterm,
    currency: cost.currency,
    expected_revenue: r.revenue,
    expected_profit: r.profit,
    price_approved: false,
  });
  const fin = tx.all("finance").find((f) => f.deal_id === dealId);
  if (fin && fin.status !== "paid") syncFinance(tx, fin, deal!);
  log(tx, "note", `輸出原価を更新：売上 ¥${Math.round(r.revenue).toLocaleString()} / 粗利 ¥${Math.round(r.profit).toLocaleString()}（価格は再承認待ち）`, { deal_id: dealId });
}

export function changeStage(tx: Tx, deal: Deal, stage: DealStage) {
  if (deal.stage === stage) return deal;
  const from = deal.stage;
  const updated = tx.update("deals", deal.id, {
    stage,
    probability: stage === "lost" ? 0 : STAGES.find((s) => s.key === stage)?.probability ?? deal.probability,
  })!;

  // Status変更 → Activity Log記録
  log(tx, "status_change", `Status変更：${stageLabel(from)} → ${stageLabel(stage)}`, { deal_id: deal.id });

  // Sample発送 → Follow-up Task自動生成
  if (stage === "sample") {
    autoTask(tx, deal.id, "sample_followup", "Sample到着確認・Buyerへ評価Follow-up", 7);
  }
  if (stage === "quotation") {
    autoTask(tx, deal.id, "quotation_create", "Quotation作成・送付", 2);
  }
  // 受注以降は Finance レコードを用意
  if (isWon(stage)) ensureFinance(tx, updated);
  // Shipment完了（=Payment ステージへ進む）→ Payment確認Task生成
  if (stageIndex(stage) >= stageIndex("payment") && stage !== "lost") {
    autoTask(tx, deal.id, "payment_check", "Payment確認（入金照合）", 3);
  }
  if (stage === "repeat") {
    autoTask(tx, deal.id, "repeat_sales", "Repeat営業：次回発注のヒアリング", 30);
  }
  return updated;
}

// ---------- Task ----------

export function updateTask(tx: Tx, task: Task, patch: Partial<Task>) {
  const updated = tx.update("tasks", task.id, patch)!;
  if (patch.status && patch.status !== task.status && task.deal_id) {
    if (patch.status === "done") log(tx, "task", `完了：${task.title}`, { deal_id: task.deal_id });
    // Checklist の Shipment 完了 → Payment確認Task生成
    if (patch.status === "done" && task.auto_key === "cl:shipment") {
      autoTask(tx, task.deal_id, "payment_check", "Payment確認（入金照合）", 14);
      const deal = tx.find("deals", task.deal_id);
      // 自動で進めるのは契約承認済み（Contract / Order）の案件のみ。承認前の案件は人が判断する
      if (deal && deal.contract_approved && isWon(deal.stage) && stageIndex(deal.stage) < stageIndex("shipment")) changeStage(tx, deal, "shipment");
    }
  }
  return updated;
}

// ---------- Finance ----------

export function ensureFinance(tx: Tx, deal: Deal) {
  const existing = tx.all("finance").find((f) => f.deal_id === deal.id);
  if (existing) return existing;
  const r = calcCost(deal.cost);
  const fin = tx.insert("finance", {
    deal_id: deal.id,
    invoice_no: nextCode(tx.all("finance").map((f) => ({ code: f.invoice_no })), "INV-"),
    currency: deal.currency,
    exchange_rate: deal.cost.fx_rate,
    revenue: r.revenue,
    cost: r.cost,
    invoice_amount: Math.round(r.revenueFx * 100) / 100,
    invoice_date: "",
    payment_due: "",
    paid_date: "",
    paid_amount: 0,
    status: "unbilled",
    producer_payment: r.producerPayment,
    logistics_payment: r.logisticsPayment,
    notes: "",
  });
  log(tx, "payment", `Financeレコード作成：${fin.invoice_no}`, { deal_id: deal.id });
  return fin;
}

function syncFinance(tx: Tx, fin: FinanceRecord, deal: Deal) {
  const r = calcCost(deal.cost);
  tx.update("finance", fin.id, {
    currency: deal.currency,
    exchange_rate: deal.cost.fx_rate,
    revenue: r.revenue,
    cost: r.cost,
    invoice_amount: Math.round(r.revenueFx * 100) / 100,
    producer_payment: r.producerPayment,
    logistics_payment: r.logisticsPayment,
  });
}

export function updateFinance(tx: Tx, fin: FinanceRecord, patch: Partial<FinanceRecord>) {
  const updated = tx.update("finance", fin.id, patch)!;
  if (patch.status && patch.status !== fin.status) {
    log(tx, "payment", `入金Status：${paymentStatusLabel(fin.status)} → ${paymentStatusLabel(patch.status)}（${fin.invoice_no}）`, { deal_id: fin.deal_id, entity_type: "finance", entity_id: fin.id });
    // Payment完了 → Repeat営業Task生成
    if (patch.status === "paid") {
      autoTask(tx, fin.deal_id, "repeat_sales", "Repeat営業：次回発注のヒアリング", 30);
      for (const t of tx.all("tasks").filter((t) => t.deal_id === fin.deal_id && (t.auto_key === "payment_check" || t.auto_key === "cl:payment_confirm"))) {
        if (t.status !== "done") tx.update("tasks", t.id, { status: "done" });
      }
    }
  }
  return updated;
}
