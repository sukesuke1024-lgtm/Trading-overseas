// ページテンプレート。build.mjs から言語ごとに呼び出される。
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  ship: '<path d="M3 15l2 5h14l2-5H3zM6 15V9h12v6M12 9V4M9 6h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  present: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4M7 13l3-3 2 2 5-5"/>',
  doc: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5"/>',
  heart: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/>',
  lang: '<path d="M4 5h9M8.5 3v2M6 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 8M13 21l4-9 4 9M14.5 18h5"/>',
  deal: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  culture: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

const STEP_ICONS = { buyer: ['search', 'globe', 'swap', 'ship'], sales: ['chart', 'present', 'doc', 'heart'] };
const SKILL_ICONS = ['lang', 'deal', 'culture', 'percent'];

// 地球儀 + 航路のイラスト（動画と同じモチーフ。CSSで航路が流れる）
export const globeSvg = () => {
  const routes = [
    ['M300 250 Q 180 120 90 170', 't'], ['M300 250 Q 250 90 150 70', 't'], ['M300 250 Q 360 110 470 120', 'o'],
    ['M300 250 Q 470 200 520 320', 'o'], ['M300 250 Q 380 390 330 470', 'o'], ['M300 250 Q 160 330 110 380', 't'],
  ];
  const meridians = [-60, -30, 0, 30, 60]
    .map((d) => `<ellipse cx="300" cy="300" rx="${Math.abs(Math.cos((d * Math.PI) / 180) * 220).toFixed(1)}" ry="220"/>`)
    .join('');
  const parallels = [-50, -25, 0, 25, 50]
    .map((d) => {
      const y = 300 - Math.sin((d * Math.PI) / 180) * 220;
      const rx = Math.cos((d * Math.PI) / 180) * 220;
      return `<ellipse cx="300" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.18).toFixed(1)}"/>`;
    })
    .join('');
  return `<svg class="globe" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
  <defs><radialGradient id="gb" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#2d5fb8" stop-opacity=".75"/><stop offset="1" stop-color="#0a1f55" stop-opacity=".35"/></radialGradient></defs>
  <circle cx="300" cy="300" r="220" fill="url(#gb)" stroke="rgba(150,195,255,.45)" stroke-width="2"/>
  <g fill="none" stroke="rgba(170,205,255,.22)" stroke-width="1.5" stroke-dasharray="2 6">${meridians}${parallels}</g>
  <g fill="none" stroke-width="3" stroke-linecap="round">${routes
    .map(([d, c], i) => `<path class="route route-${c}" style="--i:${i}" d="${d}"/>`)
    .join('')}</g>
  <g fill="#e6efff">${routes
    .map(([d]) => {
      const m = d.match(/(-?\d+) (-?\d+)$/);
      return `<circle cx="${m[1]}" cy="${m[2]}" r="5"/>`;
    })
    .join('')}</g>
  <circle cx="300" cy="250" r="9" fill="#fff"/><circle class="pulse" cx="300" cy="250" r="9" fill="none" stroke="#fff" stroke-width="2"/>
</svg>`;
};

