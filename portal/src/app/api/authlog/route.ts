import { readAuthLog, clientIp, logAuth } from "@/server/authlog";
import { json, sessionUser } from "@/server/session";
import { can } from "@/lib/perm";
import { roleOf } from "@/lib/data";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  if (!can.audit(roleOf(id))) { logAuth({ actor: id, event: "access_denied", ip: clientIp(req), detail: "authlog" }); return json({ error: "forbidden" }, 403); }
  return json(readAuthLog());
}
