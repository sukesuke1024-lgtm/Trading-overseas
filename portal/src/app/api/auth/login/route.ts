import { INITIAL_PASSWORD, checkPassword, encrypt, loadDb, saveDb } from "@/server/db";
import { TICKET_SEC, json, sameOrigin, sign } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { newSecret, otpauthUri } from "@/lib/totp";
import { EMPLOYEES } from "@/lib/data";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(ip)) { logAuth({ actor: "-", event: "rate_limited", ip }); return json({ error: "試行回数が多すぎます。しばらくしてから再試行してください。" }, 429); }
  const { id, password } = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  const db = loadDb();
  const uid = typeof id === "string" ? id.trim().toUpperCase() : "";
  const u = uid ? db.users[uid] : undefined;
  const bad = () => json({ error: "社員番号またはパスワードが正しくありません。" }, 401);
  if (!u || typeof password !== "string") { checkPassword(password ?? "", { salt: "00", hash: "00" } as never); logAuth({ actor: uid || "-", event: "login_fail", ip, detail: "unknown user or bad input" }); return bad(); }
  if (u.lockedUntil > Date.now()) { logAuth({ actor: uid, event: "login_blocked_locked", ip }); return json({ error: `アカウントがロックされています。${Math.ceil((u.lockedUntil - Date.now()) / 60000)}分後に再試行してください。` }, 423); }
  if (!checkPassword(password, u)) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; logAuth({ actor: uid, event: "account_locked", ip }); }
    saveDb();
    logAuth({ actor: uid, event: "login_fail", ip, detail: "bad password" });
    return bad();
  }
  u.fails = 0;
  const emp = EMPLOYEES.find((e) => e.id === uid);
  let enroll: { secret: string; otpauth: string } | undefined;
  if (!u.totpEnrolled) {
    const secret = newSecret(); // 未登録の間は毎回再発行（登録完了前の秘密は使い回さない）
    u.totpEnc = encrypt(secret);
    enroll = { secret, otpauth: otpauthUri(`${emp?.email ?? uid}`, secret) };
  }
  saveDb();
  logAuth({ actor: uid, event: "password_ok", ip, detail: enroll ? "mfa_enroll" : "mfa_verify" });
  return json({ ticket: sign(uid, "ticket", TICKET_SEC), mfa: enroll ? "enroll" : "verify", mustChange: u.mustChange, defaultPassword: password === INITIAL_PASSWORD, ...enroll });
}
