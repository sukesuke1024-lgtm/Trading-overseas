// PIN再設定のワンタイムURL。トークンはハッシュだけを保存し、15分で失効・1回限り。
import crypto from "node:crypto";
import { loadDb, saveDb, type ResetTicket } from "./db";

export const RESET_TTL_MS = 15 * 60 * 1000;
const h = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function issueReset(id: string, by: ResetTicket["by"]): { token: string; exp: number } {
  const db = loadDb();
  db.resets ??= {};
  const now = Date.now();
  for (const [k, v] of Object.entries(db.resets)) if (v.exp < now || v.used || v.id === id) delete db.resets[k]; // 古い・同じ人の未使用トークンは無効化
  const token = crypto.randomBytes(24).toString("base64url");
  const exp = now + RESET_TTL_MS;
  db.resets[h(token)] = { id, exp, by };
  saveDb();
  return { token, exp };
}
export function peekReset(token: unknown): ResetTicket | null {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const t = loadDb().resets?.[h(token)];
  return t && !t.used && t.exp > Date.now() ? t : null;
}
export function consumeReset(token: string) {
  const db = loadDb(); const k = h(token);
  if (db.resets?.[k]) { delete db.resets[k]; saveDb(); }
}
export const origin = (req: Request) => {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}`;
};
