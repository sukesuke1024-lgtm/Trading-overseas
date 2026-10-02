import { getTotp, loadDb, roleOfServer, saveDb } from "@/server/db";
import { SESSION_SEC, json, sameOrigin, setCookie, sign, verify } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

/** 第2段階：認証アプリの6桁コード。通ればログイン完了（12時間のセッション） */
export async function POST(req: Request) {
  if (process.env.ACCESS_ONLY === "1") return json({ error: "会社アカウント（Google / Microsoft）でのログインのみ有効です。" }, 403);
  const ip = clientIp(req);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) return json({ error: "試行回数が多すぎます。" }, 429);
  const { ticket, code } = (await req.json().catch(() => ({}))) as { ticket?: string; code?: string };
  const id = verify(ticket, "ticket");
  if (!id) return json({ error: "有効期限が切れました。最初からやり直してください。" }, 401);
  const u = loadDb().users[id];
  const secret = u ? getTotp(u) : undefined;
  if (!u || !secret || u.retired) return json({ error: "認証情報がありません。" }, 401);
  if (u.lockedUntil > Date.now()) return json({ error: "アカウントがロックされています。" }, 423);
  const step = Math.floor(Date.now() / 30000);
  const ok = await verifyTotp(secret, String(code ?? ""));
  if (!ok || step <= u.lastStep) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; logAuth({ actor: id, event: "account_locked", ip, detail: "mfa" }); }
    saveDb(); logAuth({ actor: id, event: "mfa_fail", ip });
    return json({ error: "確認コードが正しくありません。" }, 401);
  }
  u.lastStep = step; u.totpEnrolled = true; u.fails = 0; saveDb();
  const role = roleOfServer(id);
  if (!role) return json({ error: "このアカウントは利用できません。" }, 403);
  logAuth({ actor: id, event: "login_ok", ip });
  return json({ id, role, mustChange: u.mustChange }, 200, { "set-cookie": setCookie(req, sign(id, "session", SESSION_SEC), SESSION_SEC) });
}
