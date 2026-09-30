import { checkPassword, hashPassword, loadDb, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id) return json({ error: "unauthorized" }, 401);
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const u = loadDb().users[id];
  if (!u || typeof current !== "string" || !checkPassword(current, u)) return json({ error: "現在のパスワードが正しくありません。" }, 400);
  if (typeof next !== "string" || next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return json({ error: "新しいパスワードは10文字以上で、英字と数字を含めてください。" }, 400);
  if (next === current) return json({ error: "現在と異なるパスワードにしてください。" }, 400);
  Object.assign(u, hashPassword(next), { mustChange: false });
  saveDb();
  return json({ ok: true });
}
