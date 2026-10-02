import { getTotp, loadDb, roleOfServer, saveDb } from "@/server/db";
import { DEV_COOKIE, SESSION_SEC, cookieOf, json, sameOrigin, setCookie, sign, verify } from "@/server/session";
import { checkAccess, noteFailure } from "@/server/security";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  if (process.env.ACCESS_ONLY === "1") return json({ error: "会社アカウント（Google / Microsoft）でのログインのみ有効です。" }, 403);
  const ip = clientIp(req);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) return json({ error: "試行回数が多すぎます。" }, 429);
  const { ticket, code } = (await req.json().catch(() => ({}))) as { ticket?: string; code?: string };
  const id = verify(ticket, "ticket");
  if (!id) return json({ error: "有効期限が切れました。最初からやり直してください。" }, 401);
  const u = loadDb().users[id];
  const secret = u ? getTotp(u) : undefined;
  if (!u || !secret) return json({ error: "認証情報がありません。" }, 401);
  if (u.lockedUntil > Date.now()) return json({ error: "アカウントがロックされています。" }, 423);
  const step = Math.floor(Date.now() / 30000);
  const ok = await verifyTotp(secret, String(code ?? ""));
  if (!ok || step <= u.lastStep) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; logAuth({ actor: id, event: "account_locked", ip, detail: "mfa" }); }
    saveDb();
    logAuth({ actor: id, event: "mfa_fail", ip });
    noteFailure(`mfa:${id}`, id, ip);
    return json({ error: "セキュリティコードが正しくありません。" }, 401);
  }
  u.lastStep = step; u.totpEnrolled = true; u.fails = 0;
  saveDb();
  if (!roleOfServer(id)) { logAuth({ actor: id, event: "login_blocked_inactive", ip }); return json({ error: "このアカウントは利用できません。" }, 403); }
  // 登録済みの端末・許可ネットワークかを確認（未登録の端末はアラート検知）
  const access = checkAccess(id, ip, req.headers.get("user-agent") ?? "", cookieOf(req, DEV_COOKIE));
  const devCookie = access.setDevice ? setCookie(req, access.setDevice, 60 * 60 * 24 * 365, DEV_COOKIE) : undefined;
  if (!access.ok) { logAuth({ actor: id, event: "login_blocked_device", ip, detail: access.code }); return new Response(JSON.stringify({ error: access.error, code: access.code }), { status: access.status, headers: { "content-type": "application/json", "cache-control": "no-store", ...(devCookie ? { "set-cookie": devCookie } : {}) } }); }
  logAuth({ actor: id, event: "login_ok", ip });
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC));
  if (devCookie) headers.append("set-cookie", devCookie);
  return new Response(JSON.stringify({ id, role: roleOfServer(id) ?? "employee", mustChange: u.mustChange }), { status: 200, headers });
}
