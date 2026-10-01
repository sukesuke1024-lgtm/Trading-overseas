// 端末登録・社外IPの検知・セキュリティアラート。
//  ・ログイン成功（PIN＋認証コード）の後に、登録済みの端末（ブラウザに保存した端末トークン）かを確認する
//  ・その従業員の最初の端末は自動で登録（初回登録）。2台目以降は管理者の承認が済むまでログインできない
//  ・許可ネットワーク（社内LAN・VPNのIP範囲）を設定すると、それ以外からのログインを検知・遮断できる
//  ・USBメモリ等はブラウザからは検知できないため、固定資産台帳（USB・記憶媒体）で管理する
import crypto from "node:crypto";
import { loadDb, saveDb, employees, type Device, type SecAlert, type SecSettings } from "./db";
import { ipAllowed } from "../lib/ops.ts";
import { sendMail } from "./mail";

export const DEFAULT_SEC: SecSettings = { mode: "enforce", nets: [] };
export const secSettings = (): SecSettings => {
  const s = { ...DEFAULT_SEC, ...(loadDb().sec ?? {}) };
  const env = process.env.PORTAL_SECURITY_MODE; // 締め出されたときの復旧用（off / monitor / enforce）
  if (env === "off" || env === "monitor" || env === "enforce") s.mode = env;
  return s;
};
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function raiseAlert(a: Omit<SecAlert, "id" | "at" | "ack" | "ackBy">) {
  const db = loadDb();
  const list = (db.alerts ??= []);
  const alert: SecAlert = { ...a, id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString() };
  list.unshift(alert);
  if (list.length > 1000) list.length = 1000;
  saveDb();
  if (a.level === "high") { // 重大なものは管理者へメールでも通知（メール送信を設定している場合）
    for (const e of employees().filter((x) => x.role === "admin" && x.email && !x.left)) void sendMail(e.email!, `【H-LINK社内ポータル】セキュリティアラート：${a.type}`, `${alert.at}\n${a.detail}\n対象: ${a.empId} / IP: ${a.ip}\n\n管理者画面の「セキュリティ」で確認・対応してください。`);
  }
}

/** 同じ相手からの失敗が短時間に続いたら注意アラート（総当たりの兆候） */
const burst = new Map<string, number[]>();
export function noteFailure(key: string, empId: string, ip: string) {
  const now = Date.now(), arr = (burst.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  arr.push(now); burst.set(key, arr);
  if (arr.length === 5) raiseAlert({ type: "ログイン失敗の連続", level: "mid", empId, ip, detail: `10分以内に${arr.length}回の失敗（${key}）` });
}

const uaLabel = (ua: string) => {
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "不明";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "ブラウザ";
  return `${os}（${br}）`;
};

export type Access = { ok: true; setDevice?: string } | { ok: false; status: number; error: string; code: string; setDevice?: string };

/** ログイン時の端末・ネットワークの確認 */
export function checkAccess(uid: string, ip: string, ua: string, deviceToken: string | undefined): Access {
  const sec = secSettings();
  if (sec.mode === "off") return { ok: true };
  const enforce = sec.mode === "enforce";
  if (!ipAllowed(ip, sec.nets)) {
    raiseAlert({ type: "社外ネットワークからのログイン", level: "high", empId: uid, ip, detail: `許可されたネットワーク以外（${ip}）から認証に成功しました。${enforce ? "ログインを遮断しました。" : "（監視モード：遮断はしていません）"}` });
    if (enforce) return { ok: false, status: 403, code: "network", error: "このネットワークからはログインできません。社内ネットワークまたはVPNに接続してください。" };
  }
  const db = loadDb();
  const devices = (db.devices ??= []);
  const now = new Date().toISOString();
  const mine = devices.filter((d) => d.empId === uid);
  const known = deviceToken ? mine.find((d) => d.tokenHash === hash(deviceToken)) : undefined;
  if (known) {
    if (known.status === "approved") { known.lastSeen = now; known.lastIp = ip; saveDb(); return { ok: true }; }
    if (known.status === "revoked") {
      raiseAlert({ type: "無効化された端末からのログイン", level: "high", empId: uid, ip, detail: `${known.label} は無効化されています。` });
      if (enforce) return { ok: false, status: 403, code: "device_revoked", error: "この端末は利用できません。管理者にご連絡ください。" };
      return { ok: true };
    }
    known.lastSeen = now; known.lastIp = ip; saveDb();
    if (enforce) return { ok: false, status: 403, code: "device_pending", error: "この端末は管理者の承認待ちです。承認されるまでログインできません。" };
    return { ok: true };
  }
  // 未登録の端末
  const token = crypto.randomBytes(24).toString("base64url");
  const isFirst = mine.length === 0; // 初回登録：その人の最初の端末は自動で登録
  const dev: Device = { id: crypto.randomBytes(6).toString("hex"), empId: uid, label: uaLabel(ua), tokenHash: hash(token), status: isFirst || !enforce ? "approved" : "pending", createdAt: now, lastSeen: now, lastIp: ip, ua: ua.slice(0, 200), ...(isFirst ? { approvedBy: "初回登録" } : {}) };
  devices.push(dev); saveDb();
  if (isFirst) return { ok: true, setDevice: token };
  raiseAlert({ type: "未登録の端末からのログイン", level: "high", empId: uid, ip, detail: `${dev.label} から認証に成功しましたが、未登録の端末です。${enforce ? "管理者の承認までログインを保留しました。" : "（監視モード）"}` });
  return enforce ? { ok: false, status: 403, code: "device_pending", error: "この端末は未登録です。管理者に承認を依頼しました。承認されるまでログインできません。", setDevice: token } : { ok: true, setDevice: token };
}

/** 退職者：セッションを失効し、端末を無効化する（従業員マスタに退職日が入った時点で実行） */
export function retireLeavers() {
  const db = loadDb(), today = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const e of employees()) {
    const u = db.users[e.id];
    if (!u || u.retired || !e.left || e.left > today) continue;
    u.retired = true; u.sv += 1; changed = true;
    for (const d of db.devices ?? []) if (d.empId === e.id) d.status = "revoked";
    (db.alerts ??= []).unshift({ id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString(), type: "退職者のアクセス権を失効", level: "low", empId: e.id, ip: "-", detail: `${e.name} のセッションと登録端末を無効化しました。` });
  }
  if (changed) saveDb();
}
