import { INITIAL_PIN, hashPassword, loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";

export const dynamic = "force-dynamic";
/** 管理者が、本人確認のうえ、従業員のPINを初期PINに戻し、認証アプリの登録もやり直させる（端末の紛失・PINを忘れたとき） */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const me = sessionUser(req);
  if (!me || roleOfServer(me) !== "admin") return json({ error: "管理者のみ実行できます。" }, 403);
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const u = id ? loadDb().users[id] : undefined;
  if (!id || !u) return json({ error: "対象が見つかりません。" }, 404);
  Object.assign(u, hashPassword(INITIAL_PIN)); u.mustChange = true; u.totpEnrolled = false; u.totpEnc = undefined; u.lastStep = 0; u.fails = 0; u.lockedUntil = 0; u.sv += 1; saveDb();
  logAuth({ actor: me, event: "admin_reset", ip: clientIp(req), detail: id });
  return json({ ok: true });
}
