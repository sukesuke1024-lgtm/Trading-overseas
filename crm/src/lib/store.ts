"use client";
import { useSyncExternalStore } from "react";
import type { Activity, ActivityType, Contact, Data, Deal, DealLine, Decision, FxForward, MailLog, Notice, Organization, Product, Sale, StageId, Task, User } from "./types";
import { nextSaleNo, paymentJournal, saleAmounts, salesJournal } from "./journal";
import { rateNow } from "./fx";
import { DATA_VERSION, makeSeed } from "./seed";
import { stageOf } from "./constants";

// モック段階の永続化はブラウザの localStorage。Phase 実装時は同じ関数シグネチャのまま Supabase 呼び出しに差し替える。
const KEY = "hlink-crm.v2";
const SESSION = "hlink-crm.session";

interface State { data: Data | null; meId: string | null; theme: "light" | "dark" }
let state: State = { data: null, meId: null, theme: "light" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit(); };

const read = (k: string, s: Storage | undefined) => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const write = (k: string, v: string, s: Storage | undefined) => { try { s?.setItem(k, v); } catch { /* 保存不可の環境でも画面は動かす */ } };
const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);
const ss = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function initStore() {
  if (state.data) return;
  let data: Data | null = null;
  const raw = read(KEY, ls());
  if (raw) { try { const p = JSON.parse(raw) as Data; if (p.version === DATA_VERSION) data = p; } catch { /* 破損時は初期化 */ } }
  if (!data) { data = makeSeed(); write(KEY, JSON.stringify(data), ls()); }
  const meId = read(SESSION, ss());
  const theme = (read("hlink-crm.theme", ls()) as "light" | "dark" | null) ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  set({ data, meId: meId && data.users.some((u) => u.id === meId) ? meId : null, theme });
}

export const getSnapshot = () => state;

export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useMe(): User | null {
  const s = useStore();
  return s.data?.users.find((u) => u.id === s.meId) ?? null;
}

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function commit(mut: (d: Data) => Data, audit?: { action: string; entity: string; label: string }) {
  if (!state.data) return;
  let next = mut(state.data);
  if (audit && state.meId) {
    next = { ...next, audit: [{ id: uid("l"), at: new Date().toISOString(), userId: state.meId, ...audit }, ...next.audit].slice(0, 500) };
  }
  write(KEY, JSON.stringify(next), ls());
  set({ data: next });
}

// ---- 認証（モック。実装時は Supabase Auth）----
export const login = (userId: string) => { write(SESSION, userId, ss()); set({ meId: userId }); };
export const logout = () => { try { ss()?.removeItem(SESSION); } catch { /* noop */ } set({ meId: null }); };
export const switchUser = login;
export function toggleTheme() {
  const theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  write("hlink-crm.theme", theme, ls());
  set({ theme });
}
export function resetDemo() {
  const data = makeSeed();
  write(KEY, JSON.stringify(data), ls());
  set({ data });
}

