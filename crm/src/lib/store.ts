"use client";
import { useSyncExternalStore } from "react";
import type { Activity, ActivityType, Contact, Data, Deal, Organization, StageId, Task, User } from "./types";
import { DATA_VERSION, makeSeed } from "./seed";
import { stageOf } from "./constants";

// モック段階の永続化はブラウザの localStorage。Phase 実装時は同じ関数シグネチャのまま Supabase 呼び出しに差し替える。
const KEY = "aitrek-crm.v1";
const SESSION = "aitrek-crm.session";

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
  const theme = (read("aitrek-crm.theme", ls()) as "light" | "dark" | null) ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
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
  write("aitrek-crm.theme", theme, ls());
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
export const addDeal = (x: Omit<Deal, "id" | "createdAt" | "stageChangedAt" | "closedAt" | "probability" | "lostReason">, nextAction?: { title: string; type: ActivityType; due: string | null }) => {
  const id = uid("d");
  const now = new Date().toISOString();
  const deal: Deal = { ...x, id, probability: stageOf(x.stage).probability, lostReason: "", createdAt: now, stageChangedAt: now, closedAt: null };
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
}

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
