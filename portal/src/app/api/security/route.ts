import { loadDb, roleOfServer, saveDb } from "@/server/db";
import { json, sameOrigin, sessionUser } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { mailConfigured } from "@/server/mail";
import { secSettings } from "@/server/security";
import { isValidNet } from "@/lib/ops";

export const dynamic = "force-dynamic";
const publicDevice = (d: { id: string; empId: string; label: string; status: string; createdAt: string; lastSeen: string; lastIp: string; approvedBy?: string }) => ({ id: d.id, empId: d.empId, label: d.label, status: d.status, createdAt: d.createdAt, lastSeen: d.lastSeen, lastIp: d.lastIp, approvedBy: d.approvedBy });

/** 管理者：端末・アラート・設定。一般の従業員は自分の登録端末だけ */
export async function GET(req: Request) {
  const uid = sessionUser(req), role = uid ? roleOfServer(uid) : null;
  if (!uid || !role) return json({ error: "unauthorized" }, 401);
  const db = loadDb();
  if (role !== "admin" || new URL(req.url).searchParams.has("mine")) return json({ devices: (db.devices ?? []).filter((d) => d.empId === uid).map(publicDevice) });
  return json({ devices: (db.devices ?? []).map(publicDevice), alerts: (db.alerts ?? []).slice(0, 300), sec: secSettings(), envOverride: !!process.env.PORTAL_SECURITY_MODE, mailConfigured: mailConfigured() });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const uid = sessionUser(req);
  if (!uid || roleOfServer(uid) !== "admin") return json({ error: "forbidden" }, 403);
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; label?: string; mode?: string; nets?: string[] };
  const db = loadDb(), ip = clientIp(req);
  const dev = (db.devices ?? []).find((d) => d.id === b.id);
  switch (b.action) {
    case "approve": if (!dev) break; dev.status = "approved"; dev.approvedBy = uid; saveDb(); logAuth({ actor: uid, event: "device_approved", ip, detail: `${dev.empId} ${dev.label}` }); return json({ ok: true });
    case "revoke": if (!dev) break; dev.status = "revoked"; saveDb(); logAuth({ actor: uid, event: "device_revoked", ip, detail: `${dev.empId} ${dev.label}` }); return json({ ok: true });
    case "delete": if (!dev) break; db.devices = (db.devices ?? []).filter((d) => d.id !== dev.id); saveDb(); logAuth({ actor: uid, event: "device_deleted", ip, detail: `${dev.empId} ${dev.label}` }); return json({ ok: true });
    case "rename": if (!dev || typeof b.label !== "string" || !b.label.trim()) break; dev.label = b.label.trim().slice(0, 60); saveDb(); return json({ ok: true });
    case "ack": for (const a of db.alerts ?? []) if (b.id === "all" || a.id === b.id) { a.ack = true; a.ackBy = uid; } saveDb(); return json({ ok: true });
    case "setting": {
      if (!["enforce", "monitor", "off"].includes(b.mode ?? "") || !Array.isArray(b.nets) || b.nets.length > 50 || !b.nets.every((n) => typeof n === "string" && isValidNet(n))) return json({ error: "設定が正しくありません（許可ネットワークは 192.168.1.0/24 や 203.0.113.5 の形式）。" }, 400);
      db.sec = { mode: b.mode as "enforce", nets: b.nets.map((n) => n.trim()) }; saveDb(); logAuth({ actor: uid, event: "security_settings", ip, detail: `${b.mode} ${b.nets.join(",")}` }); return json({ ok: true });
    }
  }
  return json({ error: "bad request" }, 400);
}
