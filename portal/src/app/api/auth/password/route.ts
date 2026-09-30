import { checkPassword, hashPassword, loadDb, saveDb } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, sessionUser, setCookie, sign } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const u = loadDb().users[id];
  if (!u || typeof current !== "string" || !checkPassword(current, u)) { logAuth({ actor: id, event: "password_change_fail", ip: clientIp(req) }); return json({ error: "現在のパスワードが正しくありません。" }, 400); }
  if (typeof next !== "string" || next.length < 12 || !/[A-Za-z]/.test(next) || !/\d/.test(next) || !/[^A-Za-z0-9]/.test(next)) return json({ error: "新しいパスワードは12文字以上で、英字・数字・記号を含めてください。" }, 400);
  if (next === current) return json({ error: "現在と異なるパスワードにしてください。" }, 400);
  Object.assign(u, hashPassword(next), { mustChange: false });
  u.sv += 1; // 他の端末のセッションを失効
  saveDb();
  logAuth({ actor: id, event: "password_changed", ip: clientIp(req) });
  return json({ ok: true }, 200, { "set-cookie": setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC) });
}
