// 公開データの自動更新（毎時、GitHub Actions から実行）。為替・制裁リスト・公式ニュース（RSS/Atom）を取得し、public/data/*.json に書き出す。
//   node scripts/refresh-data.mjs
// 取得に失敗したソースは、前回のデータを残し、状態（status.json）に失敗を記録する。人手を介さず 24 時間 365 日、最新を保つ。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFeed, parseSdnCsv, ratesFromErApi, ratesFromFrankfurter } from "./feeds-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public/data");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/data-sources.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const read = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")); } catch { return fallback; } };
const write = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v));
const now = new Date().toISOString();
const UA = "H-LINK-CRM-monitor/1.0 (public data refresh)";

async function get(url, ms = 25000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow" }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
  finally { clearTimeout(t); }
}

const status = read("status.json", { runs: {} });
const runs = { fx: { ok: false, at: now }, sanctions: { ok: false, at: now }, feeds: [] };

// 1) 為替
try {
  const out = { updatedAt: now, sources: [] };
  const cur = cfg.fx.currencies;
  const tryFx = async (id, label, url, parse) => { try { const j = JSON.parse(await get(url)); const r = parse(j, cur); if (Object.keys(r.rates).length) out.sources.push({ id, label, asOf: r.asOf, rates: r.rates }); } catch (e) { out.sources.push({ id, label, error: String(e.message ?? e) }); } };
  await tryFx("ecb", "欧州中央銀行（ECB）参考レート", cfg.fx.frankfurter + "&to=" + cur.join(","), ratesFromFrankfurter);
  await tryFx("er", "ExchangeRate-API（日次）", cfg.fx.erApi, ratesFromErApi);
  if (out.sources.some((s) => s.rates)) { write("fx.json", out); runs.fx.ok = true; } else runs.fx.error = "すべての為替ソースで取得に失敗";
} catch (e) { runs.fx.error = String(e.message ?? e); }

// 2) 制裁リスト（OFAC SDN）
try {
  let text = null, last = "";
  for (const u of cfg.sanctions.ofac.urls) { try { text = await get(u, 90000); if (text && text.length > 10000) break; } catch (e) { last = String(e.message ?? e); } }
  if (!text) throw new Error(last || "取得できませんでした");
  const entries = parseSdnCsv(text);
  if (entries.length < 1000) throw new Error(`件数が少なすぎます（${entries.length}件）`);
  write("sanctions.json", { updatedAt: now, source: cfg.sanctions.ofac.name, count: entries.length, entries: entries.map((e) => ({ n: e.n, t: e.t, p: e.p, id: e.id })) });
  runs.sanctions = { ok: true, at: now, count: entries.length };
} catch (e) { runs.sanctions.error = String(e.message ?? e); }

// 3) 公式ニュース（RSS/Atom）
const prev = read("feeds.json", { items: [] });
const all = [];
for (const f of cfg.feeds) {
  try { const items = parseFeed(await get(f.url), 15); if (!items.length) throw new Error("記事を読み取れませんでした（形式が違う可能性）"); items.forEach((x) => all.push({ ...x, source: f.id, sourceName: f.name, category: f.category })); runs.feeds.push({ id: f.id, name: f.name, ok: true, count: items.length, at: now }); }
  catch (e) { prev.items.filter((x) => x.source === f.id).forEach((x) => all.push(x)); runs.feeds.push({ id: f.id, name: f.name, ok: false, error: String(e.message ?? e), at: now, url: f.url, site: f.site, verified: f.verified }); }
}
all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
write("feeds.json", { updatedAt: now, items: all.slice(0, 120) });

// 状態：成功した時刻は、失敗しても前回の値を残す
const merged = { generatedAt: now, runs: { fx: runs.fx.ok ? runs.fx : { ...runs.fx, lastOk: status.runs?.fx?.lastOk ?? status.runs?.fx?.at }, sanctions: runs.sanctions.ok ? runs.sanctions : { ...runs.sanctions, lastOk: status.runs?.sanctions?.lastOk ?? (status.runs?.sanctions?.ok ? status.runs.sanctions.at : undefined) }, feeds: runs.feeds } };
write("status.json", merged);
console.log(JSON.stringify({ fx: runs.fx.ok, sanctions: runs.sanctions.ok ? runs.sanctions.count : runs.sanctions.error, feeds: runs.feeds.map((f) => `${f.id}:${f.ok ? f.count : "NG"}`) }));
