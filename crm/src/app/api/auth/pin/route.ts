import { checkPassword, hashPassword, loadDb, saveDb } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, setCookie, sessionUser, sign } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { validatePin } from "@/lib/pin";

export const dynamic = "force-dynamic";
/** PINの変更（初回ログイン後は必須）。変更すると、ほかの端末のログインはすべて失効する */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const u = loadDb().users[id];
  if (!u || typeof current !== "string" || !checkPassword(current, u)) return json({ error: "現在のPINが正しくありません。" }, 400);
  const why = validatePin(next);
  if (why) return json({ error: why }, 400);
  if (next === current) return json({ error: "現在と同じPINには変更できません。" }, 400);
  Object.assign(u, hashPassword(next as string)); u.mustChange = false; u.sv += 1; saveDb();
  logAuth({ actor: id, event: "pin_changed", ip: clientIp(req) });
  return json({ ok: true }, 200, { "set-cookie": setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC) });
}
