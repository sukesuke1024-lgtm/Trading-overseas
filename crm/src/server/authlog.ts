// 認証・権限イベントのサーバー側ログ（クライアントからは書き換えられない）。
import fs from "node:fs";
import path from "node:path";
import { DIR } from "./db.ts";

export type AuthEvent = { at: string; actor: string; event: string; ip: string; detail?: string };
export function logAuth(e: Omit<AuthEvent, "at">) {
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, "authlog.jsonl"), JSON.stringify({ ...e, at: new Date().toISOString() }) + "\n", { mode: 0o600 }); } catch { /* ログ失敗で認証は止めない */ }
}
export function readAuthLog(limit = 300): AuthEvent[] {
  try { return fs.readFileSync(path.join(DIR, "authlog.jsonl"), "utf8").split("\n").filter(Boolean).slice(-limit).reverse().map((l) => JSON.parse(l)); } catch { return []; }
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
const hits = new Map<string, number[]>();
/** 簡易レート制限（IP単位）：10分に30回まで */
export function rateLimited(ip: string, max = 30, windowMs = 10 * 60 * 1000) {
  const now = Date.now(), arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
