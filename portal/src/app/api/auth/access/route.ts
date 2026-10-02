import { accessCfg, fetchAccessKeys, verifyAccessJwt } from "@/lib/access-jwt";
import { employees, loadDb, roleOfServer } from "@/server/db";
import { DEV_COOKIE, SESSION_SEC, cookieOf, json, sameOrigin, setCookie, sign } from "@/server/session";
import { checkAccess } from "@/server/security";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";

export const dynamic = "force-dynamic";

/** Cloudflare Access（Google / Microsoft 等の会社アカウント）で認証済みの JWT から、従業員のセッションを発行する。
 *  ACCESS_TEAM_DOMAIN と ACCESS_AUD が未設定なら無効。メールが従業員マスタの会社メールと1件だけ一致した人のみ。 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const cfg = accessCfg();
  if (!cfg) return json({ error: "sso_disabled" }, 404);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) return json({ error: "試行回数が多すぎます。" }, 429);
  const email = verifyAccessJwt(req.headers.get("cf-access-jwt-assertion"), cfg, await fetchAccessKeys(cfg));
  if (!email) { logAuth({ actor: "-", event: "sso_fail", ip, detail: "bad jwt" }); return json({ error: "会社アカウントの認証を確認できません。" }, 401); }
  loadDb();
  const hits = employees().filter((e) => e.email?.trim().toLowerCase() === email);
  const emp = hits.length === 1 ? hits[0] : undefined; // 重複・未登録は拒否（なりすまし防止）
  if (!emp || !roleOfServer(emp.id)) { logAuth({ actor: "-", event: "sso_fail", ip, detail: hits.length > 1 ? "duplicate email" : "no employee" }); return json({ error: "このアカウントは従業員として登録されていません。管理者に会社メールの登録を依頼してください。" }, 403); }
  const u = loadDb().users[emp.id];
  if (!u || u.retired) return json({ error: "このアカウントは利用できません。" }, 403);
  const access = checkAccess(emp.id, ip, req.headers.get("user-agent") ?? "", cookieOf(req, DEV_COOKIE));
  const devCookie = access.setDevice ? setCookie(req, access.setDevice, 60 * 60 * 24 * 365, DEV_COOKIE) : undefined;
  if (!access.ok) { logAuth({ actor: emp.id, event: "login_blocked_device", ip, detail: access.code }); return new Response(JSON.stringify({ error: access.error, code: access.code }), { status: access.status, headers: { "content-type": "application/json", "cache-control": "no-store", ...(devCookie ? { "set-cookie": devCookie } : {}) } }); }
  logAuth({ actor: emp.id, event: "sso_ok", ip, detail: email });
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", setCookie(req, sign(emp.id, "session", SESSION_SEC), SESSION_SEC));
  if (devCookie) headers.append("set-cookie", devCookie);
  return new Response(JSON.stringify({ id: emp.id, role: roleOfServer(emp.id) ?? "employee", mustChange: u.mustChange }), { status: 200, headers });
}
