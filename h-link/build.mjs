import { mkdirSync, rmSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from './content/site.mjs';
import { stories } from './content/stories.mjs';
import * as P from './src/pages.mjs';
import { abs } from './src/util.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
if (existsSync(join(root, 'static'))) cpSync(join(root, 'static'), dist, { recursive: true });

const pages = [
  ['/', P.home()], ['/business/', P.business()], ['/producers/', P.producers()], ['/buyers/', P.buyers()],
  ['/selection/', P.selection()], ['/sustainability/', P.sustainability()], ['/about/', P.about()],
  ['/news/', P.news()], ['/contact/', P.contact()], ['/privacy/', P.privacy()], ['/terms/', P.terms()], ['/en/', P.english()],
  ...stories.map((s) => [`/news/${s.slug}/`, P.article(s)])
];
const write = (rel, html) => {
  const f = join(dist, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
};
for (const [path, html] of pages) write(path === '/' ? 'index.html' : `${path.slice(1)}index.html`, html);
write('404.html', P.notFound());

const indexable = pages.filter(([p]) => !['/privacy/', '/terms/'].includes(p) && !p.startsWith('/news/') || p === '/news/');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(([p]) => `  <url><loc>${abs(p)}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
console.log(`Built ${pages.length + 1} pages → dist/ (site: ${site.url}${site.basePath})`);
