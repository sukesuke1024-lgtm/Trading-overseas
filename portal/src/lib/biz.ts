// 業務機能（文書管理・カレンダー・日報・KPI・リモート接続・名簿/組織図・有給）の型と純粋関数。
import type { Employee } from "./data";
import type { DayInput } from "./work";

// ---------- 文書管理（社内規程など） ----------
export const DOC_CATEGORIES = ["就業規則", "賃金規程", "服務・コンプライアンス", "情報セキュリティ", "経理・経費", "テレワーク", "安全衛生", "マニュアル", "その他"] as const;
export type Doc = { id: string; title: string; category: string; version: string; effective: string; body: string; updatedAt: string; updatedBy: string };

// ---------- 業務カレンダー（全社共通） ----------
export const EVENT_CATEGORIES = ["全社", "会議", "研修", "締め日・期日", "来客", "休業・休館", "その他"] as const;
/** start/end が無ければ終日。endDate があれば複数日 */
export type CalEvent = { id: string; title: string; date: string; endDate?: string; start?: string; end?: string; category: string; note?: string; by: string };

// ---------- 業務日報 ----------
export type Report = { date: string; done: string; plan: string; issues: string; hours?: number; status: "下書き" | "提出済"; at?: string; comment?: string; commentBy?: string };
export type Reports = Record<string, Record<string, Report>>; // 従業員番号 → 日付 → 日報

// ---------- KPI ----------
/** ownerId が空なら全社KPI。values は 月(YYYY-MM) → 実績 */
export type Kpi = { id: string; name: string; unit: string; target: number; ownerId: string; lowerIsBetter?: boolean; values: Record<string, number>; note?: string };

// ---------- リモート接続先 ----------
export const REMOTE_KINDS = ["RDP", "VNC", "SSH", "WEB"] as const;
export type RemoteKind = (typeof REMOTE_KINDS)[number];
export type Remote = { id: string; name: string; kind: RemoteKind; host: string; port?: number; ownerId: string; note?: string };

// ---------- 日付ユーティリティ（ローカル日付の ISO 文字列で扱う） ----------
const p2 = (n: number) => String(n).padStart(2, "0");
export const isoOf = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
export const dowOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }; // 0=日
export const weekStart = (iso: string) => addDays(iso, -dowOf(iso)); // 日曜始まり
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}`;
}
/** 月表示用：その月を含む週の日曜から土曜まで（5〜6週）の日付 */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`, start = weekStart(first);
  const next = addMonths(month, 1) + "-01";
  const out: string[] = [];
  for (let d = start; d < next || out.length % 7 !== 0; d = addDays(d, 1)) out.push(d);
  return out;
}
export const eventsOn = (list: CalEvent[], date: string) =>
  list.filter((e) => e.date <= date && date <= (e.endDate ?? e.date)).sort((a, b) => (a.start ?? "00:00").localeCompare(b.start ?? "00:00") || a.title.localeCompare(b.title));
export const eventTime = (e: CalEvent) => (e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "終日");

// ---------- 組織図 ----------
export type OrgNode = { emp: Employee; children: OrgNode[] };
/** bossId でたどる階層。上司が未設定・存在しない人はルート。循環は断ち切る */
export function buildOrg(list: Employee[]): OrgNode[] {
  const byId = new Map(list.map((e) => [e.id, e]));
  const kids = new Map<string, Employee[]>();
  const roots: Employee[] = [];
  for (const e of list) {
    const b = e.bossId && e.bossId !== e.id && byId.has(e.bossId) ? e.bossId : null;
    if (b) kids.set(b, [...(kids.get(b) ?? []), e]); else roots.push(e);
  }
  const seen = new Set<string>();
  const make = (e: Employee): OrgNode => {
    seen.add(e.id);
    return { emp: e, children: (kids.get(e.id) ?? []).filter((c) => !seen.has(c.id)).sort((a, b) => a.id.localeCompare(b.id)).map(make) };
  };
  const tree = roots.sort((a, b) => a.id.localeCompare(b.id)).map(make);
  // 循環で孤立した人もルートとして救済
  for (const e of list) if (!seen.has(e.id)) tree.push(make(e));
  return tree;
}
export function groupByDept(list: Employee[]): { dept: string; members: Employee[] }[] {
  const m = new Map<string, Employee[]>();
  for (const e of list) m.set(e.dept || "（部署未設定）", [...(m.get(e.dept || "（部署未設定）") ?? []), e]);
  return [...m].map(([dept, members]) => ({ dept, members: members.sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.dept.localeCompare(b.dept, "ja"));
}

// ---------- 有給（年次有給休暇） ----------
const GRANT_TABLE = [10, 11, 12, 14, 16, 18, 20]; // 勤続6か月・1年6か月・2年6か月…（週5日勤務・フルタイムの法定付与日数）
function addMonthsIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, last));
}
export type PaidLeave = {
  grantDate: string; nextGrant: string; statutory: number; carry: number; granted: number; used: number; remaining: number;
  manual: boolean; obligation: boolean; needMore: number; daysToDeadline: number;
};
const usedBetween = (att: Record<string, DayInput> | undefined, from: string, to: string) =>
  Object.values(att ?? {}).filter((d) => d.kind === "有給休暇" && d.date >= from && d.date < to).length;

