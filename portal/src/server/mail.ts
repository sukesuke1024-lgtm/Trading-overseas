// メール送信。PORTAL_MAIL_WEBHOOK（社内のメール送信APIやiPaaSのURL）が設定されていれば、JSON を POST して送る。
// 未設定の間は送信できないため、data/outbox.jsonl に残し、管理者画面から「ワンタイムURLを発行」して本人へ直接渡す。
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.PORTAL_DATA_DIR ?? path.join(process.cwd(), "data");
export const mailConfigured = () => !!process.env.PORTAL_MAIL_WEBHOOK;

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const hook = process.env.PORTAL_MAIL_WEBHOOK;
  if (!hook) {
    try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, "outbox.jsonl"), JSON.stringify({ at: new Date().toISOString(), to, subject, text }) + "\n", { mode: 0o600 }); } catch {}
    return false;
  }
  try {
    const r = await fetch(hook, { method: "POST", headers: { "content-type": "application/json", ...(process.env.PORTAL_MAIL_TOKEN ? { authorization: `Bearer ${process.env.PORTAL_MAIL_TOKEN}` } : {}) }, body: JSON.stringify({ to, subject, text }), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}
