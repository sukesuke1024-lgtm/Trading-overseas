import { loadDb, roleOfServer } from "@/server/db";
import { json, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const role = roleOfServer(id);
  if (!role) return json({ error: "unauthorized" }, 401);
  return json({ id, role, mustChange: loadDb().users[id]?.mustChange ?? false });
}
