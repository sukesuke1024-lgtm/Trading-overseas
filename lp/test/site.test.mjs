// 公開前の自動テスト: SEO / AIO / レスポンシブ / 多言語 / アクセシビリティ
//   npm test            … dist/ をビルドしてテスト
//   SCREENSHOTS=1 npm test … 各言語・各画面幅のスクリーンショットを screenshots/ に保存
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import cfg from '../site.config.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'screenshots');
const base = new URL(cfg.siteUrl.endsWith('/') ? cfg.siteUrl : cfg.siteUrl + '/');
const PREFIX = base.pathname; // e.g. /KAAS-E-learning/

// ---- static server that mimics the production path prefix ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404).end(); return; }
  p = p.slice(PREFIX.length);
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html' }).end(fs.readFileSync(path.join(DIST, '404.html'))); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;
const local = (p = '') => origin + PREFIX + p;

// ---- tiny test harness ----
let failed = 0, passed = 0;
const results = [];
function check(name, ok, detail = '') {
  if (ok) passed++; else failed++;
  results.push(`${ok ? '  ✔' : '  ✘'} ${name}${!ok && detail ? `\n      → ${detail}` : ''}`);
}
const len = (s) => [...s].length;

const browser = await chromium.launch();
const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920];

for (const lang of cfg.languages) {
  results.push(`\n[${lang.label}] ${lang.path || '/'}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  const resp = await page.goto(local(lang.path), { waitUntil: 'load' });
  check('HTTP 200', resp.status() === 200, String(resp.status()));

  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const meta = (n) => q(`meta[name="${n}"]`)?.content || q(`meta[property="${n}"]`)?.content || '';
    return {
      lang: document.documentElement.lang,
      title: document.title,
      description: meta('description'),
      robots: meta('robots'),
      viewport: meta('viewport'),
      canonical: q('link[rel="canonical"]')?.href,
      alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href]),
      og: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:locale', 'twitter:card'].map((k) => [k, meta(k)]),
      h1: document.querySelectorAll('h1').length,
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
      imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      anchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1),
      ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
      links: [...document.querySelectorAll('a[href], link[href], script[src], source[src], track[src], video[poster]')]
        .map((e) => e.getAttribute('href') || e.getAttribute('src') || e.getAttribute('poster'))
        .filter((h) => h && !h.startsWith('#') && !h.startsWith('mailto:') && !/^https?:/.test(h)),
      tracks: [...document.querySelectorAll('video track')].map((t) => t.srclang),
      text: document.body.innerText.length,
    };
  });

  // --- SEO ---
  check('<html lang> matches language', info.lang === lang.hreflang, info.lang);
  check(`<title> length OK (${len(info.title)})`, len(info.title) >= 15 && len(info.title) <= (lang.code === 'en' ? 70 : 45), info.title);
  check(`meta description length OK (${len(info.description)})`, len(info.description) >= 70 && len(info.description) <= (lang.code === 'en' ? 200 : 160), info.description);
  check('robots allows indexing', /index/.test(info.robots) && !/noindex/.test(info.robots));
  check('viewport meta present', /width=device-width/.test(info.viewport));
  check('canonical is absolute and self-referencing', info.canonical === new URL(lang.path, base).href, info.canonical);
  const hl = Object.fromEntries(info.alternates);
  check('hreflang for every language + x-default', cfg.languages.every((l) => hl[l.hreflang] === new URL(l.path, base).href) && hl['x-default'] === base.href, JSON.stringify(info.alternates));
  check('OGP / Twitter card tags filled', info.og.every(([, v]) => v), JSON.stringify(info.og.filter(([, v]) => !v)));
  check('exactly one <h1>', info.h1 === 1, String(info.h1));
  const skip = info.headings.findIndex((h, i) => i > 0 && h > info.headings[i - 1] + 1);
  check('heading levels do not skip', skip === -1, `at index ${skip}: ${info.headings.join(',')}`);
  check('all images have alt', info.imgNoAlt === 0);

  // --- structured data / AIO ---
  let graph = [];
  try { graph = info.jsonld.flatMap((j) => JSON.parse(j)['@graph'] || []); check('JSON-LD parses', true); }
  catch (e) { check('JSON-LD parses', false, e.message); }
  const types = graph.map((g) => g['@type']);
  for (const tp of ['WebSite', 'WebPage', 'BreadcrumbList', 'Occupation', 'VideoObject', 'FAQPage']) check(`JSON-LD has ${tp}`, types.includes(tp));
  const faq = graph.find((g) => g['@type'] === 'FAQPage');
  const faqDom = await page.locator('.faq-item').count();
  check('FAQ JSON-LD matches visible FAQ', faq && faq.mainEntity.length === faqDom, `${faq?.mainEntity.length} vs ${faqDom}`);
  const video = graph.find((g) => g['@type'] === 'VideoObject');
  check('VideoObject has required fields', video && video.name && video.thumbnailUrl && video.uploadDate && video.contentUrl && video.duration);
  check('video has captions in every language', cfg.languages.every((l) => info.tracks.includes(l.hreflang)), info.tracks.join(','));
  check('video transcript present in HTML', await page.locator('.transcript li').count() >= 10);

  // --- links ---
  check('in-page anchors resolve', info.anchors.every((a) => info.ids.includes(a.slice(1))), info.anchors.filter((a) => !info.ids.includes(a.slice(1))).join(','));
  const broken = [];
  for (const href of new Set(info.links)) {
    const u = new URL(href, page.url());
    const r = await fetch(u, { method: 'HEAD' });
    if (r.status !== 200) broken.push(`${href} (${r.status})`);
  }
  check('all local links / assets return 200', broken.length === 0, broken.join(', '));
  check('no JavaScript errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  // --- accessibility (axe-core, WCAG 2.1 AA) ---
  await page.evaluate(() => { document.documentElement.classList.remove('js'); document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')); });
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  check('axe-core: no WCAG 2.1 AA violations', axe.length === 0, axe.join('\n        '));

  // --- responsive ---
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(50);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(`no horizontal scroll at ${w}px`, r.sw <= r.cw, `scrollWidth ${r.sw} > ${r.cw}`);
  }

  // mobile menu
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const toggle = page.locator('.menu-toggle');
  check('mobile: menu button visible', await toggle.isVisible());
  await toggle.click();
  check('mobile: menu opens', (await toggle.getAttribute('aria-expanded')) === 'true' && (await page.locator('#global-nav').isVisible()));
  await page.keyboard.press('Escape');
  check('mobile: Escape closes menu', (await toggle.getAttribute('aria-expanded')) === 'false');
  const tapSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.header-actions a, .header-actions button, .hero-cta a, .lang-list a')]
      .filter((e) => e.offsetParent)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 36 || r.width < 36).length,
  );
  check('mobile: tap targets ≥ 36px', tapSmall === 0, `${tapSmall} small targets`);

  await page.setViewportSize({ width: 1440, height: 900 });
  check('desktop: global nav visible, menu button hidden', (await page.locator('.nav-list').isVisible()) && !(await toggle.isVisible()));

  // --- screenshots ---
  if (process.env.SCREENSHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [label, w, h] of [['pc', 1440, 900], ['sp', 390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(local(lang.path), { waitUntil: 'load' });
      await page.evaluate(() => {
        document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in'));
        document.querySelector('.sticky-entry').style.display = 'none';
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, `${lang.code}-${label}-full.jpg`), fullPage: true, quality: 85 });
      await page.screenshot({ path: path.join(SHOTS, `${lang.code}-${label}-firstview.jpg`), quality: 85 });
    }
  }
  await page.close();
}

// ---- site-level files ----
results.push('\n[site]');
const get = async (p) => { const r = await fetch(local(p)); return [r.status, await r.text()]; };
const [rs, robots] = await get('robots.txt');
check('robots.txt served and references sitemap', rs === 200 && robots.includes(`Sitemap: ${new URL('sitemap.xml', base).href}`));
check('robots.txt welcomes AI crawlers', ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'].every((b) => robots.includes(b)));
const [ss, sitemap] = await get('sitemap.xml');
check('sitemap.xml lists every language with hreflang', ss === 200 && cfg.languages.every((l) => sitemap.includes(`<loc>${new URL(l.path, base).href}</loc>`)) && sitemap.includes('x-default'));
const [ls, llms] = await get('llms.txt');
check('llms.txt served with role definitions and FAQ', ls === 200 && llms.includes('##') && llms.length > 1000);
const [ms, manifest] = await get('manifest.webmanifest');
check('web manifest valid JSON', ms === 200 && !!JSON.parse(manifest).name);
const nf = await fetch(local('does-not-exist'));
check('404 page served for unknown paths', nf.status === 404 && (await nf.text()).includes('noindex'));

await browser.close();
server.close();

console.log(results.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
