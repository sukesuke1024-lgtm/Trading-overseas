import { loadDb, roleOfServer } from "@/server/db";
import { SU_COOKIE, cookieOf, json, sessionUser, verify } from "@/server/session";
import { clientIp, logAuth } from "@/server/authlog";
import { readBlob } from "@/server/files";
import { raiseAlert } from "@/server/security";
import { canSeeFile, needsStepUp, viewerOf, type FileRec } from "@/lib/ops";

export const dynamic = "force-dynamic";

/** ダウンロード：台帳の閲覧権限を確認し、給与関係・役員部長限定のものはPIN再入力（15分）が必要。取得は監査ログに残す */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = sessionUser(req), ip = clientIp(req);
  const role = uid ? roleOfServer(uid) : null;
  if (!uid || !role) return json({ error: "unauthorized" }, 401);
  const state = loadDb().state as { files?: FileRec[]; employees?: Parameters<typeof viewerOf>[0][]; workflows?: { id: string; applicantId: string; steps: { approverId: string }[] }[] } | null;
  const rec = state?.files?.find((f) => f.id === id);
  const me = state?.employees?.find((e) => (e as { id: string }).id === uid);
  if (!rec || !me) return json({ error: "not found" }, 404);
  const wf = rec.wfId ? state?.workflows?.find((w) => w.id === rec.wfId) : undefined;
  if (!canSeeFile(rec, viewerOf(me), wf as never)) {
    logAuth({ actor: uid, event: "file_denied", ip, detail: rec.name });
    raiseAlert({ type: "閲覧権限のないファイルへのアクセス", level: "mid", empId: uid, ip, detail: `${rec.name}（${rec.kind}）` });
    return json({ error: "forbidden" }, 403);
  }
  if (needsStepUp(rec) && verify(cookieOf(req, SU_COOKIE), "stepup") !== uid) return json({ error: "PINの再入力が必要です。", code: "stepup" }, 401);
  const buf = readBlob(id);
  if (!buf) return json({ error: "not found" }, 404);
  logAuth({ actor: uid, event: "file_download", ip, detail: `${rec.name}（${rec.kind}${rec.ownerId ? `・対象 ${rec.ownerId}` : ""}）` });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(rec.name)}`, "x-content-type-options": "nosniff", "cache-control": "no-store", "content-length": String(buf.length) } });
}
