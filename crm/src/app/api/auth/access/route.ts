import { accessCfg, fetchAccessKeys, verifyAccessJwt } from "@/lib/access-jwt";
import { loadDb, roleOfServer } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, setCookie, sign } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";

export const dynamic = "force-dynamic";

/** Cloudflare Access（Google / Microsoft 等の会社アカウント）で認証済みの JWT から、CRM のセッションを発行する。
 *  ACCESS_TEAM_DOMAIN と ACCESS_AUD が未設定なら無効。メールが名簿の会社メールと1件だけ一致した人のみ。 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const cfg = accessCfg();
  if (!cfg) return json({ error: "sso_disabled" }, 404);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) return json({ error: "試行回数が多すぎます。" }, 429);
  const email = verifyAccessJwt(req.headers.get("cf-access-jwt-assertion"), cfg, await fetchAccessKeys(cfg));
  if (!email) { logAuth({ actor: "-", event: "sso_fail", ip, detail: "bad jwt" }); return json({ error: "会社アカウントの認証を確認できません。" }, 401); }
  const db = loadDb();
  const hits = db.state.users.filter((x) => x.email?.trim().toLowerCase() === email);
  const emp = hits.length === 1 ? hits[0] : undefined; // 重複・未登録は拒否
  const u = emp ? db.users[emp.id] : undefined;
  if (!emp || !u || u.retired || !roleOfServer(emp.id)) { logAuth({ actor: "-", event: "sso_fail", ip, detail: hits.length > 1 ? "duplicate email" : "no employee" }); return json({ error: "このアカウントは名簿に登録されていません。Admin に会社メールの登録を依頼してください。" }, 403); }
  logAuth({ actor: emp.id, event: "sso_ok", ip, detail: email });
  return json({ id: emp.id, role: roleOfServer(emp.id), mustChange: u.mustChange }, 200, { "set-cookie": setCookie(req, sign(emp.id, "session", SESSION_SEC), SESSION_SEC) });
}