/**
 * 有給の付与・消化・残。入社日から法定の付与日（6か月後、以後1年ごと）を求め、
 * 現在の付与期間の消化日数は勤怠の「有給休暇」から数える。繰越は前期の未消化分（時効2年）。
 * 従業員マスタに「付与日数」が入っていれば、それを今期の有効日数（繰越込み）として優先する。
 */
export function paidLeave(emp: Employee, attendance: Record<string, DayInput> | undefined, today: string): PaidLeave | null {
  if (!emp.joined && emp.paidGranted == null) return null;
  let grantDate = "", nextGrant = "", statutory = 0, carry = 0;
  if (emp.joined) {
    const j = emp.joined.slice(0, 10);
    let k = -1;
    while (addMonthsIso(j, 6 + 12 * (k + 1)) <= today) k++;
    if (k >= 0) {
      grantDate = addMonthsIso(j, 6 + 12 * k); nextGrant = addMonthsIso(j, 6 + 12 * (k + 1));
      statutory = GRANT_TABLE[Math.min(k, GRANT_TABLE.length - 1)];
      if (k >= 1) {
        const prevFrom = addMonthsIso(j, 6 + 12 * (k - 1));
        const prevDays = GRANT_TABLE[Math.min(k - 1, GRANT_TABLE.length - 1)];
        carry = Math.max(0, prevDays - usedBetween(attendance, prevFrom, grantDate));
      }
    }
  }
  const manual = emp.paidGranted != null;
  if (!grantDate && !manual) return null;
  if (!grantDate) { grantDate = today.slice(0, 4) + "-01-01"; nextGrant = addMonthsIso(grantDate, 12); }
  const granted = manual ? (emp.paidGranted as number) : statutory + carry;
  const used = usedBetween(attendance, grantDate, nextGrant);
  const obligation = (manual ? granted : statutory) >= 10;
  const dl = Math.round((Date.parse(nextGrant) - Date.parse(today)) / 86400000);
  return { grantDate, nextGrant, statutory, carry, granted, used, remaining: Math.max(0, granted - used), manual, obligation, needMore: obligation ? Math.max(0, 5 - used) : 0, daysToDeadline: dl };
}

// ---------- KPI ----------
export function kpiAttainment(k: Kpi, month: string): { actual: number | null; rate: number | null; ok: boolean | null } {
  const actual = k.values[month] ?? null;
  if (actual == null || !k.target) return { actual, rate: null, ok: null };
  const rate = k.lowerIsBetter ? (actual === 0 ? 1.5 : k.target / actual) : actual / k.target;
  return { actual, rate, ok: rate >= 1 };
}

// ---------- リモート接続 ----------
const safeHost = (h: string) => /^[A-Za-z0-9._:-]{1,200}$/.test(h);
/** 接続用のリンク（RDPは .rdp ファイルをダウンロード）。許可しないホスト表記は null */
export function remoteLink(r: Remote): { href: string; kind: "url" | "rdp" } | null {
  const host = r.host.trim();
  if (r.kind === "WEB") return /^https:\/\/[^\s]+$/.test(host) ? { href: host, kind: "url" } : null;
  if (!safeHost(host)) return null;
  const hp = r.port ? `${host}:${r.port}` : host;
  if (r.kind === "RDP") return { href: hp, kind: "rdp" };
  return { href: r.kind === "VNC" ? `vnc://${hp}` : `ssh://${hp}`, kind: "url" };
}
export const rdpFile = (r: Remote, user?: string) => `full address:s:${r.port ? `${r.host}:${r.port}` : r.host}\r\n${user ? `username:s:${user}\r\n` : ""}prompt for credentials:i:1\r\nscreen mode id:i:2\r\nauthentication level:i:2\r\n`;
