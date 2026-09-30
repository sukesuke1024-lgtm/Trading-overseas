// ロゴSVG・ファビコン・アイコン・OGP画像を生成して static/ に書き出します。
//   npm run assets   （playwright + Chromium が必要）
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const mark = ({ ink = '#111', ink2 = '#3a3a3a', arc = '#D71920', shadow = '#c4c4c4', id = 'g' } = {}) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ink}"/><stop offset="1" stop-color="${ink2}"/></linearGradient></defs><path d="M22 8h32v110H22zM106 8h32v110h-32zM54 66h52v16H54z" fill="url(#${id})"/><path d="M12 86Q80 6 150 86Q80 46 12 86z" fill="${shadow}"/><path d="M2 82Q80-10 158 82Q80 32 2 82z" fill="${arc}"/>`;
const svg = (w, h, inner, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg}${inner}</svg>\n`;
const word = (x, y, size, hc, tc) => `<text x="${x}" y="${y}" font-family="'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif" font-weight="700" font-size="${size}" letter-spacing="${size * 0.06}"><tspan fill="${hc}">H</tspan><tspan fill="${tc}">-LINK</tspan></text>`;

writeFileSync(join(out, 'logo-mark.svg'), svg(160, 130, mark()));
writeFileSync(join(out, 'favicon.svg'), svg(160, 130, mark()));
writeFileSync(join(out, 'logo.svg'), svg(520, 130, mark() + word(180, 96, 84, '#D71920', '#111')));
writeFileSync(join(out, 'logo-white.svg'), svg(520, 130, mark({ ink: '#fff', ink2: '#e2e2e2', arc: '#fff', shadow: 'rgba(255,255,255,.4)', id: 'gw' }) + word(180, 96, 84, '#fff', '#fff')));
writeFileSync(join(out, 'logo-mono.svg'), svg(520, 130, mark({ ink: '#111', ink2: '#111', arc: '#111', shadow: '#999', id: 'gm' }) + word(180, 96, 84, '#111', '#111')));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const shot = async (html, w, h, file) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html); await p.screenshot({ path: join(out, file) }); await p.close();
};
const icon = (size, pad) => `<body style="margin:0;background:#fff;display:grid;place-items:center;width:${size}px;height:${size}px"><svg viewBox="0 0 160 130" style="width:${size - pad * 2}px">${mark()}</svg></body>`;
await shot(icon(32, 3), 32, 32, 'favicon-32.png');
await shot(icon(180, 26), 180, 180, 'apple-touch-icon.png');
await shot(icon(192, 26), 192, 192, 'icon-192.png');
await shot(icon(512, 70), 512, 512, 'icon-512.png');
await shot(`<body style="margin:0;width:1200px;height:630px;background:linear-gradient(180deg,#1b2a42,#6b5f83 55%,#f0a862);font-family:'Noto Serif JP','IPAGothic',serif;color:#fff;display:flex;align-items:center;padding:0 90px;box-sizing:border-box;gap:56px;position:relative;overflow:hidden">
<svg viewBox="0 0 160 130" style="width:250px;flex:none">${mark({ ink: '#fff', ink2: '#ddd', shadow: 'rgba(255,255,255,.4)', id: 'o' })}</svg>
<div><div style="font-size:92px;font-weight:700;letter-spacing:.06em"><span style="color:#ff5a62">H</span>-LINK</div><div style="font-size:38px;margin-top:22px;line-height:1.5">つなぐ、越える、<br>食の可能性をひらく。</div></div>
<svg viewBox="0 0 1200 200" style="position:absolute;left:0;bottom:-20px;width:1200px"><path d="M-40 190Q600 -60 1240 190" fill="none" stroke="#D71920" stroke-width="8"/></svg></body>`, 1200, 630, 'og.png');
await b.close();
console.log('assets written to static/');
