import { site } from '../content/site.mjs';
import { slots } from '../content/images.mjs';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const url = (p = '/') => site.basePath + String(p).replace(/^\//, '');
export const abs = (p = '/') => site.url + (site.basePath === '/' ? '' : site.basePath.replace(/\/$/, '')) + (p.startsWith('/') ? p : '/' + p);

export const icons = {
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  temp: '<path d="M10 4a2 2 0 014 0v10a4 4 0 11-4 0z"/><path d="M12 9v7"/>',
  shelf: '<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 3h6"/>',
  region: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  trace: '<path d="M4 7h4v4H4zM16 13h4v4h-4zM8 9h5a3 3 0 013 3v1"/>',
  volume: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  cert: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5L8 21l4-2 4 2-1-7.5"/>',
  flow: '<path d="M4 6h10M4 12h16M4 18h12"/><path d="M17 3l3 3-3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mountain: '<path d="M3 19l6-10 4 6 3-4 5 8z"/>',
  bridge: '<path d="M2 17c4-9 16-9 20 0M2 19h20M7 12v7M17 12v7M12 9.5V19"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
};
export const icon = (name, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || ''}</svg>`;

export const btn = (label, href, variant = 'red') =>
  `<a class="btn btn--${variant}" href="${href.startsWith('#') || /^(https?:|mailto:)/.test(href) ? href : url(href)}"><span>${label}</span>${icon('arrow', 'ico arr')}</a>`;

// ---- 画像スロット ----
const TONES = {
  dusk: ['#26364d', '#8b6f8e', '#f0a862', '#46566d', '#2f3f57'],
  field: ['#c9d8c2', '#f0dfa4', '#e2c26c', '#7f9a68', '#5d7a4c'],
  sea: ['#b9d3e3', '#e8eef0', '#9ec0d4', '#5f8aa6', '#3f6784'],
  warm: ['#f0d8b8', '#e9b98a', '#d8945e', '#b36b3f', '#8a4a2c'],
  neutral: ['#e4e0d8', '#d2cdc3', '#bdb7ab', '#9e988b', '#7d776b']
};
export function placeholderArt(tone) {
  const c = TONES[tone] || TONES.neutral;
  return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="sk-${tone}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="800" height="500" fill="url(#sk-${tone})"/><circle cx="600" cy="230" r="70" fill="${c[2]}" opacity=".55"/><path d="M0 300L120 236 230 290 360 196 470 278 590 226 700 290 800 246V500H0z" fill="${c[3]}" opacity=".55"/><path d="M0 350L110 300 230 344 350 288 480 346 620 296 800 356V500H0z" fill="${c[3]}" opacity=".8"/><path d="M0 410L160 370 320 410 480 372 640 412 800 380V500H0z" fill="${c[4]}"/></svg>`;
}
export function slot(id, { cls = '', eager = false, alt } = {}) {
  const s = slots[id];
  if (!s) throw new Error(`Unknown image slot: ${id}`);
  const ext = ['avif', 'webp', 'jpg', 'jpeg', 'png'].find((e) => existsSync(join(ROOT, 'static/images', `${id}.${e}`)));
  const [w, h] = s.ratio.split('/').map(Number);
  const style = `aspect-ratio:${w}/${h}`;
  if (ext) {
    return `<figure class="slot ${cls}" style="${style}"><img src="${url(`images/${id}.${ext}`)}" alt="${esc(alt ?? s.alt)}" width="${w * 100}" height="${h * 100}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}></figure>`;
  }
  const label = site.showSlotLabels ? `<figcaption class="slot-label">IMAGE SLOT · ${esc(id)}</figcaption>` : '';
  return `<figure class="slot slot--ph ${cls}" style="${style}" role="img" aria-label="${esc(alt ?? s.alt)}">${placeholderArt(s.tone)}${label}</figure>`;
}
export const hasSlotFile = (id) => ['avif', 'webp', 'jpg', 'jpeg', 'png'].some((e) => existsSync(join(ROOT, 'static/images', `${id}.${e}`)));
export const slotUrl = (id) => {
  const e = ['avif', 'webp', 'jpg', 'jpeg', 'png'].find((x) => existsSync(join(ROOT, 'static/images', `${id}.${x}`)));
  return e ? url(`images/${id}.${e}`) : null;
};

// ---- ロゴ ----
export const markSvg = (cls = 'lm') =>
  `<svg class="${cls}" viewBox="0 0 160 130" aria-hidden="true" focusable="false"><defs><linearGradient id="lmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--logo-ink,#111)"/><stop offset="1" stop-color="var(--logo-ink2,#3a3a3a)"/></linearGradient></defs><path class="lm-bar" d="M22 8h32v110H22zM106 8h32v110h-32z" fill="url(#lmg)"/><path class="lm-bar" d="M54 66h52v16H54z" fill="url(#lmg)"/><path d="M12 86Q80 6 150 86Q80 46 12 86z" fill="var(--logo-shadow,#c4c4c4)"/><path d="M2 82Q80-10 158 82Q80 32 2 82z" fill="var(--logo-arc,#D71920)"/></svg>`;
export const logo = (variant = '') =>
  `<a class="logo ${variant}" href="${url('/')}" aria-label="H-LINK ホーム">${markSvg()}<span class="logo-word"><b>H</b>-LINK</span></a>`;
