import { loadDb, saveDb } from "@/server/db";
import { COOKIE, cookieOf, json, sameOrigin, sessionJti, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";

export const dynamic = "force-dynamic";
/** この端末のログインを失効させる（別の端末のログインはそのまま） */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  const t = sessionJti(cookieOf(req));
  if (t) { const db = loadDb(), now = Date.now() / 1000; for (const [k, exp] of Object.entries(db.revoked)) if (exp < now) delete db.revoked[k]; db.revoked[t.j] = t.exp; saveDb(); }
  if (id) logAuth({ actor: id, event: "logout", ip: clientIp(req) });
  return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
}
