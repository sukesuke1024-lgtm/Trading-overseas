"use client";
import { useSyncExternalStore } from "react";
import type { Activity, ActivityType, Contact, CreditReview, Data, Deal, DealLine, Decision, FxForward, MailLog, Notice, Organization, Product, Sale, Screening, StageId, Task, User } from "./types";
import { evaluate, validUntil, type CreditInput, type Policy } from "./credit";
import { nextSaleNo, paymentJournal, saleAmounts, salesJournal } from "./journal";
import { rateNow } from "./fx";
import { DATA_VERSION, makeSeed } from "./seed";
import { stageOf } from "./constants";
import { SERVER } from "./mode";
import { diffData, type Op } from "./sync";

// モック段階の永続化はブラウザの localStorage。Phase 実装時は同じ関数シグネチャのまま Supabase 呼び出しに差し替える。
const KEY = "hlink-crm.v3";
const SESSION = "hlink-crm.session";
const ACTIVE = "hlink-crm.lastActive", LOGOUT = "hlink-crm.logout", SECURITY = "hlink-crm.security";

interface State { data: Data | null; meId: string | null; theme: "light" | "dark"; notice: string; ready: boolean; mustChange: boolean; syncError: string }
let state: State = { data: null, meId: null, theme: "light", notice: "", ready: !SERVER, mustChange: false, syncError: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit(); };

const read = (k: string, s: Storage | undefined) => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const write = (k: string, v: string, s: Storage | undefined) => { try { s?.setItem(k, v); } catch { /* 保存不可の環境でも画面は動かす */ } };
const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);
const ss = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function initStore() {
  if (SERVER) { void serverInit(); return; }
  if (state.data) return;
  let data: Data | null = null;
  const raw = read(KEY, ls());
  if (raw) { try { const p = JSON.parse(raw) as Data; if (p.version === DATA_VERSION) data = p; } catch { /* 破損時は初期化 */ } }
  if (!data) { data = makeSeed(); write(KEY, JSON.stringify(data), ls()); }
  const meId = read(SESSION, ss());
  const theme = (read("hlink-crm.theme", ls()) as "light" | "dark" | null) ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  set({ data, meId: meId && data.users.some((u) => u.id === meId) ? meId : null, theme });
  // 別のタブでログアウトしたら、このタブもログアウトする
  window.addEventListener("storage", (e) => {
    if (e.key === LOGOUT && e.newValue && state.meId) { try { ss()?.removeItem(SESSION); } catch { /* noop */ } let reason = "manual"; try { reason = JSON.parse(e.newValue).reason; } catch { /* noop */ } set({ meId: null, notice: reason === "idle" ? "しばらく操作がなかったため、自動でログアウトしました。" : "別の画面でログアウトしたため、ログアウトしました。" }); }
  });
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
  if (SERVER) { queue(diffData(state.data, next)); set({ data: next }); return; }
  write(KEY, JSON.stringify(next), ls());
  set({ data: next });
}

