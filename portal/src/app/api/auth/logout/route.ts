import { loadDb, saveDb } from "@/server/db";
import { COOKIE, SU_COOKIE, cookieOf, json, sameOrigin, sessionJti, sessionUser, setCookie } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";

export const dynamic = "force-dynamic";

/** ログアウト。all=true なら全ての端末のセッションを失効、そうでなければこの端末のセッションだけを失効 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const { all } = (await req.json().catch(() => ({}))) as { all?: boolean };
  const id = sessionUser(req);
  if (id) {
    const db = loadDb();
    if (all) db.users[id].sv += 1;
    else { const j = sessionJti(cookieOf(req)); if (j) { const r = (db.revoked ??= {}); r[j.j] = j.exp; for (const [k, e] of Object.entries(r)) if (e * 1000 < Date.now()) delete r[k]; } }
    saveDb();
    logAuth({ actor: id, event: all ? "logout_all" : "logout", ip: clientIp(req) });
  }
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", setCookie(req, "", 0, COOKIE));
  headers.append("set-cookie", setCookie(req, "", 0, SU_COOKIE));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
