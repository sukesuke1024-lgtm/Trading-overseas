import { hashPassword, loadDb, saveDb } from "@/server/db";
import { json, sameOrigin } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { consumeReset, peekReset } from "@/server/reset";
import { validatePin } from "@/lib/pin";

export const dynamic = "force-dynamic";

/** ワンタイムURLのトークンで新しいPINを設定する。二要素認証（認証アプリ）はそのまま必要 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = clientIp(req);
  if (rateLimited("confirm:" + ip, 15)) return json({ error: "試行回数が多すぎます。" }, 429);
  const { token, pin } = (await req.json().catch(() => ({}))) as { token?: string; pin?: string };
  const t = peekReset(token);
  if (!t) return json({ error: "このリンクは無効か、有効期限が切れています。もう一度再設定をお申し込みください。" }, 400);
  const bad = validatePin(pin);
  if (bad) return json({ error: bad }, 400);
  const u = loadDb().users[t.id];
  if (!u) return json({ error: "このリンクは無効です。" }, 400);
  Object.assign(u, hashPassword(pin as string), { mustChange: false, fails: 0, lockedUntil: 0 });
  u.sv += 1; // 既存のセッションを全て失効
  consumeReset(token as string);
  saveDb();
  logAuth({ actor: t.id, event: "pin_reset_done", ip, detail: t.by });
  return json({ ok: true });
}