// ---- サーバー版：ログイン・共有データの同期 ----
// 画面の操作は「変更されたレコードだけ」を PUT /api/state に送る。サーバーが権限を確認して適用し、最新の全体を返す。
// 別の人の変更は、10秒ごとの確認で取り込む。
let rev = 0, pending: Op[] = [], flushing = false, timer: ReturnType<typeof setTimeout> | null = null, poller: ReturnType<typeof setInterval> | null = null, booted = false;
const jsonHeaders = { "content-type": "application/json" };
async function call(path: string, init?: RequestInit) { const r = await fetch(path, { cache: "no-store", ...init }); return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> }; }
function sessionLost(msg = "ログインの有効期限が切れました。もう一度ログインしてください。") { stopPolling(); pending = []; set({ meId: null, data: null, mustChange: false, notice: msg }); }
function stopPolling() { if (poller) clearInterval(poller); poller = null; }
function queue(ops: Op[]) { if (!ops.length) return; pending.push(...ops); if (timer) clearTimeout(timer); timer = setTimeout(() => void flush(), 300); }
async function flush() {
  if (flushing || !pending.length) return;
  flushing = true;
  const ops = pending; pending = [];
  try {
    const r = await call("/api/state", { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ ops }) });
    if (r.status === 401) return sessionLost();
    if (r.status !== 200) throw new Error(String(r.status));
    rev = r.body.rev as number;
    const denied = (r.body.denied as string[]) ?? [];
    if (!pending.length) set({ data: r.body.state as Data, syncError: "", ...(denied.length ? { notice: `権限がないため保存されなかった変更があります（${denied[0]}）。画面を最新の内容に戻しました。` } : {}) });
    else set({ syncError: "" });
  } catch { pending = [...ops, ...pending]; set({ syncError: "保存できていません。通信を確認しています…" }); setTimeout(() => void flush(), 5000); }
  finally { flushing = false; if (pending.length && !timer) timer = setTimeout(() => void flush(), 300); }
}
async function pull() {
  if (flushing || pending.length) return;
  try {
    const r = await call(`/api/state?since=${rev}`);
    if (r.status === 401) return sessionLost();
    if (r.status === 200 && r.body.state && !pending.length && !flushing) { rev = r.body.rev as number; set({ data: r.body.state as Data, syncError: "" }); }
    else if (r.status === 200) set({ syncError: "" });
  } catch { set({ syncError: "サーバーに接続できません。接続が戻ると自動で再開します。" }); }
}
async function enter(id: string, mustChange: boolean) {
  const r = await call("/api/state");
  if (r.status !== 200) return false;
  rev = r.body.rev as number;
  write(ACTIVE, String(Date.now()), ls());
  set({ data: r.body.state as Data, meId: id, mustChange, notice: "", syncError: "" });
  stopPolling(); poller = setInterval(() => void pull(), 10_000);
  return true;
}
async function serverInit() {
  if (booted) return; booted = true;
  const theme = (read("hlink-crm.theme", ls()) as "light" | "dark" | null) ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme; set({ theme });
  try {
    let me = await call("/api/auth/me");
    if (me.status !== 200) me = await call("/api/auth/access", { method: "POST", headers: jsonHeaders, body: "{}" }); // Cloudflare Access 経由なら会社アカウントで自動ログイン
    if (me.status === 200) await enter(me.body.id as string, !!me.body.mustChange);
  } catch { /* 未接続：ログイン画面を出す */ }
  set({ ready: true });
  window.addEventListener("storage", (e) => { if (e.key === LOGOUT && e.newValue && state.meId) sessionLost(JSON.parse(e.newValue).reason === "idle" ? "しばらく操作がなかったため、自動でログアウトしました。" : "別の画面でログアウトしたため、ログアウトしました。"); });
}
/** ログイン第1段階（従業員番号＋PIN） */
export const serverLogin = (id: string, pin: string) => call("/api/auth/login", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ id, pin }) });
/** ログイン第2段階（認証アプリのコード）。成功すると画面に入る */
export async function serverVerify(ticket: string, code: string) {
  const r = await call("/api/auth/verify", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ticket, code }) });
  if (r.status === 200) await enter(r.body.id as string, !!r.body.mustChange);
  return r;
}
export async function serverChangePin(current: string, next: string) {
  const r = await call("/api/auth/pin", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ current, next }) });
  if (r.status === 200) set({ mustChange: false });
  return r;
}
/** 管理者が従業員のPINを初期PINに戻す（端末の紛失・PINを忘れたとき） */
export const serverAdminReset = (id: string) => call("/api/auth/admin-reset", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ id }) });

// ---- 認証（モック。実装時は Supabase Auth）----
export const login = (userId: string) => { write(SESSION, userId, ss()); write(ACTIVE, String(Date.now()), ls()); set({ meId: userId, notice: "" }); };
/** ログアウト。理由つき（手動／無操作）。ほかのタブにも伝わる（同じブラウザで開いているすべての画面からログアウト） */
export const logout = (reason: "manual" | "idle" = "manual") => {
  if (SERVER) {
    write(LOGOUT, JSON.stringify({ at: Date.now(), reason }), ls());
    const msg = reason === "idle" ? "しばらく操作がなかったため、自動でログアウトしました。" : "ログアウトしました。";
    void flush().finally(() => fetch("/api/auth/logout", { method: "POST" }).catch(() => {})).finally(() => sessionLost(msg));
    return;
  }
  try { ss()?.removeItem(SESSION); } catch { /* noop */ }
  write(LOGOUT, JSON.stringify({ at: Date.now(), reason }), ls());
  set({ meId: null, notice: reason === "idle" ? "しばらく操作がなかったため、自動でログアウトしました。" : "ログアウトしました。" });
};
export const clearNotice = () => set({ notice: "" });
export const useNotice = () => useStore().notice;
export const touchActive = () => write(ACTIVE, String(Date.now()), ls());
export const lastActive = () => Number(read(ACTIVE, ls()) ?? 0);