// ---- 取引先・担当者 ----
export const addOrg = (o: Omit<Organization, "id" | "createdAt">) => {
  const id = uid("o");
  commit((d) => ({ ...d, organizations: [{ ...o, id, createdAt: new Date().toISOString() }, ...d.organizations] }), { action: "作成", entity: "顧客", label: o.name });
  return id;
};
export const updateOrg = (id: string, patch: Partial<Organization>) =>
  commit((d) => ({ ...d, organizations: d.organizations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), { action: "更新", entity: "顧客", label: `${state.data?.organizations.find((o) => o.id === id)?.name}（${Object.keys(patch).join("・")}）` });
export const deleteOrg = (id: string) => {
  const name = state.data?.organizations.find((o) => o.id === id)?.name ?? id;
  commit((d) => ({
    ...d, organizations: d.organizations.filter((o) => o.id !== id), contacts: d.contacts.filter((c) => c.orgId !== id),
    deals: d.deals.filter((x) => x.orgId !== id), activities: d.activities.filter((a) => a.orgId !== id), tasks: d.tasks.filter((t) => t.orgId !== id),
  }), { action: "削除", entity: "顧客", label: name });
};
export const addContact = (c: Omit<Contact, "id">) => {
  const id = uid("c");
  commit((d) => ({ ...d, contacts: [...d.contacts, { ...c, id }] }), { action: "作成", entity: "担当者", label: c.name });
  return id;
};
export const updateContact = (id: string, patch: Partial<Contact>) =>
  commit((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), { action: "更新", entity: "担当者", label: `${state.data?.contacts.find((c) => c.id === id)?.name}（${Object.keys(patch).join("・")}）` });
export const deleteContact = (id: string) =>
  commit((d) => ({ ...d, contacts: d.contacts.filter((c) => c.id !== id), deals: d.deals.map((x) => (x.contactId === id ? { ...x, contactId: null } : x)) }), { action: "削除", entity: "担当者", label: state.data?.contacts.find((c) => c.id === id)?.name ?? id });

// ---- 案件 ----
export const addDeal = (x: Omit<Deal, "id" | "createdAt" | "stageChangedAt" | "closedAt" | "probability" | "lostReason" | "lines" | "payTerm" | "incoterm" | "decision"> & Partial<Pick<Deal, "lines" | "payTerm" | "incoterm">>, nextAction?: { title: string; type: ActivityType; due: string | null }) => {
  const id = uid("d");
  const now = new Date().toISOString();
  const deal: Deal = { lines: [], payTerm: "", incoterm: "", ...x, decision: null, id, probability: stageOf(x.stage).probability, lostReason: "", createdAt: now, stageChangedAt: now, closedAt: null };
  commit((d) => ({ ...d, deals: [deal, ...d.deals] }), { action: "作成", entity: "案件", label: x.name });
  if (nextAction?.title) setNextAction(id, nextAction);
  return id;
};
export const updateDeal = (id: string, patch: Partial<Deal>) =>
  commit((d) => ({ ...d, deals: d.deals.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), { action: "更新", entity: "案件", label: `${state.data?.deals.find((x) => x.id === id)?.name}（${Object.keys(patch).join("・")}）` });
export const deleteDeal = (id: string) =>
  commit((d) => ({ ...d, deals: d.deals.filter((x) => x.id !== id), tasks: d.tasks.filter((t) => t.dealId !== id), activities: d.activities.map((a) => (a.dealId === id ? { ...a, dealId: null } : a)) }), { action: "削除", entity: "案件", label: state.data?.deals.find((x) => x.id === id)?.name ?? id });

/** ステージ移動。確度は新ステージの標準値に合わせ、受注／失注は完了日を記録し、未完了の Next Action を閉じる。 */
export function moveStage(id: string, stage: StageId, lostReason = "") {
  const st = stageOf(stage);
  const now = new Date().toISOString();
  commit((d) => ({
    ...d,
    deals: d.deals.map((x) => (x.id === id ? { ...x, stage, probability: st.probability, stageChangedAt: now, closedAt: st.kind === "won" || st.kind === "lost" ? now : null, lostReason: st.kind === "lost" ? lostReason : "" } : x)),
    tasks: st.kind === "won" || st.kind === "lost"
      ? d.tasks.map((t) => (t.dealId === id && t.status === "open" && t.isNextAction ? { ...t, status: "done", doneAt: now } : t))
      : d.tasks,
  }), { action: "ステージ変更", entity: "案件", label: `${state.data?.deals.find((x) => x.id === id)?.name} → ${st.label}${lostReason ? `（${lostReason}）` : ""}` });
  if (st.kind === "won") createSaleFromDeal(id); // 受注したら、明細どおりの売上と仕訳を自動で計上する
}

/** 明細を更新し、案件金額を Σ(数量×単価) に揃える（売上・仕訳の元になる金額を常に明細と一致させる） */
export function setDealLines(id: string, lines: DealLine[]) {
  const amount = Math.round(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0) * 100) / 100;
  commit((d) => ({ ...d, deals: d.deals.map((x) => (x.id === id ? { ...x, lines, amount } : x)) }), { action: "明細を更新", entity: "案件", label: `${state.data?.deals.find((x) => x.id === id)?.name}（${amount.toLocaleString()}）` });
}
export const setDecision = (id: string, decision: Decision | null) =>
  commit((d) => ({ ...d, deals: d.deals.map((x) => (x.id === id ? { ...x, decision } : x)) }), { action: "契約可否の判定", entity: "案件", label: `${state.data?.deals.find((x) => x.id === id)?.name}：${decision?.label ?? "取り消し"}` });

/** 案件の Next Action を設定（既存の未完了 Next Action は置き換える）。 */
export function setNextAction(dealId: string, na: { title: string; type: ActivityType; due: string | null }, assigneeId?: string) {
  commit((d) => {
    const deal = d.deals.find((x) => x.id === dealId);
    if (!deal) return d;
    const existing = d.tasks.find((t) => t.dealId === dealId && t.isNextAction && t.status === "open");
    if (existing) {
      return { ...d, tasks: d.tasks.map((t) => (t.id === existing.id ? { ...t, title: na.title, type: na.type, dueDate: na.due, assigneeId: assigneeId ?? t.assigneeId } : t)) };
    }
    const t: Task = { id: uid("k"), title: na.title, type: na.type, orgId: deal.orgId, dealId, contactId: deal.contactId, assigneeId: assigneeId ?? deal.ownerId, dueDate: na.due, status: "open", isNextAction: true, createdAt: new Date().toISOString(), doneAt: null };
    return { ...d, tasks: [t, ...d.tasks] };
  }, { action: "Next Action 設定", entity: "案件", label: `${state.data?.deals.find((x) => x.id === dealId)?.name}：${na.title}` });
}

// ---- Task ----
export const addTask = (t: Omit<Task, "id" | "createdAt" | "doneAt" | "status">) => {
  const id = uid("k");
  commit((d) => ({ ...d, tasks: [{ ...t, id, status: "open", createdAt: new Date().toISOString(), doneAt: null }, ...d.tasks] }), { action: "作成", entity: "Task", label: t.title });
  return id;
};
export const updateTask = (id: string, patch: Partial<Task>) =>
  commit((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
export const completeTask = (id: string, done = true) =>
  commit((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status: done ? "done" : "open", doneAt: done ? new Date().toISOString() : null } : t)) }), { action: done ? "完了" : "再開", entity: "Task", label: state.data?.tasks.find((t) => t.id === id)?.title ?? id });
