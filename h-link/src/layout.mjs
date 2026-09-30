import { site } from '../content/site.mjs';
import { nav, footerColumns } from '../content/navigation.mjs';
import { esc, url, abs, logo, icon, btn } from './util.mjs';

export function page({ path, title, description, body, heroDark = false, crumbs = [], jsonld = [], ogType = 'website', noindex = false, lang = 'ja', bodyClass = '', stickyCta = null, alt = null }) {
  const full = path === '/' ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
  const canonical = abs(path);
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: abs('/'), logo: abs('/icon-512.png'), description: site.description };
  const crumbLd = crumbs.length
    ? { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'HOME', path: '/' }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })) }
    : null;
  const lds = [org, crumbLd, ...jsonld].filter(Boolean);
  const navItems = nav
    .filter((n) => n.desktop !== false)
    .map((n) => `<a href="${url(n.path)}"${n.path === path || (n.path !== '/' && path.startsWith(n.path)) ? ' aria-current="page"' : ''}>${n.ja}</a>`)
    .join('');
  const menuItems = nav
    .map((n) => `<li><a href="${url(n.path)}"${n.path === path ? ' aria-current="page"' : ''}><small>${n.label}</small><span>${n.ja}</span></a></li>`)
    .join('');
  const social = site.social.map((s) => (s.url ? `<a href="${esc(s.url)}" rel="noopener" target="_blank">${s.name}</a>` : `<span class="muted" title="準備中">${s.name}</span>`)).join('');
  const foot = footerColumns
    .map((c) => `<div><h2 class="f-h">${c.title}</h2><ul>${c.links.map(([p, l]) => `<li><a href="${url(p)}">${l}</a></li>`).join('')}</ul></div>`)
    .join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="ja" href="${abs(path.startsWith('/en/') ? '/' : path)}">
<link rel="alternate" hreflang="en" href="${abs('/en/')}">
<link rel="alternate" hreflang="x-default" href="${abs('/')}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${abs('/og.png')}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#111111">
<link rel="icon" href="${url('/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${url('/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${url('/apple-touch-icon.png')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${url('/css/style.css')}">
${lds.map((l) => `<script type="application/ld+json">${JSON.stringify(l)}</script>`).join('\n')}
<script>document.documentElement.classList.add('js');</script>
</head>
<body class="${bodyClass}" data-hero="${heroDark ? 'dark' : 'light'}">
<a class="skip" href="#main">本文へスキップ</a>
<header class="hdr" id="hdr">
  <div class="hdr-in">
    ${logo()}
    <nav class="hdr-nav" aria-label="メインナビゲーション">${navItems}</nav>
    <div class="hdr-tools">
      <a class="lang" href="${url(lang === 'en' ? '/' : '/en/')}" hreflang="${lang === 'en' ? 'ja' : 'en'}" lang="${lang === 'en' ? 'ja' : 'en'}">${lang === 'en' ? 'JP' : 'EN'}</a>
      <a class="btn btn--red btn--sm hdr-cta" href="${url('/contact/')}"><span>お問い合わせ</span>${icon('arrow', 'ico arr')}</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu"><span class="sr">メニューを開く</span><i aria-hidden="true"></i></button>
    </div>
  </div>
</header>
<div class="menu" id="menu" hidden>
  <nav aria-label="全画面メニュー"><ul class="menu-list">${menuItems}</ul></nav>
  <div class="menu-foot"><p>${site.tagline}</p><a class="btn btn--red" href="${url('/contact/')}"><span>お問い合わせ</span>${icon('arrow', 'ico arr')}</a></div>
</div>
<main id="main">
${body}
</main>
${stickyCta ? `<div class="sticky-cta" id="sticky-cta"><a class="btn btn--red" href="${url(stickyCta.href)}"><span>${stickyCta.label}</span>${icon('arrow', 'ico arr')}</a></div>` : ''}
<footer class="ftr">
  <div class="wrap">
    <div class="ftr-top">
      <div class="ftr-brand">${logo('logo--rev')}<p class="ftr-msg">${site.tagline}</p></div>
      <div class="ftr-cols">${foot}</div>
    </div>
    <div class="ftr-bot">
      <div class="ftr-social" aria-label="SNS">${social}</div>
      <small>© ${new Date().getFullYear()} H-LINK. All rights reserved.</small>
    </div>
  </div>
</footer>
<script src="${url('/js/main.js')}" defer></script>
</body>
</html>`;
}

export const wrap = (inner, cls = '') => `<div class="wrap ${cls}">${inner}</div>`;
export const eyebrow = (t) => `<p class="eyebrow">${t}</p>`;
export function sectionHead({ eyebrow: e, title, lead, cls = '' }) {
  return `<header class="sec-head ${cls}">${e ? `<p class="eyebrow">${e}</p>` : ''}<h2 class="h2" data-reveal>${title}</h2>${lead ? `<p class="lead" data-reveal>${lead}</p>` : ''}</header>`;
}
export function pageHead({ eyebrow: e, h1, lead, crumbs }) {
  return `<section class="phead"><div class="wrap"><nav class="crumbs" aria-label="パンくず"><a href="${url('/')}">HOME</a>${crumbs.map((c) => (c.path ? `<a href="${url(c.path)}">${c.name}</a>` : `<span aria-current="page">${c.name}</span>`)).join('')}</nav><p class="eyebrow">${e}</p><h1 class="h1" data-reveal>${h1}</h1>${lead ? `<p class="lead lead--lg" data-reveal>${lead}</p>` : ''}</div></section>`;
}
export const finalCta = ({ h = '次の市場へ、一緒に。', primary = ['商品を提案する', '/contact/?type=producer'], secondary = ['仕入れについて相談する', '/contact/?type=buyer'] } = {}) =>
  `<section class="fcta"><div class="wrap"><p class="eyebrow eyebrow--rev">CONTACT</p><h2 class="h1" data-reveal>${h}</h2><div class="btn-row">${btn(primary[0], primary[1], 'red')}${btn(secondary[0], secondary[1], 'ghost')}</div></div></section>`;
