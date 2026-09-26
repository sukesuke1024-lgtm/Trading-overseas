import { STAGES, isWon, stageIndex } from "./constants";
import { daysBetween, today } from "./format";
import type { Database, Deal, FinanceRecord, Task } from "./types";

export interface Alert {
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export const isOpenTask = (t: Task) => t.status !== "done" && t.status !== "na";

export function financeOverdue(f: FinanceRecord, now = today()) {
  return f.status !== "paid" && !!f.payment_due && f.payment_due < now;
}

export function outstanding(f: FinanceRecord) {
  if (f.status === "paid") return 0;
  const rate = f.exchange_rate || 1;
  return Math.max(0, (f.invoice_amount - (f.paid_amount || 0)) * rate);
}

export function alerts(db: Database): Alert[] {
  const now = today();
  const out: Alert[] = [];
  const dealName = new Map(db.deals.map((d) => [d.id, `${d.code} ${d.title}`]));

  for (const f of db.finance) {
    if (financeOverdue(f, now)) {
      out.push({
        level: "critical",
        title: `入金期限超過：${f.invoice_no}`,
        detail: `${dealName.get(f.deal_id) ?? ""}｜期限 ${f.payment_due}（${daysBetween(f.payment_due, now)}日超過）`,
        href: `/finance`,
      });
    }
  }
  for (const t of db.tasks) {
    if (!isOpenTask(t) || !t.due_date) continue;
    const diff = daysBetween(now, t.due_date);
    if (diff < 0)
      out.push({ level: "warning", title: `期限超過Task：${t.title}`, detail: `${t.deal_id ? dealName.get(t.deal_id) ?? "" : "個別Task"}｜${-diff}日超過`, href: t.deal_id ? `/deals/${t.deal_id}` : "/tasks" });
  }
  for (const d of db.deals) {
    if (d.stage === "lost" || d.stage === "repeat" || !d.deadline) continue;
    const diff = daysBetween(now, d.deadline);
    if (diff < 0) out.push({ level: "warning", title: `Deal期限超過：${d.code}`, detail: `${d.title}｜Next: ${d.next_action || "未設定"}`, href: `/deals/${d.id}` });
    else if (diff <= 3) out.push({ level: "info", title: `Deal期限接近：${d.code}`, detail: `${d.title}｜あと${diff}日`, href: `/deals/${d.id}` });
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** 当月に「成約（Contract 以降）」した案件の売上・粗利（Finance があれば Finance 優先） */
export function monthly(db: Database, month = today().slice(0, 7)) {
  const fin = new Map(db.finance.map((f) => [f.deal_id, f]));
  let revenue = 0;
  let profit = 0;
  for (const d of db.deals) {
    if (!isWon(d.stage)) continue;
    const f = fin.get(d.id);
    const date = (f?.invoice_date || wonDate(db, d) || d.updated_at).slice(0, 7);
    if (date !== month) continue;
    revenue += f ? f.revenue : d.expected_revenue;
    profit += f ? f.revenue - f.cost : d.expected_profit;
  }
  return { revenue, profit, margin: revenue > 0 ? profit / revenue : 0 };
}

function wonDate(db: Database, d: Deal) {
  return db.activities.find((a) => a.deal_id === d.id && a.type === "status_change" && /→ (Contract|Order)/.test(a.message))?.created_at;
}

export function countInMonth(db: Database, re: RegExp, month = today().slice(0, 7)) {
  const ids = new Set<string>();
  for (const a of db.activities) if (a.created_at.slice(0, 7) === month && a.deal_id && re.test(a.message)) ids.add(a.deal_id);
  return ids.size;
}

export function pipeline(db: Database) {
  return STAGES.map((s) => {
    const deals = db.deals.filter((d) => d.stage === s.key);
    return { ...s, count: deals.length, amount: deals.reduce((sum, d) => sum + d.expected_revenue, 0) };
  });
}

export function activeDeals(db: Database) {
  return db.deals.filter((d) => d.stage !== "lost" && stageIndex(d.stage) < stageIndex("repeat"));
}

export function groupCount<T>(items: T[], key: (t: T) => string | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || "未設定";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
