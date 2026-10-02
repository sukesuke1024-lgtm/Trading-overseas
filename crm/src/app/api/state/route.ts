import { ensureUsers, loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { applyOps, sanitizeForRead } from "@/server/ops";
import type { Op } from "@/lib/sync";

export const dynamic = "force-dynamic";
const MAX_BYTES = 8 * 1024 * 1024;

/** 共有データの取得。since が現在の版と同じなら本文は返さない（変更の確認用） */
export async function GET(req: Request) {
  const id = sessionUser(req);
  const role = id ? roleOfServer(id) : null;
  if (!id || !role) return json({ error: "unauthorized" }, 401);
  const db = loadDb();
  const since = Number(new URL(req.url).searchParams.get("since"));
  if (since === db.rev) return json({ rev: db.rev, unchanged: true });
  return json({ rev: db.rev, state: sanitizeForRead(db.state, role) });
}

/** 変更の適用。本文は変更されたレコードだけ（Op の配列）。権限のない変更はサーバーが拒否する */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  const role = id ? roleOfServer(id) : null;
  if (!id || !role) return json({ error: "unauthorized" }, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: "too large" }, 413);
  try {
    const { ops } = JSON.parse(text) as { ops: Op[] };
    if (!Array.isArray(ops) || ops.length > 200) throw new Error();
    const db = loadDb();
    const { data, denied } = applyOps(db.state, ops, { id, role });
    if (data !== db.state && JSON.stringify(data) !== JSON.stringify(db.state)) { db.state = data; db.rev += 1; ensureUsers(); saveDb(); }
    if (denied.length) logAuth({ actor: id, event: "write_denied", ip: clientIp(req), detail: denied.slice(0, 5).join(" / ") });
    return json({ ok: true, rev: db.rev, state: sanitizeForRead(db.state, roleOfServer(id) ?? role), denied });
  } catch { return json({ error: "bad request" }, 400); }
}