// ---- セキュリティ設定（この端末のブラウザごと）----
export interface SecurityCfg { idleMinutes: number; twoFactor: boolean }
export const loadSecurity = (): SecurityCfg => { try { return { idleMinutes: 30, twoFactor: false, ...JSON.parse(read(SECURITY, ls()) ?? "{}") }; } catch { return { idleMinutes: 30, twoFactor: false }; } };
export const saveSecurity = (c: SecurityCfg) => write(SECURITY, JSON.stringify(c), ls());
/** 二段階認証（デモ）の確認コード。本番は認証アプリ（TOTP）で発行する。デモでは画面に表示して流れを確認する */
export const demoCode = (userId: string, d = new Date()) => { let h = 0; for (const c of `${userId}-${d.getFullYear()}${d.getMonth()}${d.getDate()}`) h = (h * 131 + c.charCodeAt(0)) % 1_000_000; return String(h).padStart(6, "0"); };
export const switchUser = login;
export function toggleTheme() {
  const theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  write("hlink-crm.theme", theme, ls());
  set({ theme });
}
export function resetDemo() {
  if (SERVER) return;
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


// ---- 与信審査 ----
const snap = (input: CreditInput, policy: Policy) => { const r = evaluate(input, policy); return { score: r.score, rating: r.rating, limitJPY: r.limitJPY, coveredJPY: r.coveredJPY, totalLimitJPY: r.totalLimitJPY, completeness: r.completeness, expectedLossRate: r.expectedLossRate, needsApproval: r.needsApproval }; };
/** 審査を保存（下書き）。同じ顧客の審査は1件を更新していく（履歴は監査ログに残る） */
export function saveCreditReview(orgId: string, input: CreditInput, comment: string, submit: boolean) {
  const meId = state.meId ?? "";
  commit((d) => {
    const today = new Date().toISOString().slice(0, 10);
    const ex = d.creditReviews.find((r) => r.orgId === orgId);
    const result = snap(input, d.creditPolicy);
    const next: CreditReview = { id: ex?.id ?? uid("cr"), orgId, createdAt: new Date().toISOString(), createdBy: meId, input, result, status: submit ? "submitted" : "draft", approverId: "", decidedAt: null, comment, validUntil: validUntil(today, d.creditPolicy.reviewMonths) };
    return { ...d, creditReviews: ex ? d.creditReviews.map((r) => (r.id === ex.id ? next : r)) : [next, ...d.creditReviews] };
  }, { action: submit ? "与信審査を申請" : "与信審査を保存", entity: "与信審査", label: state.data?.organizations.find((o) => o.id === orgId)?.name ?? orgId });
}
/** 承認／否認（Manager 以上）。承認すると、その格付け・限度額が有効になる */
export function decideCreditReview(id: string, approve: boolean, comment: string) {
  const meId = state.meId ?? "";
  commit((d) => ({ ...d, creditReviews: d.creditReviews.map((r) => (r.id === id ? { ...r, status: approve ? "approved" : "rejected", approverId: meId, decidedAt: new Date().toISOString(), comment: comment || r.comment } : r)) }),
    { action: approve ? "与信審査を承認" : "与信審査を否認", entity: "与信審査", label: state.data?.organizations.find((o) => o.id === state.data?.creditReviews.find((r) => r.id === id)?.orgId)?.name ?? id });
}
export const deleteCreditReview = (id: string) => commit((d) => ({ ...d, creditReviews: d.creditReviews.filter((r) => r.id !== id) }), { action: "削除", entity: "与信審査", label: id });
export const setCreditPolicy = (p: Policy) => commit((d) => ({ ...d, creditPolicy: p }), { action: "与信方針を更新", entity: "与信審査", label: "格付け・限度額・承認基準" });

// ---- 制裁照会の結果を顧客に記録 ----
export const setOrgScreening = (orgId: string, s: Omit<Screening, "at" | "by">) =>
  commit((d) => ({ ...d, organizations: d.organizations.map((o) => (o.id === orgId ? { ...o, screening: { ...s, at: new Date().toISOString(), by: state.meId ?? "" } } : o)) }), { action: "制裁リスト照会", entity: "顧客", label: `${state.data?.organizations.find((o) => o.id === orgId)?.name}：${s.result === "clear" ? "該当なし" : s.result === "hit" ? "該当の疑い（要確認）" : "類似あり（要確認）"}` });

// ---- 監査ログだけを残す（資料の追加・削除など、データ本体の外で行った操作）----
export function recordAudit(action: string, entity: string, label: string) { commit((d) => d, { action, entity, label }); }
