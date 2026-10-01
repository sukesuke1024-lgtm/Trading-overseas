import { INITIAL_PIN, employeeById, hashPassword, loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { mailConfigured } from "@/server/mail";
import { issueReset, origin } from "@/server/reset";

export const dynamic = "force-dynamic";
const adminOf = (req: Request) => { const id = sessionUser(req); return id && roleOfServer(id) === "admin" ? id : null; };

/** 管理者：PINリセット申請の一覧 */
export async function GET(req: Request) {
  if (!adminOf(req)) return json({ error: "forbidden" }, 403);
  const list = (loadDb().resetRequests ?? []).filter((r) => !r.handled).map((r) => ({ ...r, name: employeeById(r.id)?.name ?? "" }));
  return json({ requests: list, mailConfigured: mailConfigured() });
}

/** 管理者：本人確認のうえ、ワンタイムURLの発行（電話・対面などで本人へ伝える）／初期PINへ戻す／申請の完了 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const admin = adminOf(req);
  if (!admin) return json({ error: "forbidden" }, 403);
  const { action, id } = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
  const uid = typeof id === "string" ? id.trim().toUpperCase() : "";
  const db = loadDb(), ip = clientIp(req);
  const u = db.users[uid];
  if (!u || !employeeById(uid)) return json({ error: "該当する従業員がいません。" }, 404);
  const done = () => { for (const r of db.resetRequests ?? []) if (r.id === uid) r.handled = true; };
  if (action === "link") {
    const { token, exp } = issueReset(uid, "admin");
    done(); saveDb(); logAuth({ actor: admin, event: "pin_reset_link_issued", ip, detail: uid });
    return json({ url: `${origin(req)}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/reset/?t=${token}`, exp });
  }
  if (action === "initial") {
    Object.assign(u, hashPassword(INITIAL_PIN), { mustChange: true, fails: 0, lockedUntil: 0 });
    u.sv += 1; done(); saveDb(); logAuth({ actor: admin, event: "pin_reset_to_initial", ip, detail: uid });
    return json({ ok: true });
  }
  if (action === "dismiss") { done(); saveDb(); return json({ ok: true }); }
  return json({ error: "bad request" }, 400);
}
