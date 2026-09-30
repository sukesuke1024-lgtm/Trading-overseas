import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EMPLOYEES } from "@/lib/data";
import { seedState } from "@/lib/seed";

export type UserRec = {
  salt: string;
  hash: string;
  totpEnc?: string; // AES-256-GCM で暗号化した TOTP 秘密鍵（iv.tag.cipher の base64url）
  totpSecret?: string; // 旧形式（平文）。読み込み時に暗号化へ移行する
  totpEnrolled: boolean;
  sv: number; // セッション世代。ログアウト・パスワード変更で加算し、既存セッションを失効させる
  lastStep: number; // 使用済みTOTPステップ（リプレイ防止）
  fails: number;
  lockedUntil: number;
  mustChange: boolean;
};
export type Db = { users: Record<string, UserRec>; state: unknown | null };

const DIR = process.env.PORTAL_DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DIR, "db.json");
let cache: Db | null = null;

export const INITIAL_PASSWORD = process.env.PORTAL_INITIAL_PASSWORD ?? "Mirai-2026!";

export function hashPassword(pw: string, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") };
}
export function checkPassword(pw: string, u: UserRec) {
  const a = Buffer.from(crypto.scryptSync(pw, u.salt, 64).toString("hex"));
  const b = Buffer.from(u.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function loadDb(): Db {
  if (cache) return cache;
  fs.mkdirSync(DIR, { recursive: true });
  let db: Db = { users: {}, state: null };
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  for (const e of EMPLOYEES) {
    if (!db.users[e.id]) db.users[e.id] = { ...hashPassword(INITIAL_PASSWORD), totpEnrolled: false, sv: 0, lastStep: 0, fails: 0, lockedUntil: 0, mustChange: true };
  }
  cache = db;
  if (!db.state) db.state = seedState(true); // 初回起動：サーバーが正の初期データを持つ（クライアントの申告に依存しない）
  for (const u of Object.values(db.users)) { // 旧データの移行
    if (u.sv === undefined) u.sv = 0;
    if (u.totpSecret) { u.totpEnc = encrypt(u.totpSecret); delete u.totpSecret; }
  }
  saveDb();
  return db;
}

export function saveDb() {
  if (!cache) return;
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

let secret: string | null = null;
export function sessionSecret() {
  if (secret) return secret;
  if (process.env.PORTAL_SESSION_SECRET) return (secret = process.env.PORTAL_SESSION_SECRET);
  const f = path.join(DIR, "secret.key");
  try { secret = fs.readFileSync(f, "utf8"); } catch {
    secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(f, secret, { mode: 0o600 });
  }
  return secret;
}

// ---- TOTP秘密鍵の保存時暗号化（鍵はセッション秘密から導出）----
const totpKey = () => crypto.scryptSync(sessionSecret(), "mirai-totp-at-rest", 32);
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", totpKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function decrypt(s: string) {
  const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", totpKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
export const getTotp = (u: UserRec) => (u.totpEnc ? decrypt(u.totpEnc) : undefined);
