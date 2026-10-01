import { employeeById, loadDb, saveDb } from "@/server/db";
import { json, sameOrigin } from "@/server/session";
import { clientIp, logAuth, rateLimited } from "@/server/authlog";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

/** メールが届かない・メールアドレス未登録などの場合：管理者（人事・情シス）へのリセット申請。本人確認は管理者が行う */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = clientIp(req);
  if (rateLimited("contact:" + ip, 6)) return json({ error: "試行回数が多すぎます。しばらくしてから再試行してください。" }, 429);
  const { id, note } = (await req.json().catch(() => ({}))) as { id?: string; note?: string };
  const uid = typeof id === "string" ? id.trim().toUpperCase().slice(0, 12) : "";
  if (!uid) return json({ error: "従業員番号を入力してください。" }, 400);
  const db = loadDb();
  db.resetRequests ??= [];
  if (employeeById(uid) && !db.resetRequests.some((r) => r.id === uid && !r.handled)) {
    db.resetRequests.push({ rid: crypto.randomBytes(6).toString("hex"), id: uid, note: typeof note === "string" ? note.slice(0, 300) : "", at: new Date().toISOString() });
    if (db.resetRequests.length > 300) db.resetRequests = db.resetRequests.slice(-300);
    saveDb();
  }
  logAuth({ actor: uid, event: "pin_reset_admin_request", ip });
  return json({ ok: true }); // 登録の有無は返さない
}