export function renderPage({ cfg, lang, t, langs, rel, abs, jsonLd, entryHref, companyName }) {
  const hasEntry = Boolean(cfg.entryUrl);
  const entryAttrs = hasEntry && /^https?:/.test(cfg.entryUrl) ? ' target="_blank" rel="noopener"' : '';
  const brand = companyName || t.ui.recruit;
  const logo = cfg.company.logo
    ? `<img src="${rel}${esc(cfg.company.logo)}" alt="${esc(companyName)}" height="32">`
    : `<span class="brand-mark" aria-hidden="true"></span><span>${esc(brand)}</span>`;

  const langSwitch = (short) =>
    langs
      .map((l) => {
        const text = short && l.short ? `<span aria-hidden="true">${esc(l.short)}</span><span class="visually-hidden">${esc(l.label)}</span>` : esc(l.label);
        const cur = l.code === lang.code ? ' aria-current="true"' : '';
        return `<li><a${cur} lang="${l.hreflang}" hreflang="${l.hreflang}" href="${rel}${l.path}">${text}</a></li>`;
      })
      .join('');

  const nav = t.nav.filter(([id]) => id !== 'about').map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('');

  const jobs = t.jobs.items
    .map(
      (j) => `
      <article class="job job-${j.id} reveal" id="job-${j.id}" aria-labelledby="job-${j.id}-title">
        <header class="job-head">
          <span class="job-no" aria-hidden="true">${j.no}</span>
          <div>
            <p class="eyebrow">${esc(j.en)}</p>
            <h3 id="job-${j.id}-title">${esc(j.name)}</h3>
            <p class="job-tagline">${esc(j.tagline)}</p>
          </div>
        </header>
        <p class="job-desc">${esc(j.desc)}</p>
        <ol class="steps">
          ${j.steps
            .map(
              ([title, d], i) => `<li class="step">
            ${icon(STEP_ICONS[j.id][i])}
            <span class="step-no">STEP ${String(i + 1).padStart(2, '0')}</span>
            <h4>${esc(title)}</h4>
            <p>${esc(d)}</p>
          </li>`,
            )
            .join('')}
        </ol>
        <div class="job-foot">
          <blockquote class="reward"><p class="label">${esc(t.jobs.rewardLabel)}</p><p>${esc(j.reward)}</p></blockquote>
          <div class="fit"><p class="label">${esc(t.jobs.fitLabel)}</p><ul>${j.fit
            .map((f) => `<li>${icon('check')}${esc(f)}</li>`)
            .join('')}</ul></div>
        </div>
      </article>`,
    )
    .join('');

  const day = t.day.items
    .map(
      ([time, title, d]) => `<li class="reveal"><time>${esc(time)}</time><div><h3>${esc(title)}</h3><p>${esc(d)}</p></div></li>`,
    )
    .join('');

  const skills = t.skills.items
    .map(
      ([title, d], i) => `<li class="skill reveal">${icon(SKILL_ICONS[i], 'icon skill-icon')}<div><h3>${esc(title)}</h3><p>${esc(d)}</p></div></li>`,
    )
    .join('');

  const reqRows = t.requirements.rows
    .map((r) => `<div class="req-row"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`)
    .join('');

  const flow = t.flow.steps.map((s, i) => `<li><span class="flow-no">${i + 1}</span>${esc(s)}</li>`).join('');

  const faq = t.faq.items
    .map(
      (f, i) => `<details class="faq-item reveal"${i === 0 ? ' open' : ''}>
        <summary><h3>${esc(f.q)}</h3></summary>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </details>`,
    )
    .join('');

  const transcript = t.captions.map(([s, , text]) => {
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `<li><time>${m}:${sec}</time> ${esc(text)}</li>`;
  }).join('');

  const tracks = langs
    .map(
      (l) =>
        `<track kind="captions" src="${rel}assets/video/captions-${l.code}.vtt" srclang="${l.hreflang}" label="${esc(l.label)}"${l.code === lang.code && lang.code !== 'ja' ? ' default' : ''}>`,
    )
    .join('');

  const entryButton = (cls, label) =>
    hasEntry
      ? `<a class="${cls}" href="${esc(entryHref)}"${entryAttrs}>${esc(label)}${icon('arrow')}</a>`
      : `<a class="${cls}" href="#entry">${esc(label)}${icon('arrow')}</a>`;

  const alternates = langs
    .map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${abs(l.path)}">`)
    .concat([`<link rel="alternate" hreflang="x-default" href="${abs('')}">`])
    .join('\n  ');

  const ogAlternates = langs
    .filter((l) => l.code !== lang.code)
    .map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="${lang.hreflang}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(t.meta.title)}${companyName ? ` | ${esc(companyName)}` : ''}</title>
  <meta name="description" content="${esc(t.meta.description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${abs(lang.path)}">
  ${alternates}
  <meta name="theme-color" content="#07142e">
  <meta name="color-scheme" content="light">
  <meta name="format-detection" content="telephone=no">
  <link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${rel}favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="${rel}apple-touch-icon.png">
  <link rel="manifest" href="${rel}manifest.webmanifest">
  <link rel="sitemap" type="application/xml" href="${rel}sitemap.xml">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(companyName || t.meta.siteName)}">
  <meta property="og:title" content="${esc(t.meta.title)}">
  <meta property="og:description" content="${esc(t.meta.description)}">
  <meta property="og:url" content="${abs(lang.path)}">
  <meta property="og:image" content="${abs(`assets/og/og-${lang.code}.png`)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
  <meta property="og:locale" content="${lang.ogLocale}">
  ${ogAlternates}
  <meta property="og:video" content="${abs(cfg.video.file)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1920">
  <meta property="og:video:height" content="1080">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(t.meta.title)}">
  <meta name="twitter:description" content="${esc(t.meta.description)}">
  <meta name="twitter:image" content="${abs(`assets/og/og-${lang.code}.png`)}">
  <meta name="twitter:image:alt" content="${esc(t.meta.ogAlt)}">

  <link rel="preload" href="${rel}assets/css/style.css" as="style">
  <link rel="stylesheet" href="${rel}assets/css/style.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body class="lang-${lang.code}">
  <a class="skip-link" href="#main">${esc(t.ui.skip)}</a>

  <header class="site-header" id="top">
    <div class="container header-inner">
      <a class="brand" href="${rel}${lang.path}">${logo}</a>
      <nav class="global-nav" id="global-nav" aria-label="${esc(t.ui.menu)}">
        <ul class="nav-list">${nav}</ul>
        <ul class="lang-list" aria-label="${esc(t.ui.language)}">${langSwitch(true)}</ul>
      </nav>
      <div class="header-actions">
        ${entryButton('btn btn-primary btn-sm header-entry', t.ui.entry)}
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="global-nav">
          <span class="menu-open">${icon('menu')}</span><span class="menu-close">${icon('close')}</span>
          <span class="visually-hidden">${esc(t.ui.menu)}</span>
        </button>
      </div>
    </div>
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow eyebrow-light">${esc(t.hero.kicker)}</p>
          <h1 id="hero-title"><span class="hero-sub">${esc(t.hero.sub)}</span><span class="hero-main">${t.hero.h1
            .map((l) => `<span>${esc(l)}</span>`)
            .join('')}</span></h1>
          <p class="hero-lead">${esc(t.hero.lead)}</p>
          <div class="hero-cta">
            ${entryButton('btn btn-primary', t.ui.entryNow)}
            <a class="btn btn-ghost" href="#video">${icon('play')}${esc(t.ui.watch)}</a>
          </div>
          <ul class="hero-badges">${t.hero.badges.map((b) => `<li>${icon('check')}${esc(b)}</li>`).join('')}</ul>
        </div>
        <div class="hero-visual">${globeSvg()}</div>
      </div>
    </section>

    <section class="section" id="about" aria-labelledby="about-title">
      <div class="container">
        <h2 id="about-title" class="section-title">${esc(t.about.heading)}</h2>
        <p class="section-lead">${esc(t.about.lead)}</p>
        <dl class="definitions">
          ${t.about.items
            .map(
              (d, i) => `<div class="definition def-${i === 0 ? 'buyer' : 'sales'} reveal"><dt>${esc(d.term)}</dt><dd>${esc(d.def)}</dd></div>`,
            )
            .join('')}
        </dl>
      </div>
    </section>

    <section class="section section-dark" id="video" aria-labelledby="video-title">
      <div class="container">
        <h2 id="video-title" class="section-title">${esc(t.video.heading)}</h2>
        <p class="section-lead">${esc(t.video.lead)}</p>
        <figure class="video-wrap reveal">
          <video controls playsinline preload="none" poster="${rel}${cfg.video.poster}" width="1920" height="1080" aria-describedby="video-desc">
            <source src="${rel}${cfg.video.file}" type="video/mp4">
            ${tracks}
            <p>${esc(t.ui.videoFallback)}</p>
          </video>
          <figcaption id="video-desc" class="visually-hidden">${esc(t.video.description)}</figcaption>
        </figure>
        <details class="transcript">
          <summary>${esc(t.ui.transcript)}</summary>
          <ol>${transcript}</ol>
        </details>
      </div>
    </section>

    <section class="section" id="jobs" aria-labelledby="jobs-title">
      <div class="container">
        <h2 id="jobs-title" class="section-title">${esc(t.jobs.heading)}</h2>
        <div class="jobs">${jobs}</div>
      </div>
    </section>

    <section class="section section-tint" id="day" aria-labelledby="day-title">
      <div class="container narrow">
        <h2 id="day-title" class="section-title">${esc(t.day.heading)}</h2>
        <p class="section-lead">${esc(t.day.lead)}</p>
        <ol class="timeline">${day}</ol>
        <p class="note">${esc(t.day.note)}</p>
      </div>
    </section>

    <section class="section" id="skills" aria-labelledby="skills-title">
      <div class="container">
        <h2 id="skills-title" class="section-title">${esc(t.skills.heading)}</h2>
        <ul class="skills">${skills}</ul>
        <p class="skills-note reveal">${esc(t.skills.note)}</p>
      </div>
    </section>

    <section class="section section-tint" id="requirements" aria-labelledby="req-title">
      <div class="container narrow">
        <h2 id="req-title" class="section-title">${esc(t.requirements.heading)}</h2>
        <dl class="req">${reqRows}</dl>
        <h3 class="flow-title">${esc(t.flow.heading)}</h3>
        <ol class="flow">${flow}</ol>
        <p class="note">${esc(t.flow.note)}</p>
      </div>
    </section>

    <section class="section" id="faq" aria-labelledby="faq-title">
      <div class="container narrow">
        <h2 id="faq-title" class="section-title">${esc(t.faq.heading)}</h2>
        <div class="faq">${faq}</div>
      </div>
    </section>

    <section class="cta" id="entry" aria-labelledby="entry-title">
      <div class="container cta-inner">
        <h2 id="entry-title">${esc(t.cta.heading)}</h2>
        <p>${esc(t.cta.lead)}</p>
        ${
          hasEntry
            ? `<a class="btn btn-primary btn-lg" href="${esc(entryHref)}"${entryAttrs}>${esc(t.ui.entryNow)}${icon('arrow')}</a>`
            : `<p class="entry-pending" role="status">${esc(t.ui.entryPending)}</p>`
        }
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p class="brand brand-footer">${logo}</p>
      <ul class="footer-links">
        ${cfg.company.url ? `<li><a href="${esc(cfg.company.url)}" rel="noopener">${esc(t.ui.companySite)}</a></li>` : ''}
        ${cfg.privacyUrl ? `<li><a href="${esc(cfg.privacyUrl)}">${esc(t.ui.privacy)}</a></li>` : ''}
        <li><a href="#top">${esc(t.ui.backToTop)}</a></li>
      </ul>
      <ul class="lang-list lang-list-footer" aria-label="${esc(t.ui.language)}">${langSwitch(false)}</ul>
      <p class="updated">${esc(t.ui.updated)}: <time datetime="${cfg.dateModified}">${cfg.dateModified}</time></p>
      <p class="copyright"><small>&copy; ${cfg.dateModified.slice(0, 4)} ${esc(companyName || t.meta.siteName)}</small></p>
    </div>
  </footer>

  <div class="sticky-entry">${entryButton('btn btn-primary', t.ui.entryNow)}</div>
  <script src="${rel}assets/js/main.js" defer></script>
</body>
</html>
`;
}
