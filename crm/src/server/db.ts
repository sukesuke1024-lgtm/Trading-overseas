// サーバー運用のデータ保存（JSON ファイル）。認証情報（PINのハッシュ・認証アプリの秘密鍵）と業務データを同じ場所に持つ。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Data, Role } from "../lib/types.ts";
import { makeEmptySeed, makeSeed } from "../lib/seed.ts";

export type UserRec = {
  salt: string; hash: string;
  totpEnc?: string; // AES-256-GCM で暗号化した認証アプリの秘密鍵
  totpEnrolled: boolean;
  sv: number; // セッション世代。PIN変更・退職・管理者のリセットで加算し、既存のログインを失効させる
  lastStep: number; fails: number; lockedUntil: number; mustChange: boolean;
  retired?: boolean; // 名簿から外れた人（ログイン不可）
};
export type FileMeta = { id: string; name: string; type: string; size: number; kind: string; productId: string; note: string; addedAt: string; addedBy: string };
export type Db = { users: Record<string, UserRec>; state: Data; rev: number; files: Record<string, FileMeta>; revoked: Record<string, number> };

export const DIR = process.env.CRM_DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DIR, "db.json");
let cache: Db | null = null;

export const INITIAL_PIN = process.env.CRM_INITIAL_PIN ?? "000000"; // 初回ログイン時に必ず変更を求める

export function hashPassword(pw: string, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") }; }
export function checkPassword(pw: string, u: Pick<UserRec, "salt" | "hash">) {
  const a = Buffer.from(crypto.scryptSync(pw, u.salt, 64).toString("hex")), b = Buffer.from(u.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const newUser = (): UserRec => ({ ...hashPassword(INITIAL_PIN), totpEnrolled: false, sv: 0, lastStep: 0, fails: 0, lockedUntil: 0, mustChange: true });

export function loadDb(): Db {
  if (cache) return cache;
  fs.mkdirSync(DIR, { recursive: true });
  let db: Db | null = null;
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* 初回 */ }
  if (!db) db = { users: {}, state: process.env.CRM_SEED === "demo" ? makeSeed() : makeEmptySeed(), rev: 1, files: {}, revoked: {} };
  db.files ??= {}; db.revoked ??= {};
  cache = db;
  ensureUsers();
  saveDb();
  return db;
}

/** 名簿の全員にログインアカウントを用意し、名簿から外れた人のログインを失効させる */
export function ensureUsers() {
  const db = cache!;
  const ids = new Set(db.state.users.map((u) => u.id));
  for (const id of ids) if (!db.users[id]) db.users[id] = newUser();
  for (const [id, u] of Object.entries(db.users)) {
    if (!ids.has(id) && !u.retired) { u.retired = true; u.sv += 1; } // 退職：既存のログインを失効
    if (ids.has(id) && u.retired) { u.retired = false; u.sv += 1; u.mustChange = true; } // 復帰：再ログインとPIN変更を求める
  }
}
export function roleOfServer(id: string): Role | null { return loadDb().state.users.find((u) => u.id === id)?.role ?? null; }
export function userOfServer(id: string) { return loadDb().state.users.find((u) => u.id === id) ?? null; }

export function saveDb() {
  if (!cache) return;
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
/** テスト用：メモリ上のキャッシュを捨てる */
export function _reset() { cache = null; }

let secret: string | null = null;
export function sessionSecret() {
  if (secret) return secret;
  if (process.env.CRM_SESSION_SECRET) return (secret = process.env.CRM_SESSION_SECRET);
  const f = path.join(DIR, "secret.key");
  try { secret = fs.readFileSync(f, "utf8"); } catch { secret = crypto.randomBytes(32).toString("hex"); fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(f, secret, { mode: 0o600 }); }
  return secret;
}
const totpKey = () => crypto.scryptSync(sessionSecret(), "hlink-crm-totp-at-rest", 32);
export function encrypt(plain: string) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", totpKey(), iv); const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]); return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join("."); }
export function decrypt(s: string) { const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64url")); const d = crypto.createDecipheriv("aes-256-gcm", totpKey(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString("utf8"); }
export const getTotp = (u: UserRec) => (u.totpEnc ? decrypt(u.totpEnc) : undefined);
