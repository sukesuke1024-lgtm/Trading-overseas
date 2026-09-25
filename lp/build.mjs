// 採用LPのビルド: node build.mjs → dist/
//   --check  公開前に埋めるべき未設定項目を一覧表示（ビルドはしない）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from './site.config.mjs';
import { renderPage } from './src/template.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const VIDEO_SRC = path.join(ROOT, '..', 'recruit-video', 'out');

const content = {};
for (const l of cfg.languages) content[l.code] = (await import(`./src/content/${l.code}.mjs`)).default;

const base = cfg.siteUrl.endsWith('/') ? cfg.siteUrl : cfg.siteUrl + '/';
const abs = (p = '') => new URL(p, base).href;

// ---------------------------------------------------------------- check
function collectTodos() {
  const todos = [];
  const names = cfg.company.name;
  for (const l of cfg.languages) if (!names[l.code]) todos.push(`site.config.mjs: company.name.${l.code}（会社名）`);
  if (!cfg.company.url) todos.push('site.config.mjs: company.url（企業サイトURL）');
  if (!cfg.entryUrl) todos.push('site.config.mjs: entryUrl（応募フォームのURL）— 未設定の間は「準備中」表示');
  if (!cfg.privacyUrl) todos.push('site.config.mjs: privacyUrl（プライバシーポリシーURL）');
  if (!cfg.jobPosting.enabled) todos.push('site.config.mjs: jobPosting（Google しごと検索用の構造化データ。住所を入れて enabled: true）');
  for (const l of cfg.languages) {
    for (const r of content[l.code].requirements.rows) if (r.todo) todos.push(`src/content/${l.code}.mjs: 募集要項「${r.label}」= ${r.value}`);
  }
  return todos;
}

if (process.argv.includes('--check')) {
  const todos = collectTodos();
  if (!todos.length) console.log('✔ 未設定の項目はありません。公開できます。');
  else {
    console.log(`公開前に確認・設定が必要な項目（${todos.length}件）:\n`);
    todos.forEach((x) => console.log('  - ' + x));
  }
  process.exit(0);
}

// ---------------------------------------------------------------- helpers
const write = (rel, data) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(DIST, to), { recursive: true });
};
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const vttTime = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = (s % 60).toFixed(3).padStart(6, '0');
  return `${h}:${m}:${sec}`;
};

