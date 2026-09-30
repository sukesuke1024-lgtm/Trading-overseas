// 認証・アクセス制御イベントのサーバー側ログ（ハッシュチェーン）。クライアントからは書き換えられない。
import fs from "node:fs";
import path from "node:path";
import { append, verifyChain, type Chained, type Verify } from "../lib/chain.ts";

export type AuthEvent = { at: string; actor: string; event: string; ip: string; detail?: string };
const DIR = process.env.PORTAL_DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DIR, "authlog.jsonl");
let cache: (AuthEvent & Chained)[] | null = null;

function load() {
  if (cache) return cache;
  fs.mkdirSync(DIR, { recursive: true });
  try { cache = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { cache = []; }
  return cache!;
}

export function logAuth(e: Omit<AuthEvent, "at">) {
  const list = load();
  const next = append(list, { ...e, at: new Date().toISOString() });
  cache = next;
  fs.appendFileSync(FILE, JSON.stringify(next[next.length - 1]) + "\n", { mode: 0o600 });
}

export function readAuthLog(): { entries: (AuthEvent & Chained)[]; verify: Verify } {
  const entries = load();
  return { entries, verify: verifyChain(entries) };
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

// 簡易レート制限（IP単位）：10分に30回まで
const hits = new Map<string, number[]>();
export function rateLimited(ip: string, max = 30, windowMs = 10 * 60 * 1000) {
  const now = Date.now(), arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
