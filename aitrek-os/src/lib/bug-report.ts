// 不具合の自動検知・報告。
// リポジトリ（Issue）は公開されているため、取引データ・個人情報が含まれないよう
// エラー内容を匿名化してから送る。
import { APP_VERSION } from "./changelog";

export interface BugReport {
  fingerprint: string;
  kind: "error" | "rejection" | "render" | "manual";
  message: string;
  stack: string;
  path: string;
  version: string;
  userAgent: string;
  at: string;
  description?: string;
}

const LOG_KEY = "aitrek-os:bug-log";
const SENT_KEY = "aitrek-os:bug-sent";

/** メール・URL・数字・引用符内の文字列を伏せる */
export function redact(s: string) {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/https?:\/\/[^\s)'"]+/g, (u) => {
      try {
        const url = new URL(u);
        return url.origin === location.origin ? url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id") : "<url>";
      } catch {
        return "<url>";
      }
    })
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/"[^"]{0,200}"|'[^']{0,200}'|「[^」]{0,200}」/g, '"…"')
    .replace(/\d{3,}/g, "<n>")
    .slice(0, 600);
}

/** スタックはファイル名と行番号だけ残す */
function cleanStack(stack = "") {
  return stack
    .split("\n")
    .slice(0, 12)
    .map((l) => {
      const m = l.match(/(\/_next\/[^\s)?]+|webpack[^\s)]*|\/src\/[^\s)]+)(:\d+:\d+)?/);
      const fn = l.trim().match(/^at ([\w$.<>]+)/)?.[1] ?? "";
      return m ? `${fn} ${m[1]}${m[2] ?? ""}`.trim() : "";
    })
    .filter(Boolean)
    .join("\n");
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function buildReport(kind: BugReport["kind"], err: unknown, description?: string): BugReport {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  const message = redact(`${e.name}: ${e.message}`);
  const stack = cleanStack(e.stack);
  const path = location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
  return {
    fingerprint: hash(`${kind}|${message}|${stack.split("\n")[0] ?? ""}|${path.split("/")[1] ?? ""}`),
    kind,
    message,
    stack,
    path,
    version: APP_VERSION,
    userAgent: navigator.userAgent.replace(/\([^)]*\)/, (m) => m.split(";").slice(0, 2).join(";") + ")"),
    at: new Date().toISOString(),
    description: description ? description.slice(0, 2000) : undefined,
  };
}

export function readBugLog(): (BugReport & { sent: boolean })[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLog(list: (BugReport & { sent: boolean })[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

/** 報告を記録し、サーバーへ送る（同じ不具合は 1 日 1 回まで） */
export async function submitReport(r: BugReport, token?: string): Promise<{ ok: boolean; url?: string; reason?: string }> {
  const log = readBugLog();
  let sent: Record<string, string> = {};
  try {
    sent = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {}
  const today = r.at.slice(0, 10);
  if (r.kind !== "manual" && sent[r.fingerprint] === today) return { ok: true, reason: "duplicate" };

  const entry = { ...r, sent: false };
  writeLog([entry, ...log.filter((x) => !(x.fingerprint === r.fingerprint && x.kind !== "manual"))]);
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(r),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: j.error ?? `HTTP ${res.status}` };
    sent[r.fingerprint] = today;
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    writeLog(readBugLog().map((x) => (x.fingerprint === r.fingerprint && x.at === r.at ? { ...x, sent: true } : x)));
    return { ok: true, url: j.url };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
