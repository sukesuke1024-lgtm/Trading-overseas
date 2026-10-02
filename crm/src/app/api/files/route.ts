import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DIR, loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
const MAX = 15 * 1024 * 1024;
export const filesDir = () => { const d = path.join(DIR, "files"); fs.mkdirSync(d, { recursive: true }); return d; };

/** 資料の一覧（メタ情報） */
export async function GET(req: Request) {
  const id = sessionUser(req);
  if (!id || !roleOfServer(id)) return json({ error: "unauthorized" }, 401);
  return json({ files: Object.values(loadDb().files).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) });
}

/** 資料の追加（multipart）。ファイルはサーバーのデータ領域に保存する */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const me = sessionUser(req);
  if (!me || !roleOfServer(me)) return json({ error: "unauthorized" }, 401);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return json({ error: "bad request" }, 400);
  if (file.size > MAX) return json({ error: `ファイルが大きすぎます（上限 ${MAX / 1048576}MB）` }, 413);
  const id = `f${crypto.randomBytes(8).toString("hex")}`;
  fs.writeFileSync(path.join(filesDir(), id), Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
  const s = (k: string, n: number) => String(form.get(k) ?? "").slice(0, n);
  const meta = { id, name: file.name.slice(0, 200), type: file.type || "application/octet-stream", size: file.size, kind: s("kind", 20) || "その他", productId: s("productId", 80), note: s("note", 300), addedAt: new Date().toISOString(), addedBy: me };
  loadDb().files[id] = meta; saveDb();
  return json({ file: meta });
}
