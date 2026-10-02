import { INITIAL_PIN, checkPassword, encrypt, loadDb, roleOfServer, saveDb, userOfServer } from "@/server/db";
import { TICKET_SEC, json, sameOrigin, sign } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { newSecret, otpauthUri } from "@/lib/totp";
import { isPinShape } from "@/lib/pin";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

/** 第1段階：従業員番号 + PIN。通れば、認証アプリのコード入力（または初回の登録）へ進む */
export async function POST(req: Request) {
  if (process.env.ACCESS_ONLY === "1") return json({ error: "会社アカウント（Google / Microsoft）でのログインのみ有効です。" }, 403);
  const ip = clientIp(req);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) { logAuth({ actor: "-", event: "rate_limited", ip }); return json({ error: "試行回数が多すぎます。しばらくしてから再試行してください。" }, 429); }
  const { id, pin } = (await req.json().catch(() => ({}))) as { id?: string; pin?: string };
  const db = loadDb();
  const uid = typeof id === "string" ? id.trim() : "";
  const u = uid ? db.users[uid] : undefined;
  const bad = () => json({ error: "従業員番号またはPINが正しくありません。" }, 401);
  if (!u || u.retired || !isPinShape(pin) || !roleOfServer(uid)) { checkPassword("000000", { salt: "00", hash: "00" }); logAuth({ actor: uid || "-", event: "login_fail", ip, detail: "unknown or inactive" }); return bad(); }
  if (u.lockedUntil > Date.now()) { logAuth({ actor: uid, event: "login_blocked_locked", ip }); return json({ error: `アカウントがロックされています。${Math.ceil((u.lockedUntil - Date.now()) / 60000)}分後に再試行してください。` }, 423); }
  if (!checkPassword(pin, u)) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; logAuth({ actor: uid, event: "account_locked", ip }); }
    saveDb(); logAuth({ actor: uid, event: "login_fail", ip, detail: "bad pin" });
    return bad();
  }
  u.fails = 0;
  let enroll: { secret: string; otpauth: string } | undefined;
  if (!u.totpEnrolled) { const secret = newSecret(); u.totpEnc = encrypt(secret); u.lastStep = 0; enroll = { secret, otpauth: otpauthUri(userOfServer(uid)?.name ?? uid, secret) }; }
  saveDb();
  logAuth({ actor: uid, event: "password_ok", ip, detail: enroll ? "mfa_enroll" : "mfa_verify" });
  return json({ ticket: sign(uid, "ticket", TICKET_SEC), mfa: enroll ? "enroll" : "verify", mustChange: u.mustChange, defaultPin: pin === INITIAL_PIN, ...enroll });
}
