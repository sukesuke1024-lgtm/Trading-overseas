import { loadDb, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser, setCookie } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (id) { loadDb().users[id].sv += 1; saveDb(); logAuth({ actor: id, event: "logout", ip: clientIp(req) }); } // 全端末のセッションを失効
  return json({ ok: true }, 200, { "set-cookie": setCookie(req, "", 0) });
}
