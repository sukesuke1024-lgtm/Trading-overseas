import { checkPassword, loadDb, roleOfServer, saveDb } from "@/server/db";
import { SU_COOKIE, STEPUP_SEC, cookieOf, json, sameOrigin, sessionUser, setCookie, sign, verify } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { noteFailure, raiseAlert } from "@/server/security";
import { isPinShape } from "@/lib/pin";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

/** ステップアップ認証：役員・部長限定のページや給与明細などを開くとき、PINを再入力して15分間だけ有効にする */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const id = sessionUser(req);
  if (!id || !roleOfServer(id)) return json({ error: "unauthorized" }, 401);
  const ip = clientIp(req);
  if (rateLimited("stepup:" + ip, 20)) return json({ error: "試行回数が多すぎます。" }, 429);
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  const u = loadDb().users[id];
  if (u.lockedUntil > Date.now()) return json({ error: "アカウントがロックされています。しばらくしてから再試行してください。" }, 423);
  if (!isPinShape(pin) || !checkPassword(pin, u)) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; raiseAlert({ type: "PIN再入力の失敗（ロック）", level: "mid", empId: id, ip, detail: "役員・部長限定ページのPIN再入力に5回失敗しました。" }); }
    saveDb(); logAuth({ actor: id, event: "stepup_fail", ip }); noteFailure(`stepup:${id}`, id, ip);
    return json({ error: "PINが正しくありません。" }, 401);
  }
  u.fails = 0; saveDb();
  logAuth({ actor: id, event: "stepup_ok", ip });
  return json({ ok: true, seconds: STEPUP_SEC }, 200, { "set-cookie": setCookie(req, sign(id, "stepup", STEPUP_SEC), STEPUP_SEC, SU_COOKIE) });
}

export async function GET(req: Request) {
  const id = sessionUser(req);
  return json({ valid: !!id && verify(cookieOf(req, SU_COOKIE), "stepup") === id });
}
