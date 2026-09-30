import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EMPLOYEES } from "@/lib/data";

export type UserRec = {
  salt: string;
  hash: string;
  totpSecret?: string;
  totpEnrolled: boolean;
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
    if (!db.users[e.id]) db.users[e.id] = { ...hashPassword(INITIAL_PASSWORD), totpEnrolled: false, lastStep: 0, fails: 0, lockedUntil: 0, mustChange: true };
  }
  cache = db;
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