export const deleteTask = (id: string) =>
  commit((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }), { action: "削除", entity: "Task", label: state.data?.tasks.find((t) => t.id === id)?.title ?? id });

// ---- 活動 ----
export const addActivity = (a: Omit<Activity, "id" | "userId" | "at"> & { at?: string }) => {
  const id = uid("a");
  const meId = state.meId ?? state.data!.users[0].id;
  commit((d) => ({ ...d, activities: [{ ...a, id, userId: meId, at: a.at ?? new Date().toISOString() }, ...d.activities] }),
    { action: "活動を記録", entity: "活動", label: `${state.data?.organizations.find((o) => o.id === a.orgId)?.name}：${a.summary}` });
  return id;
};
export const deleteActivity = (id: string) =>
  commit((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) }), { action: "削除", entity: "活動", label: state.data?.activities.find((a) => a.id === id)?.summary ?? id });

// ---- ユーザー ----
export const updateUser = (id: string, patch: Partial<User>) =>
  commit((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }), { action: "更新", entity: "ユーザー", label: `${state.data?.users.find((u) => u.id === id)?.name}（${Object.keys(patch).join("・")}）` });

// ---- UI状態：活動記録パネル ----
let quickOpen: { open: boolean; orgId?: string; dealId?: string; contactId?: string } = { open: false };
const qListeners = new Set<() => void>();
export const openQuickLog = (preset: { orgId?: string; dealId?: string; contactId?: string } = {}) => { quickOpen = { open: true, ...preset }; qListeners.forEach((l) => l()); };
export const closeQuickLog = () => { quickOpen = { open: false }; qListeners.forEach((l) => l()); };
export const useQuickLog = () => useSyncExternalStore((l) => { qListeners.add(l); return () => { qListeners.delete(l); }; }, () => quickOpen, () => quickOpen);


