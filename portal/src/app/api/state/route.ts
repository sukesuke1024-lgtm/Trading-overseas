import { ensureUsers, loadDb, roleOfServer, saveDb } from "@/server/db";
import { blobMeta } from "@/server/files";
import { maybeArchive } from "@/server/archive";
import { raiseAlert, retireLeavers } from "@/server/security";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { notify } from "@/server/bus";
import { mergeWrite, sanitizeForRead } from "@/server/policy";

export const dynamic = "force-dynamic";
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(req: Request) {
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const role = roleOfServer(id);
  if (!role) return json({ error: "unauthorized" }, 401);
  maybeArchive(); // 保存期間を超えた履歴を1日1回CSVに書き出す
  return json({ state: sanitizeForRead(loadDb().state as never, id, role) });
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: "too large" }, 413);
  try {
    const { state } = JSON.parse(text);
    if (typeof state !== "object" || state === null || Array.isArray(state)) throw new Error();
    const role = roleOfServer(id);
    if (!role) return json({ error: "unauthorized" }, 401);
    const db = loadDb();
    const { state: merged, denied } = mergeWrite(db.state as never, state, id, role, { blob: (fid) => { const m = blobMeta(fid); return m && { owner: m.owner, name: m.name, size: m.size, mime: m.mime }; } });
    db.state = merged;
    ensureUsers(); // 管理者が従業員を追加したら、その人のログインアカウントを用意する
    retireLeavers(); // 退職日が入った人は、セッションと端末を即時に無効化
    maybeArchive();
    saveDb();
    notify(); // 他の端末へ即時通知
    if (denied.length) { logAuth({ actor: id, event: "write_denied", ip: clientIp(req), detail: denied.join(",") }); raiseAlert({ type: "権限のない書き込みの試行", level: "mid", empId: id, ip: clientIp(req), detail: `拒否した項目: ${denied.join("、")}` }); }
    return json({ ok: true, state: sanitizeForRead(merged, id, role), denied });
  } catch { return json({ error: "bad request" }, 400); }
}
