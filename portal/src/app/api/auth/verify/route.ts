import { loadDb, saveDb } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, setCookie, sign, verify } from "@/server/session";
import { verifyTotp } from "@/lib/totp";
import { roleOf } from "@/lib/data";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const { ticket, code } = (await req.json().catch(() => ({}))) as { ticket?: string; code?: string };
  const id = verify(ticket, "ticket");
  if (!id) return json({ error: "有効期限が切れました。最初からやり直してください。" }, 401);
  const u = loadDb().users[id];
  if (!u?.totpSecret) return json({ error: "認証情報がありません。" }, 401);
  if (u.lockedUntil > Date.now()) return json({ error: "アカウントがロックされています。" }, 423);
  const step = Math.floor(Date.now() / 30000);
  const ok = await verifyTotp(u.totpSecret, String(code ?? ""));
  if (!ok || step <= u.lastStep) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; }
    saveDb();
    return json({ error: "セキュリティコードが正しくありません。" }, 401);
  }
  u.lastStep = step; u.totpEnrolled = true; u.fails = 0;
  saveDb();
  return json({ id, role: roleOf(id), mustChange: u.mustChange }, 200, { "set-cookie": setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC) });
}
