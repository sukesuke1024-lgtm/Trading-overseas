import crypto from "node:crypto";
import { loadDb, sessionSecret } from "./db";

export const COOKIE = "hlink_session";
export const SESSION_SEC = 60 * 60 * 12; // 12時間
export const TICKET_SEC = 60 * 5; // 二要素認証の入力猶予：5分

type Payload = { sub: string; exp: number; kind: "session" | "ticket" | "stepup"; v?: number; j?: string };

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (s: string) => crypto.createHmac("sha256", sessionSecret()).update(s).digest("base64url");

export function sign(sub: string, kind: Payload["kind"], ttlSec: number) {
  const v = kind !== "ticket" ? loadDb().users[sub]?.sv ?? 0 : undefined;
  const j = kind === "session" ? crypto.randomBytes(9).toString("base64url") : undefined; // セッションID（この端末だけのログアウトに使う）
  const body = b64(JSON.stringify({ sub, kind, v, j, exp: Math.floor(Date.now() / 1000) + ttlSec } satisfies Payload));
  return `${body}.${mac(body)}`;
}

export function verify(token: string | undefined | null, kind: Payload["kind"]): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const good = mac(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.kind !== kind || p.exp <= Date.now() / 1000) return null;
    if (kind !== "ticket" && (loadDb().users[p.sub]?.sv ?? 0) !== (p.v ?? 0)) return null; // 失効済みセッション
    if (kind === "session" && p.j && loadDb().revoked?.[p.j]) return null; // この端末でログアウト済み
    return p.sub;
  } catch { return null; }
}

/** セッションのID（j）と有効期限。この端末だけのログアウトで失効リストに載せる */
export function sessionJti(token: string | undefined | null): { j: string; exp: number } | null {
  try { const p = JSON.parse(Buffer.from((token ?? "").split(".")[0], "base64url").toString()) as Payload; return p.j ? { j: p.j, exp: p.exp } : null; } catch { return null; }
}
export const SU_COOKIE = "hlink_su", DEV_COOKIE = "hlink_dev";
export const STEPUP_SEC = 15 * 60; // PIN再入力の有効時間

export function cookieOf(req: Request, name = COOKIE) {
  const m = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
}

export function sessionUser(req: Request) {
  return verify(cookieOf(req), "session");
}

export function setCookie(req: Request, token: string, maxAge: number, name = COOKIE) {
  const secure = req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/** CSRF対策：Origin ヘッダがある場合は Host と一致することを要求 */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === req.headers.get("host"); } catch { return false; }
}

export const json = (data: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