// ---------------------------------------------------------------- structured data
function buildJsonLd(lang, t, companyName) {
  const url = abs(lang.path);
  const org = companyName
    ? {
        '@type': 'Organization',
        '@id': abs('#organization'),
        name: companyName,
        ...(cfg.company.url && { url: cfg.company.url }),
        ...(cfg.company.logo && { logo: abs(cfg.company.logo) }),
      }
    : null;

  const graph = [
    {
      '@type': 'WebSite',
      '@id': abs('#website'),
      url: base,
      name: t.meta.siteName,
      inLanguage: cfg.languages.map((l) => l.hreflang),
      ...(org && { publisher: { '@id': org['@id'] } }),
    },
    {
      '@type': 'WebPage',
      '@id': url + '#webpage',
      url,
      name: t.meta.title,
      description: t.meta.description,
      inLanguage: lang.hreflang,
      isPartOf: { '@id': abs('#website') },
      datePublished: cfg.video.uploadDate,
      dateModified: cfg.dateModified,
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(`assets/og/og-${lang.code}.png`), width: 1200, height: 630 },
      about: t.jobs.items.map((j) => ({ '@id': url + '#occupation-' + j.id })),
      video: { '@id': url + '#video' },
      mainEntity: { '@id': url + '#faq' },
      breadcrumb: { '@id': url + '#breadcrumb' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': url + '#breadcrumb',
      itemListElement: [
        cfg.company.url
          ? { '@type': 'ListItem', position: 1, name: companyName || t.meta.breadcrumbHome, item: cfg.company.url }
          : { '@type': 'ListItem', position: 1, name: t.meta.breadcrumbHome, item: abs('') },
        { '@type': 'ListItem', position: 2, name: t.meta.breadcrumb, item: url },
      ],
    },
    ...t.jobs.items.map((j, i) => ({
      '@type': 'Occupation',
      '@id': url + '#occupation-' + j.id,
      name: j.name,
      alternateName: j.en.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()),
      description: t.about.items[i].def,
      responsibilities: j.steps.map(([a, b]) => `${a}: ${b}`),
      skills: t.skills.items.map(([a]) => a),
    })),
    {
      '@type': 'VideoObject',
      '@id': url + '#video',
      name: t.video.title,
      description: t.video.description,
      thumbnailUrl: [abs(cfg.video.poster), abs(`assets/og/og-${lang.code}.png`)],
      uploadDate: cfg.video.uploadDate,
      duration: cfg.video.duration,
      contentUrl: abs(cfg.video.file),
      inLanguage: 'ja',
      transcript: t.captions.map(([, , text]) => text).join('\n'),
      ...(org && { publisher: { '@id': org['@id'] } }),
    },
    {
      '@type': 'FAQPage',
      '@id': url + '#faq',
      inLanguage: lang.hreflang,
      mainEntity: t.faq.items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  if (org) graph.push(org);

  const jp = cfg.jobPosting;
  if (jp.enabled && org && jp.address.addressLocality) {
    for (const j of t.jobs.items) {
      graph.push({
        '@type': 'JobPosting',
        '@id': url + '#job-' + j.id,
        title: j.name,
        description: `<p>${j.desc}</p><ul>${j.steps.map(([a, b]) => `<li>${a}: ${b}</li>`).join('')}</ul>`,
        datePosted: jp.datePosted,
        ...(jp.validThrough && { validThrough: jp.validThrough }),
        employmentType: jp.employmentType,
        hiringOrganization: { '@id': org['@id'], name: companyName, ...(cfg.company.url && { sameAs: cfg.company.url }) },
        jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...jp.address } },
        occupationalCategory: j.name,
        directApply: Boolean(cfg.entryUrl),
        ...(jp.salary && {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'JPY',
            value: { '@type': 'QuantitativeValue', minValue: jp.salary.min, maxValue: jp.salary.max, unitText: jp.salary.unit },
          },
        }),
        url: url + '#job-' + j.id,
      });
    }
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---------------------------------------------------------------- build
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'src', 'assets'), 'assets');
copyDir(path.join(ROOT, 'static'), '.');

// Video + poster from the recruit-video project
for (const [from, to] of [
  ['overseas-buyer-sales-recruit-90s.mp4', cfg.video.file],
  ['poster.jpg', cfg.video.poster],
]) {
  const src = path.join(VIDEO_SRC, from);
  if (!fs.existsSync(src)) throw new Error(`動画ファイルが見つかりません: ${src}`);
  fs.mkdirSync(path.dirname(path.join(DIST, to)), { recursive: true });
  fs.copyFileSync(src, path.join(DIST, to));
}

for (const lang of cfg.languages) {
  const t = content[lang.code];
  const companyName = cfg.company.name[lang.code] || cfg.company.name[cfg.defaultLanguage] || '';
  const rel = lang.path ? '../'.repeat(lang.path.split('/').filter(Boolean).length) : '';

  // captions
  const vtt = ['WEBVTT', '']
    .concat(t.captions.flatMap(([s, e, text], i) => [String(i + 1), `${vttTime(s)} --> ${vttTime(e)}`, text, '']))
    .join('\n');
  write(`assets/video/captions-${lang.code}.vtt`, vtt);

  const html = renderPage({
    cfg,
    lang,
    t,
    langs: cfg.languages,
    rel,
    abs,
    jsonLd: buildJsonLd(lang, t, companyName),
    entryHref: cfg.entryUrl,
    companyName,
  });
  write(`${lang.path}index.html`, html);
}

