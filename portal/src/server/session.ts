import crypto from "node:crypto";
import { sessionSecret } from "./db";

export const COOKIE = "mirai_session";
export const SESSION_SEC = 60 * 60 * 12; // 12時間
export const TICKET_SEC = 60 * 5; // 二要素認証の入力猶予：5分

type Payload = { sub: string; exp: number; kind: "session" | "ticket" };

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const mac = (s: string) => crypto.createHmac("sha256", sessionSecret()).update(s).digest("base64url");

export function sign(sub: string, kind: Payload["kind"], ttlSec: number) {
  const body = b64(JSON.stringify({ sub, kind, exp: Math.floor(Date.now() / 1000) + ttlSec } satisfies Payload));
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
    return p.kind === kind && p.exp > Date.now() / 1000 ? p.sub : null;
  } catch { return null; }
}

export function cookieOf(req: Request, name = COOKIE) {
  const m = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
}

export function sessionUser(req: Request) {
  return verify(cookieOf(req), "session");
}

export function setCookie(req: Request, token: string, maxAge: number) {
  const secure = req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/** CSRF対策：Origin ヘッダがある場合は Host と一致することを要求 */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === req.headers.get("host"); } catch { return false; }
}

export const json = (data: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
