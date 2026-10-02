// 公開データの取り込み用の純関数（取得はしない）。公式が配信している RSS/Atom と、OFAC が公開している SDN リスト（CSV）を読む。
// HTML ページのスクレイピングはしない（配信されている形式だけを使う）。

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
export const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const strip = (s) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block); return m ? m[1] : ""; };

/** RSS 2.0 / RSS 1.0（RDF）/ Atom から、タイトル・リンク・日付・要約を取り出す */
export function parseFeed(xml, limit = 15) {
  const items = [];
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  for (const b of blocks) {
    const title = strip(tag(b, "title"));
    let link = strip(tag(b, "link"));
    if (!link) { const m = /<link[^>]*href=["']([^"']+)["']/i.exec(b); link = m ? decode(m[1]) : ""; }
    if (!link) { const m = /<guid[^>]*>([^<]+)<\/guid>/i.exec(b); link = m ? decode(m[1]).trim() : ""; }
    const dateRaw = strip(tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "updated") || tag(b, "published"));
    const t = dateRaw ? Date.parse(dateRaw) : NaN;
    const summary = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 200);
    if (title && link) items.push({ title, link, date: Number.isNaN(t) ? null : new Date(t).toISOString(), summary });
  }
  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return items.slice(0, limit);
}

/** CSV の1行を、引用符つきのフィールドに分ける */
export function splitCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}
/** OFAC SDN.CSV（ヘッダーなし）：番号, 名称, 種別, プログラム, … ／ "-0-" は空欄の意味 */
export function parseSdnCsv(text) {
  const entries = []; const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const f = splitCsvLine(raw);
    if (f.length < 4) continue;
    const clean = (s) => { const v = s.trim(); return v === "-0-" ? "" : v; };
    const id = clean(f[0]), n = clean(f[1]), t = clean(f[2]) || "entity", p = clean(f[3]);
    if (!id || !n || !/^\d+$/.test(id)) continue;
    const key = `${id}|${n}`; if (seen.has(key)) continue; seen.add(key);
    entries.push({ n, t, p, id });
  }
  return entries;
}

/** 為替：ECB(frankfurter) と open.er-api から「1外貨あたりの円」を作る */
export function ratesFromFrankfurter(j, currencies) {
  const out = {};
  for (const c of currencies) if (j?.rates?.[c]) out[c] = Math.round((1 / j.rates[c]) * 1000) / 1000;
  return { asOf: j?.date ?? null, rates: out };
}
export function ratesFromErApi(j, currencies) {
  const out = {};
  for (const c of currencies) if (j?.rates?.[c]) out[c] = Math.round((1 / j.rates[c]) * 1000) / 1000;
  return { asOf: j?.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString() : null, rates: out };
}
