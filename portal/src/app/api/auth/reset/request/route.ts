import { employeeById, loadDb, roleOfServer } from "@/server/db";
import { json, sameOrigin } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import { sendMail } from "@/server/mail";
import { issueReset, origin, RESET_TTL_MS } from "@/server/reset";

export const dynamic = "force-dynamic";
const cool = new Map<string, number[]>();

/** 従業員番号＋登録メールアドレスで本人確認し、ワンタイムURLをメールで送る。結果は常に同じ文言（登録の有無を漏らさない） */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = clientIp(req);
  if (rateLimited("reset:" + ip, 10)) return json({ error: "試行回数が多すぎます。しばらくしてから再試行してください。" }, 429);
  const { id, email } = (await req.json().catch(() => ({}))) as { id?: string; email?: string };
  const uid = typeof id === "string" ? id.trim().toUpperCase() : "";
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const reply = () => json({ ok: true, minutes: RESET_TTL_MS / 60000 });
  if (!uid || !mail) return json({ error: "従業員番号とメールアドレスを入力してください。" }, 400);
  const emp = employeeById(uid);
  const hits = (cool.get(uid) ?? []).filter((t) => Date.now() - t < 3600_000);
  if (hits.length >= 3) { logAuth({ actor: uid, event: "pin_reset_throttled", ip }); return reply(); }
  cool.set(uid, [...hits, Date.now()]);
  if (!emp || !roleOfServer(uid) || !loadDb().users[uid] || !emp.email || emp.email.trim().toLowerCase() !== mail) { logAuth({ actor: uid, event: "pin_reset_request_unmatched", ip }); return reply(); }
  const { token } = issueReset(uid, "email");
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const url = `${origin(req)}${base}/reset/?t=${token}`;
  const sent = await sendMail(emp.email, "【H-LINK社内ポータル】PINの再設定", `${emp.name} 様\n\nPINの再設定のご依頼を受け付けました。下のURLから、${RESET_TTL_MS / 60000}分以内に新しいPINを設定してください（1回のみ有効）。\n\n${url}\n\n心当たりがない場合は、このメールを破棄し、人事・情報システム担当へご連絡ください。`);
  logAuth({ actor: uid, event: "pin_reset_requested", ip, detail: sent ? "mail_sent" : "mail_not_configured" });
  return reply();
}
