import type { Activity, Contact, Data, Deal, Organization, Task, User } from "./types";
import { isOpen, toJPY } from "./constants";
import { daysBetween, diffFromToday, endOfWeek, startOfWeek, todayStr } from "./dates";

export const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

/** 案件の Next Action ＝ その案件で未完了の Next Action（期限の早い順の先頭） */
export const nextActionOf = (d: Data, dealId: string): Task | undefined =>
  d.tasks.filter((t) => t.dealId === dealId && t.isNextAction && t.status === "open").sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];

export const openDeals = (d: Data) => d.deals.filter((x) => isOpen(x.stage));
export const dealJPY = (x: Deal) => toJPY(x.amount, x.currency);
export const weighted = (x: Deal) => dealJPY(x) * (x.probability / 100);

/** 最終接触（顧客に紐づく最新の活動日） */
export const lastContactOf = (d: Data, orgId: string): string | null =>
  d.activities.filter((a) => a.orgId === orgId).map((a) => a.at).sort().pop() ?? null;
/** 次回予定（顧客に紐づく未完了 Task の最も早い期限） */
export const nextScheduledOf = (d: Data, orgId: string): Task | undefined =>
  d.tasks.filter((t) => t.orgId === orgId && t.status === "open" && t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];

export type FollowReason = "no-next" | "overdue" | "stale";
/** 要フォロー判定：Next Action 未設定／期限超過／最終接触から14日以上 */
export function followReasons(d: Data, deal: Deal): FollowReason[] {
  if (!isOpen(deal.stage)) return [];
  const r: FollowReason[] = [];
  const na = nextActionOf(d, deal.id);
  if (!na) r.push("no-next");
  else if (na.dueDate && diffFromToday(na.dueDate) < 0) r.push("overdue");
  const last = d.activities.filter((a) => a.dealId === deal.id).map((a) => a.at).sort().pop();
  if (!last || -diffFromToday(last.slice(0, 10)) >= 14) r.push("stale");
  return r;
}
export const FOLLOW_LABEL: Record<FollowReason, string> = { "no-next": "Next Action 未設定", overdue: "Next Action 期限超過", stale: "14日以上接触なし" };

export function dashboardStats(d: Data, scopeUserId: string | null) {
  const mine = <T extends { ownerId?: string; assigneeId?: string }>(x: T) => !scopeUserId || (x.ownerId ?? x.assigneeId) === scopeUserId;
  const t = todayStr(), ws = startOfWeek(), we = endOfWeek();
  const tasks = d.tasks.filter((k) => k.status === "open" && mine(k));
  const deals = openDeals(d).filter(mine);
  return {
    today: tasks.filter((k) => k.dueDate === t),
    overdue: tasks.filter((k) => k.dueDate && k.dueDate < t),
    meetings: tasks.filter((k) => (k.type === "visit" || k.type === "online") && k.dueDate && k.dueDate >= ws && k.dueDate <= we),
    follow: deals.map((x) => ({ deal: x, reasons: followReasons(d, x) })).filter((x) => x.reasons.length),
    deals,
    total: deals.reduce((s, x) => s + dealJPY(x), 0),
    weighted: deals.reduce((s, x) => s + weighted(x), 0),
  };
}

export type OrgRow = { org: Organization; open: Deal[]; openJPY: number; wonJPY: number; last: string | null; next?: Task };
export const orgRows = (d: Data): OrgRow[] => d.organizations.map((org) => {
  const ds = d.deals.filter((x) => x.orgId === org.id);
  const open = ds.filter((x) => isOpen(x.stage));
  return { org, open, openJPY: open.reduce((s, x) => s + dealJPY(x), 0), wonJPY: ds.filter((x) => x.stage === "won").reduce((s, x) => s + dealJPY(x), 0), last: lastContactOf(d, org.id), next: nextScheduledOf(d, org.id) };
});

export const daysSince = (iso: string | null) => (iso ? -daysBetween(todayStr(), iso.slice(0, 10)) : null);

export type Perm = { isAdmin: boolean; isManager: boolean; canEdit: (ownerId: string | null | undefined) => boolean; canDelete: boolean };
/** 権限（仕様書 §8 RBAC）。Sales は自分が担当するものだけ編集可。削除は Manager 以上。 */
export const permsFor = (me: User | null): Perm => ({
  isAdmin: me?.role === "admin",
  isManager: me?.role === "admin" || me?.role === "manager",
  canEdit: (ownerId) => !!me && (me.role !== "sales" || !ownerId || ownerId === me.id),
  canDelete: me?.role === "admin" || me?.role === "manager",
});

export type { Activity, Contact };


// ---- 与信 ----
import { usage } from "./credit";
import type { CreditReview } from "./types";
/** 顧客の現在有効な与信審査（承認済みで、期限内） */
export const activeReview = (d: Data, orgId: string): CreditReview | undefined => {
  const today = new Date().toISOString().slice(0, 10);
  return d.creditReviews.find((r) => r.orgId === orgId && r.status === "approved" && r.validUntil >= today);
};
export const reviewOf = (d: Data, orgId: string): CreditReview | undefined => d.creditReviews.find((r) => r.orgId === orgId);
/** 顧客のエクスポージャー：未入金の売掛金（確定）と、進行中案件の見込み（確度ステージが提案以降のものを、確度で加重） */
export function exposureOf(d: Data, orgId: string) {
  const ar = d.sales.filter((s) => s.orgId === orgId && s.status !== "入金済").reduce((a, s) => a + s.amountJPY, 0);
  const pipe = d.deals.filter((x) => x.orgId === orgId && isOpen(x.stage) && x.probability >= 50).reduce((a, x) => a + weighted(x), 0);
  return { arJPY: ar, pipelineJPY: Math.round(pipe) };
}
export function creditUsage(d: Data, orgId: string) {
  const r = activeReview(d, orgId);
  return { review: r, usage: usage(r?.result.totalLimitJPY ?? 0, exposureOf(d, orgId)) };
}
