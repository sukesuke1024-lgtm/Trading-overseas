// OGP画像（言語別 1200×630）とアプリアイコンを生成して static/ に保存する。
// 文言を変えたときだけ実行すればよい（生成物はリポジトリにコミット済み）。
//   node scripts/make-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import cfg from '../site.config.mjs';
import { globeSvg } from '../src/template.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const FONTS = {
  ja: '"Noto Sans JP", "IPAPGothic", sans-serif',
  en: '"Montserrat", "Noto Sans JP", sans-serif',
  zh: '"Noto Sans SC", "WenQuanYi Zen Hei", sans-serif',
};

const ogHtml = (t, code) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Noto+Sans+JP:wght@700;900&family=Noto+Sans+SC:wght@700;900&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:${FONTS[code]};color:#f4f7ff;
background:radial-gradient(60% 60% at 10% 0%,rgba(54,214,200,.22),transparent 70%),radial-gradient(50% 60% at 100% 100%,rgba(255,169,77,.2),transparent 70%),linear-gradient(135deg,#07142e,#0b1d44 60%,#10204a);position:relative}
.globe{position:absolute;right:-70px;top:25px;width:600px;height:600px}
.route{stroke-dasharray:8 10}.route-t{stroke:#36d6c8}.route-o{stroke:#ffa94d}.pulse{display:none}
.copy{position:absolute;left:72px;top:0;bottom:0;width:${code === 'en' ? 700 : 660}px;display:flex;flex-direction:column;justify-content:center}
.k{font-family:Montserrat,sans-serif;font-weight:800;letter-spacing:.2em;font-size:20px;color:#36d6c8}
.s{margin-top:22px;font-size:28px;font-weight:700;color:#b7c5e3}
h1{margin-top:10px;font-size:${code === 'en' ? 70 : 78}px;line-height:1.18;font-weight:900}
.bar{margin-top:30px;width:90px;height:6px;border-radius:3px;background:linear-gradient(90deg,#36d6c8,#ffa94d)}
.b{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap}
.b span{font-size:20px;font-weight:700;padding:8px 18px;border-radius:999px;border:2px solid rgba(255,255,255,.3)}
</style></head><body>
${globeSvg()}
<div class="copy"><p class="k">OVERSEAS BUYER / OVERSEAS SALES</p><p class="s">${t.hero.sub}</p>
<h1>${t.hero.h1.join('<br>')}</h1><div class="bar"></div>
<div class="b">${t.hero.badges.slice(0, 2).map((b) => `<span>${b}</span>`).join('')}</div></div>
</body></html>`;

const iconHtml = (size) => `<!DOCTYPE html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:#07142e}</style></head>
<body>${fs.readFileSync(path.join(OUT, 'favicon.svg'), 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(path.join(OUT, 'assets', 'og'), { recursive: true });

for (const l of cfg.languages) {
  const t = (await import(`../src/content/${l.code}.mjs`)).default;
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(t, l.code), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, 'assets', 'og', `og-${l.code}.png`) });
  console.log('og', l.code);
}

for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconHtml(size));
  await page.screenshot({ path: path.join(OUT, name), omitBackground: false });
  console.log('icon', name);
}
await browser.close();
