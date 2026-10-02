import fs from "node:fs";
import path from "node:path";
import { DIR, roleOfServer } from "@/server/db";
import { json, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
const NAMES = ["fx", "sanctions", "feeds", "status"];

/** 公的情報の自動取り込み結果。refresh-data.mjs が CRM_DATA_DIR/public-data に書き出す（なければ、ビルドに同梱された初期データ） */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const me = sessionUser(req);
  if (!me || !roleOfServer(me)) return json({ error: "unauthorized" }, 401);
  if (!NAMES.includes(name)) return json({ error: "not found" }, 404);
  for (const f of [path.join(DIR, "public-data", `${name}.json`), path.join(process.cwd(), "public", "data", `${name}.json`)]) {
    try { return new Response(fs.readFileSync(f), { headers: { "content-type": "application/json", "cache-control": "no-store" } }); } catch { /* 次の候補へ */ }
  }
  return json({ error: "not found" }, 404);
}
