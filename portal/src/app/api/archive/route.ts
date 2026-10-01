import { loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { maybeArchive } from "@/server/archive";
import { notify } from "@/server/bus";
import { logAuth, clientIp } from "@/server/authlog";

export const dynamic = "force-dynamic";

/** 管理者：履歴のアーカイブを今すぐ実行する（通常は1日1回、自動で実行される） */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const uid = sessionUser(req);
  if (!uid || roleOfServer(uid) !== "admin") return json({ error: "forbidden" }, 403);
  const db = loadDb();
  const st = db.state as { archiveMeta?: { at: string; auditUpTo: string } } | null;
  if (st) st.archiveMeta = { at: "", auditUpTo: st.archiveMeta?.auditUpTo ?? "" };
  const ran = maybeArchive();
  saveDb(); notify();
  logAuth({ actor: uid, event: "archive_run", ip: clientIp(req) });
  return json({ ok: true, ran });
}
