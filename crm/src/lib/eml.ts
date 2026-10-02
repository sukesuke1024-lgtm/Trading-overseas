// メール下書き（.eml）の生成。添付ファイル付きで、Outlook・Apple Mail・Thunderbird で開いてそのまま送れる（X-Unsent: 1）。
export interface EmlAttachment { filename: string; contentType: string; base64: string }
export interface EmlInput { from: string; to: string; bcc: string[]; subject: string; text: string; html: string; attachments: EmlAttachment[]; boundarySeed?: string }

const b64 = (s: string) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s))));
const wrap = (s: string, n = 76) => (s.match(new RegExp(`.{1,${n}}`, "g")) ?? []).join("\r\n");
/** 件名・表示名などの非ASCII文字（RFC 2047）。長い場合は複数語に分ける */
export function encodeWord(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const chars = [...s]; const parts: string[] = []; let cur = "";
  for (const c of chars) { if (b64(cur + c).length > 40) { parts.push(cur); cur = c; } else cur += c; }
  if (cur) parts.push(cur);
  return parts.map((p) => `=?UTF-8?B?${b64(p)}?=`).join("\r\n ");
}
/** ヘッダーの折り返し（1行78文字程度）。宛先リストなどが長くても RFC に沿う */
export function foldAddrs(name: string, addrs: string[]): string {
  const lines: string[] = []; let line = `${name}:`;
  addrs.forEach((a, i) => { const piece = ` ${a}${i < addrs.length - 1 ? "," : ""}`; if (line.length + piece.length > 76) { lines.push(line); line = piece; } else line += piece; });
  lines.push(line);
  return lines.join("\r\n");
}
const encFilename = (n: string) => `filename*=UTF-8''${encodeURIComponent(n)}; filename="${n.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")}"`;

export function buildEml(i: EmlInput): string {
  const seed = i.boundarySeed ?? Math.random().toString(36).slice(2);
  const mixed = `----=_HLINK_Mixed_${seed}`, alt = `----=_HLINK_Alt_${seed}`;
  const h: string[] = [
    "X-Unsent: 1", "MIME-Version: 1.0", `From: ${i.from}`, `To: ${i.to}`,
    ...(i.bcc.length ? [foldAddrs("Bcc", i.bcc)] : []),
    `Subject: ${encodeWord(i.subject)}`,
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];
  const body: string[] = [
    `--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "",
    `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(b64(i.text)), "",
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(b64(i.html)), "",
    `--${alt}--`, "",
  ];
  for (const a of i.attachments) body.push(`--${mixed}`, `Content-Type: ${a.contentType || "application/octet-stream"}; name="${a.filename.replace(/[^\x20-\x7e]/g, "_")}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; ${encFilename(a.filename)}`, "", wrap(a.base64), "");
  body.push(`--${mixed}--`, "");
  return h.join("\r\n") + "\r\n\r\n" + body.join("\r\n");
}