// ---- 売上と仕訳（売上金額＝仕訳の売上高）----
const jid = (d: Data) => `J-${String(d.journals.length + 1).padStart(6, "0")}`;
const partnerOf = (d: Data, orgId: string) => d.organizations.find((o) => o.id === orgId)?.name ?? "";

/** 受注した案件から売上を計上（すでにあれば何もしない）。計上レートは計上日の現在レート */
export function createSaleFromDeal(dealId: string, date = new Date().toISOString().slice(0, 10)) {
  if (!state.data) return;
  const deal = state.data.deals.find((x) => x.id === dealId);
  if (!deal || state.data.sales.some((s) => s.dealId === dealId)) return;
  const lines = (deal.lines.length ? deal.lines : [{ id: "x", productId: "", name: deal.name, qty: 1, unit: "式", unitPrice: deal.amount }]).map((l) => ({ desc: l.name, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice }));
  const rate = deal.currency === "JPY" ? 1 : rateNow(deal.currency);
  commit((d) => {
    const { amount, amountJPY } = saleAmounts(lines, rate);
    const sale: Sale = { id: uid("s"), no: nextSaleNo(d.sales, date), dealId, orgId: deal.orgId, date, currency: deal.currency, lines, amount, rate, amountJPY, status: "計上済", paidDate: null, receivedJPY: null, bankFeeJPY: null };
    return { ...d, sales: [...d.sales, sale], journals: [...d.journals, salesJournal(sale, partnerOf(d, deal.orgId), jid(d))] };
  }, { action: "売上計上", entity: "売上", label: deal.name });
}

/** 入金を登録：実入金・銀行手数料・為替差損益を仕訳にし、売掛金を消し込む */
export function recordPayment(saleId: string, date: string, receivedJPY: number, bankFeeJPY: number) {
  commit((d) => {
    const sale = d.sales.find((s) => s.id === saleId);
    if (!sale) return d;
    const next: Sale = { ...sale, status: "入金済", paidDate: date, receivedJPY, bankFeeJPY };
    const journals = d.journals.filter((j) => !(j.saleId === saleId && j.kind === "入金"));
    return { ...d, sales: d.sales.map((s) => (s.id === saleId ? next : s)), journals: [...journals, paymentJournal(next, partnerOf(d, sale.orgId), jid({ ...d, journals }), date, receivedJPY, bankFeeJPY)] };
  }, { action: "入金登録", entity: "売上", label: state.data?.sales.find((s) => s.id === saleId)?.no ?? saleId });
}

/** 売上の明細・レートを修正（仕訳は自動では変わらない。照合で『不一致』になり、再計上で揃える） */
export function updateSale(saleId: string, patch: { lines?: Sale["lines"]; rate?: number }) {
  commit((d) => ({ ...d, sales: d.sales.map((s) => {
    if (s.id !== saleId) return s;
    const lines = patch.lines ?? s.lines, rate = patch.rate ?? s.rate;
    const { amount, amountJPY } = saleAmounts(lines, rate);
    return { ...s, lines, rate, amount, amountJPY };
  }) }), { action: "売上を修正", entity: "売上", label: state.data?.sales.find((s) => s.id === saleId)?.no ?? saleId });
}

/** 売上から仕訳を作り直す（売上と仕訳の金額を一致させる） */
export function repostSale(saleId: string) {
  commit((d) => {
    const sale = d.sales.find((s) => s.id === saleId);
    if (!sale) return d;
    const rest = d.journals.filter((j) => j.saleId !== saleId);
    const out = [...rest, salesJournal(sale, partnerOf(d, sale.orgId), jid({ ...d, journals: rest }))];
    if (sale.status === "入金済" && sale.paidDate && sale.receivedJPY !== null) out.push(paymentJournal(sale, partnerOf(d, sale.orgId), jid({ ...d, journals: out }), sale.paidDate, sale.receivedJPY, sale.bankFeeJPY ?? 0));
    return { ...d, journals: out };
  }, { action: "仕訳を再計上", entity: "売上", label: state.data?.sales.find((s) => s.id === saleId)?.no ?? saleId });
}