// sitemap.xml (hreflang alternates + video extension)
const ja = content[cfg.defaultLanguage];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${cfg.languages
  .map((l) => {
    const t = content[l.code];
    return `  <url>
    <loc>${abs(l.path)}</loc>
    <lastmod>${cfg.dateModified}</lastmod>
${cfg.languages.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${abs(a.path)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs('')}"/>
    <video:video>
      <video:thumbnail_loc>${abs(cfg.video.poster)}</video:thumbnail_loc>
      <video:title>${xml(t.video.title)}</video:title>
      <video:description>${xml(t.video.description)}</video:description>
      <video:content_loc>${abs(cfg.video.file)}</video:content_loc>
      <video:duration>90</video:duration>
      <video:publication_date>${cfg.video.uploadDate}</video:publication_date>
    </video:video>
  </url>`;
  })
  .join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

// robots.txt — search engines and AI crawlers are explicitly welcome
const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];
write(
  'robots.txt',
  `# Search engines and AI assistants are welcome to read and cite this site.
User-agent: *
Allow: /

${aiBots.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}

Sitemap: ${abs('sitemap.xml')}
`,
);

// llms.txt — concise, citable summary for AI assistants (AIO)
const en = content.en;
const companyLine = cfg.company.name.ja ? `\n採用企業: ${cfg.company.name.ja}${cfg.company.name.en ? ` (${cfg.company.name.en})` : ''}` : '';
write(
  'llms.txt',
  `# ${ja.meta.siteName} / ${en.meta.siteName}

> ${ja.meta.description}
> ${en.meta.description}
${companyLine}
最終更新 / Last updated: ${cfg.dateModified}

## ページ / Pages
${cfg.languages.map((l) => `- [${content[l.code].meta.title}](${abs(l.path)}): ${l.label}`).join('\n')}

## 職種の定義 / Role definitions
${ja.about.items.map((d) => `- **${d.term}**: ${d.def}`).join('\n')}
${en.about.items.map((d) => `- **${d.term}**: ${d.def}`).join('\n')}

## 仕事の流れ / Workflow
${ja.jobs.items.map((j) => `- ${j.name}: ${j.steps.map(([a]) => a).join(' → ')}`).join('\n')}
${en.jobs.items.map((j) => `- ${j.name}: ${j.steps.map(([a]) => a).join(' → ')}`).join('\n')}

## 身につくスキル / Skills
${ja.skills.items.map(([a, b]) => `- ${a}: ${b}`).join('\n')}

## よくある質問 / FAQ
${ja.faq.items.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join('\n')}

## 動画 / Video
- [${ja.video.title}](${abs(cfg.video.file)}) (90 sec, captions: ${cfg.languages.map((l) => `[${l.label}](${abs(`assets/video/captions-${l.code}.vtt`)})`).join(', ')})
`,
);

// Web app manifest
write(
  'manifest.webmanifest',
  JSON.stringify(
    {
      name: ja.meta.siteName,
      short_name: 'RECRUIT',
      start_url: './',
      scope: './',
      display: 'browser',
      background_color: '#07142e',
      theme_color: '#07142e',
      lang: 'ja',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  ),
);

// 404 page (noindex)
write(
  '404.html',
  `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 | ${xml(ja.meta.siteName)}</title><meta name="robots" content="noindex">
<link rel="icon" href="${new URL(base).pathname}favicon.svg" type="image/svg+xml">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07142e;color:#f4f7ff;font-family:system-ui,sans-serif;text-align:center;padding:16px}a{color:#36d6c8;display:inline-block;margin:6px 10px;font-weight:700}h1{font-size:3rem;margin:0 0 8px}</style>
</head><body><main><h1>404</h1><p>ページが見つかりませんでした。 / Page not found. / 页面未找到。</p>
<p>${cfg.languages.map((l) => `<a href="${abs(l.path)}" lang="${l.hreflang}">${xml(l.label)}</a>`).join('')}</p></main></body></html>
`,
);

write('.nojekyll', '');
if (process.env.CNAME) write('CNAME', process.env.CNAME + '\n');

const todos = collectTodos();
console.log(`✔ built ${cfg.languages.length} languages → ${path.relative(process.cwd(), DIST) || 'dist'} (${base})`);
if (todos.length) console.log(`  ※ 公開前に確認が必要な項目が ${todos.length} 件あります（npm run check で一覧表示）`);
