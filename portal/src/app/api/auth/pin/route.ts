import { checkPassword, hashPassword, loadDb, saveDb } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, sessionUser, setCookie, sign } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { isPinShape, validatePin } from "@/lib/pin";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

/** PINの変更（ログイン中）。現在のPINの確認が必要 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  if (rateLimited(clientIp(req))) return json({ error: "試行回数が多すぎます。" }, 429);
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const u = loadDb().users[id];
  if (!u || !isPinShape(current) || !checkPassword(current, u)) {
    if (u) { u.fails += 1; if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; } saveDb(); }
    logAuth({ actor: id, event: "pin_change_fail", ip: clientIp(req) });
    return json({ error: "現在のPINが正しくありません。" }, 400);
  }
  const bad = validatePin(next);
  if (bad) return json({ error: bad }, 400);
  if (next === current) return json({ error: "現在と異なるPINにしてください。" }, 400);
  u.fails = 0;
  Object.assign(u, hashPassword(next as string), { mustChange: false });
  u.sv += 1; // 他の端末のセッションを失効
  saveDb();
  logAuth({ actor: id, event: "pin_changed", ip: clientIp(req) });
  return json({ ok: true }, 200, { "set-cookie": setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC) });
}