// ---- 為替予約 ----
export const addForward = (f: Omit<FxForward, "id" | "status">) => commit((d) => ({ ...d, forwards: [...d.forwards, { ...f, id: uid("f"), status: "open" }] }), { action: "為替予約を登録", entity: "為替予約", label: `${f.currency} ${f.amount.toLocaleString()} @ ${f.rate}` });
export const updateForward = (id: string, patch: Partial<FxForward>) => commit((d) => ({ ...d, forwards: d.forwards.map((f) => (f.id === id ? { ...f, ...patch } : f)) }), { action: "為替予約を更新", entity: "為替予約", label: id });
export const deleteForward = (id: string) => commit((d) => ({ ...d, forwards: d.forwards.filter((f) => f.id !== id) }), { action: "削除", entity: "為替予約", label: id });

// ---- 商品カタログ ----
export const updateProduct = (id: string, patch: Partial<Product>) => commit((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), { action: "商品を更新", entity: "商品", label: `${state.data?.products.find((p) => p.id === id)?.name}（${Object.keys(patch).join("・")}）` });
export const addProduct = (p: Omit<Product, "id">) => { const id = uid("p"); commit((d) => ({ ...d, products: [...d.products, { ...p, id }] }), { action: "商品を追加", entity: "商品", label: p.name }); return id; };

// ---- 営業部のお知らせ ----
export const addNotice = (n: Omit<Notice, "id" | "date" | "authorId">) => commit((d) => ({ ...d, notices: [{ ...n, id: uid("n"), date: new Date().toISOString().slice(0, 10), authorId: state.meId ?? "" }, ...d.notices] }), { action: "お知らせを投稿", entity: "営業部のお知らせ", label: n.title });
export const deleteNotice = (id: string) => commit((d) => ({ ...d, notices: d.notices.filter((n) => n.id !== id) }), { action: "削除", entity: "営業部のお知らせ", label: state.data?.notices.find((n) => n.id === id)?.title ?? id });
export const toggleNoticePin = (id: string) => commit((d) => ({ ...d, notices: d.notices.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) }));

// ---- メール一斉配信（配信した相手ごとに「Email」の活動を自動記録）----
export function logMailSend(m: Omit<MailLog, "id" | "at" | "userId">, contactIds: string[], note: string) {
  const meId = state.meId ?? "";
  commit((d) => {
    const at = new Date().toISOString();
    const acts: Activity[] = contactIds.flatMap((cid) => {
      const c = d.contacts.find((x) => x.id === cid);
      if (!c) return [];
      const deal = d.deals.filter((x) => x.orgId === c.orgId && x.stage !== "won" && x.stage !== "lost").sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt))[0];
      return [{ id: uid("a"), type: "email" as const, orgId: c.orgId, contactId: c.id, dealId: deal?.id ?? null, userId: meId, at, summary: `メール配信：${m.subject}`, note }];
    });
    return { ...d, mailLogs: [{ ...m, id: uid("m"), at, userId: meId }, ...d.mailLogs].slice(0, 200), activities: [...acts, ...d.activities] };
  }, { action: "メール配信", entity: "メール", label: `${m.subject}（${m.count}件・${m.via}）` });
}

// ---- 従業員名簿（社内ポータルと一致させる）----
export function applyRoster(users: User[], removeMissing: boolean) {
  commit((d) => {
    const incoming = new Map(users.map((u) => [u.id, u]));
    const keep = d.users.filter((u) => incoming.has(u.id) || !removeMissing);
    const merged = [...keep.map((u) => (incoming.has(u.id) ? { ...u, ...incoming.get(u.id)!, hue: u.hue } : u)), ...users.filter((u) => !d.users.some((x) => x.id === u.id))];
    const ids = new Set(merged.map((u) => u.id));
    const fix = <T extends { ownerId?: string }>(x: T) => (x.ownerId && !ids.has(x.ownerId) ? { ...x, ownerId: "" } : x);
    return { ...d, users: merged, organizations: d.organizations.map(fix), deals: d.deals.map(fix) };
  }, { action: "従業員名簿を取り込み", entity: "ユーザー", label: `${users.length}名${removeMissing ? "（名簿にいない人を削除）" : ""}` });
  // 自分が名簿から外れた場合はログアウトさせる
  if (state.meId && !state.data?.users.some((u) => u.id === state.meId)) logout();
}
