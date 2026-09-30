import { INITIAL_PASSWORD, checkPassword, loadDb, saveDb } from "@/server/db";
import { TICKET_SEC, json, sameOrigin, sign } from "@/server/session";
import { newSecret, otpauthUri } from "@/lib/totp";
import { EMPLOYEES } from "@/lib/data";

export const dynamic = "force-dynamic";
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const { id, password } = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  const db = loadDb();
  const u = id ? db.users[id.toUpperCase()] : undefined;
  const bad = () => json({ error: "社員番号またはパスワードが正しくありません。" }, 401);
  if (!id || typeof password !== "string" || !u) { checkPassword(password ?? "", { salt: "00", hash: "00" } as never); return bad(); }
  if (u.lockedUntil > Date.now()) return json({ error: `アカウントがロックされています。${Math.ceil((u.lockedUntil - Date.now()) / 60000)}分後に再試行してください。` }, 423);
  if (!checkPassword(password, u)) {
    u.fails += 1;
    if (u.fails >= MAX_FAILS) { u.lockedUntil = Date.now() + LOCK_MS; u.fails = 0; }
    saveDb();
    return bad();
  }
  u.fails = 0;
  const uid = id.toUpperCase();
  const emp = EMPLOYEES.find((e) => e.id === uid);
  let enroll: { secret: string; otpauth: string } | undefined;
  if (!u.totpEnrolled) {
    u.totpSecret = newSecret(); // 未登録の間は毎回再発行（登録完了前の秘密は使い回さない）
    enroll = { secret: u.totpSecret, otpauth: otpauthUri(`${emp?.email ?? uid}`, u.totpSecret) };
  }
  saveDb();
  return json({ ticket: sign(uid, "ticket", TICKET_SEC), mfa: enroll ? "enroll" : "verify", mustChange: u.mustChange, defaultPassword: password === INITIAL_PASSWORD, ...enroll });
}
