import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const htmls = walk(dist).filter((f) => f.endsWith('.html'));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

for (const f of htmls) {
  const h = readFileSync(f, 'utf8'), name = f.replace(dist, '');
  ok((h.match(/<h1[\s>]/g) || []).length === 1, `${name}: h1は1つ`);
  ok(/<title>[^<]+<\/title>/.test(h) && /name="description" content="[^"]{20,}/.test(h), `${name}: title/description`);
  ok(/rel="canonical"/.test(h) && /property="og:image"/.test(h), `${name}: canonical/OGP`);
  ok(!/<img(?![^>]*\balt=)/.test(h), `${name}: imgにalt`);
  for (const bad of ['Hokkaido Food Link', 'From Local to Global', 'コンサルティング会社', '★', '☆']) ok(!h.includes(bad), `${name}: 禁止表現「${bad}」`);
  // 内部リンク切れ
  for (const m of h.matchAll(/(?:href|src)="(\/[^"#?]*)[^"]*"/g)) {
    const t = m[1]; if (t.startsWith('//')) continue;
    const c = join(dist, t.endsWith('/') ? t + 'index.html' : t);
    ok(existsSync(c), `${name}: リンク切れ ${t}`);
  }
  // フォームの全ラベル
  for (const m of h.matchAll(/<(?:input|select|textarea) id="([^"]+)"/g)) ok(h.includes(`for="${m[1]}"`), `${name}: label for ${m[1]}`);
}
for (const f of ['sitemap.xml', 'robots.txt', 'og.png', 'favicon.svg', 'css/style.css', 'js/main.js']) ok(existsSync(join(dist, f)), `${f} がある`);
console.log(`OK: ${htmls.length}ページ / ${n}項目のチェックに合格`);

// ブラウザ検査（playwright + Chromium がある場合のみ）: 横スクロール・JSエラー・axe
try {
  const { chromium } = await import('playwright');
  const { createRequire } = await import('node:module');
  const axeSrc = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  const { createServer } = await import('node:http');
  const srv = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); let f = join(dist, p); try { if (statSync(f).isDirectory()) f = join(f, 'index.html'); } catch {} try { r.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8' }); r.end(readFileSync(f)); } catch { r.writeHead(404); r.end(); } }).listen(0);
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let bad = 0;
  for (const w of [375, 768, 1440]) {
    const pg = await b.newPage({ viewport: { width: w, height: 800 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    for (const f of htmls) {
      const path = f.replace(dist, '').replace(/index\.html$/, '');
      if (path === '/404.html') continue;
      await pg.goto(`http://localhost:${port}${path}`); await pg.waitForTimeout(800);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 1) { console.error(`横スクロール: ${path} @${w} (+${over}px)`); bad++; }
      if (w === 1440) {
        await pg.addScriptTag({ content: axeSrc });
        const r = await pg.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa'], rules: { 'color-contrast': { enabled: true } } }));
        for (const v of r.violations) { console.error(`axe ${v.id} (${v.impact}): ${path} — ${v.nodes.length}箇所 ${v.nodes[0].target}`); bad++; }
      }
    }
    if (errs.length) { console.error('JSエラー', errs); bad++; }
  }
  await b.close(); srv.close();
  assert.equal(bad, 0, `ブラウザ検査で${bad}件の問題`);
  console.log('OK: 横スクロールなし(375/768/1440) / JSエラーなし / axe(WCAG A・AA)違反なし');
} catch (e) {
  if (/Cannot find (module|package)|Executable doesn't exist|browserType\.launch/.test(String(e.message))) console.log('（ブラウザ検査はスキップ: ' + e.message.split('\n')[0] + '）');
  else throw e;
}
