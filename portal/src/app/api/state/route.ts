import { loadDb, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(req: Request) {
  if (!sessionUser(req)) return json({ error: "unauthorized" }, 401);
  return json({ state: loadDb().state });
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!sessionUser(req)) return json({ error: "unauthorized" }, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: "too large" }, 413);
  try {
    const { state } = JSON.parse(text);
    if (typeof state !== "object" || state === null) throw new Error();
    loadDb().state = state;
    saveDb();
    return json({ ok: true });
  } catch { return json({ error: "bad request" }, 400); }
}
