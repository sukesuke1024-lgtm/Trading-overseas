import { loadDb, roleOfServer } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { saveBlob } from "@/server/files";
import { MAX_FILE_BYTES, checkUpload } from "@/lib/ops";

export const dynamic = "force-dynamic";

/** ファイルのアップロード（本体の保管）。台帳への登録（誰が・どの事業部か）は、続けて共有Stateに書き込む */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const uid = sessionUser(req);
  if (!uid || !roleOfServer(uid)) return json({ error: "unauthorized" }, 401);
  if (rateLimited(`upload:${uid}`, 60)) return json({ error: "アップロードが多すぎます。" }, 429);
  let name = "";
  try { name = decodeURIComponent(req.headers.get("x-file-name") ?? ""); } catch {}
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 1024) return json({ error: "ファイルが大きすぎます。" }, 413);
  const buf = Buffer.from(await req.arrayBuffer());
  const bad = checkUpload(name, buf.length);
  if (bad) return json({ error: bad }, 400);
  const mime = (req.headers.get("content-type") ?? "application/octet-stream").slice(0, 100);
  const id = saveBlob(uid, name, mime, buf);
  logAuth({ actor: uid, event: "file_upload", ip: clientIp(req), detail: `${name} (${buf.length}B)` });
  void loadDb();
  return json({ id, size: buf.length, mime, name });
}
