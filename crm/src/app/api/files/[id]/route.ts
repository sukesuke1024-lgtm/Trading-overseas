import fs from "node:fs";
import path from "node:path";
import { loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { filesDir } from "../route";

export const dynamic = "force-dynamic";
const safe = (id: string) => /^f[0-9a-f]{16}$/.test(id);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const me = sessionUser(req);
  const meta = safe(id) ? loadDb().files[id] : undefined;
  if (!me || !roleOfServer(me)) return json({ error: "unauthorized" }, 401);
  if (!meta) return json({ error: "not found" }, 404);
  const buf = fs.readFileSync(path.join(filesDir(), id));
  // PDF・画像だけをブラウザで表示する。それ以外（Office・HTML など）は、必ずダウンロードにして、ブラウザ内で実行させない
  const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/.test(meta.type);
  return new Response(buf, { headers: { "content-type": inline ? meta.type : "application/octet-stream", "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.name)}`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}

const mayEdit = (me: string, addedBy: string) => { const r = roleOfServer(me); return r === "admin" || r === "manager" || addedBy === me; };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;
  const me = sessionUser(req);
  const meta = safe(id) ? loadDb().files[id] : undefined;
  if (!me || !roleOfServer(me)) return json({ error: "unauthorized" }, 401);
  if (!meta) return json({ error: "not found" }, 404);
  if (!mayEdit(me, meta.addedBy)) return json({ error: "forbidden" }, 403);
  const p = (await req.json().catch(() => ({}))) as Partial<typeof meta>;
  if (typeof p.name === "string") meta.name = p.name.slice(0, 200);
  if (typeof p.kind === "string") meta.kind = p.kind.slice(0, 20);
  if (typeof p.productId === "string") meta.productId = p.productId.slice(0, 80);
  if (typeof p.note === "string") meta.note = p.note.slice(0, 300);
  saveDb();
  return json({ file: meta });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;
  const me = sessionUser(req);
  const db = loadDb(), meta = safe(id) ? db.files[id] : undefined;
  if (!me || !roleOfServer(me)) return json({ error: "unauthorized" }, 401);
  if (!meta) return json({ error: "not found" }, 404);
  if (!mayEdit(me, meta.addedBy)) return json({ error: "forbidden" }, 403);
  delete db.files[id]; saveDb();
  try { fs.unlinkSync(path.join(filesDir(), id)); } catch { /* 既に無い */ }
  return json({ ok: true });
}
