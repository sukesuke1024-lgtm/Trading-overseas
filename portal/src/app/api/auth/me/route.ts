import { loadDb } from "@/server/db";
import { json, sessionUser } from "@/server/session";
import { roleOf } from "@/lib/data";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  return json({ id, role: roleOf(id), mustChange: loadDb().users[id]?.mustChange ?? false });
}
