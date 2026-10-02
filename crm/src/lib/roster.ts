// 従業員名簿：社内ポータル（H-LINK 社内ポータル）の従業員マスタと一致させる。
// ・既定値は、ポータルのデモ名簿（portal/src/lib/data.ts の PRESIDENT と SAMPLE_EMPLOYEES）と同じ番号・氏名・部署。
// ・本番ではポータルの「従業員・権限」画面の「CRM用に書き出し」（hlink-roster.json）を、CRM の設定 → 従業員名簿 で取り込む。
// 権限の対応：ポータル 管理者→CRM Admin／役員→Manager／従業員→Sales（部署が営業部の人は営業部のお知らせを閲覧できる）
import type { Role, User } from "./types.ts";

export interface PortalEmployee { id: string; name: string; kana?: string; employment?: string; job?: string; dept?: string; role?: "admin" | "executive" | "employee"; email?: string; bossId?: string }

export const PORTAL_DEMO_ROSTER: PortalEmployee[] = [
  { id: "001", name: "長尾 晃佑", kana: "", employment: "役員", job: "代表取締役", dept: "経営", role: "admin" },
  { id: "901", name: "サンプル 役員", kana: "サンプル ヤクイン", employment: "役員", job: "取締役", dept: "経営", role: "executive", email: "901@hlink.example", bossId: "001" },
  { id: "902", name: "サンプル 従業員", kana: "サンプル ジュウギョウイン", employment: "正社員", job: "営業", dept: "営業部", role: "employee", email: "902@hlink.example", bossId: "901" },
  { id: "903", name: "サンプル 管理者", kana: "サンプル カンリシャ", employment: "正社員", job: "経理・財務", dept: "管理部", role: "admin", email: "903@hlink.example", bossId: "001" },
];

export const roleFromPortal = (r: PortalEmployee["role"]): Role => (r === "admin" ? "admin" : r === "executive" ? "manager" : "sales");
export const SALES_DEPT = "営業部";

export function toUser(e: PortalEmployee, teamId = "t1"): User {
  const n = Number(e.id.replace(/\D/g, "")) || 0;
  return { id: e.id, employeeNo: e.id, name: e.name, kana: e.kana ?? "", email: e.email || `${e.id}@hlink.example`, role: roleFromPortal(e.role), teamId, title: e.job || "", dept: e.dept || "", hue: (n * 47) % 360, fromPortal: true };
}

/** ポータルの書き出し（hlink-roster.json）または従業員配列を読み取る。形式が違えば null */
export function parseRoster(text: string): PortalEmployee[] | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return parseCsvRoster(text); }
  const arr = Array.isArray(raw) ? raw : (raw as { employees?: unknown })?.employees;
  if (!Array.isArray(arr)) return null;
  const out: PortalEmployee[] = [];
  for (const x of arr) {
    const o = x as Record<string, unknown>;
    if (!o || typeof o.id !== "string" || typeof o.name !== "string") return null;
    out.push({ id: o.id, name: o.name, kana: str(o.kana), employment: str(o.employment), job: str(o.job), dept: str(o.dept), role: (["admin", "executive", "employee"] as const).find((r) => r === o.role) ?? "employee", email: str(o.email), bossId: str(o.bossId) });
  }
  return out.length ? out : null;
}
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** ヘッダー行つき CSV（従業員番号, 氏名, 部署, 職種, 権限, メール）も受け付ける */
function parseCsvRoster(text: string): PortalEmployee[] | null {
  const rows = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  if (rows.length < 2) return null;
  const h = rows[0];
  const idx = (...names: string[]) => h.findIndex((c) => names.includes(c));
  const iId = idx("従業員番号", "id", "番号"), iName = idx("氏名", "name"), iDept = idx("部署", "dept"), iJob = idx("職種", "job"), iRole = idx("権限", "role"), iMail = idx("メール", "email");
  if (iId < 0 || iName < 0) return null;
  const ROLE: Record<string, NonNullable<PortalEmployee["role"]>> = { 管理者: "admin", 役員: "executive", 従業員: "employee", admin: "admin", executive: "executive", employee: "employee" };
  return rows.slice(1).map((r): PortalEmployee => ({ id: r[iId], name: r[iName], dept: iDept >= 0 ? r[iDept] : "", job: iJob >= 0 ? r[iJob] : "", email: iMail >= 0 ? r[iMail] : "", role: iRole >= 0 ? ROLE[r[iRole]] ?? "employee" : "employee" })).filter((e) => e.id && e.name);
}

/** 名簿の差分（追加・変更・名簿にいない＝退職扱い候補） */
export function diffRoster(current: User[], incoming: PortalEmployee[]) {
  const cur = new Map(current.map((u) => [u.id, u]));
  const inc = new Map(incoming.map((e) => [e.id, e]));
  const added = incoming.filter((e) => !cur.has(e.id));
  const changed = incoming.filter((e) => { const u = cur.get(e.id); if (!u) return false; const n = toUser(e); return u.name !== n.name || u.dept !== n.dept || u.role !== n.role || u.title !== n.title; });
  const missing = current.filter((u) => !inc.has(u.id));
  return { added, changed, missing };
}
