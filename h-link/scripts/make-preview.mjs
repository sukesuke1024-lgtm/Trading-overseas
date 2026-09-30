// dist/ の全ページを1枚のHTMLにまとめたプレビューを作る（Artifact等で共有する用）。
//   node scripts/make-preview.mjs <出力先.html>
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const out = process.argv[2] || join(dist, 'preview.html');
const css = readFileSync(join(dist, 'css/style.css'), 'utf8');
const js = readFileSync(join(dist, 'js/main.js'), 'utf8');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const bridge = `<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');
if(h&&h.charAt(0)==='/'&&h.charAt(1)!=='/'){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({go:h},'*');}},true);
addEventListener('load',function(){if(window.__hash){var t=document.getElementById(window.__hash);if(t)t.scrollIntoView();}});
<\/script>`;
const pages = {};
for (const f of walk(dist).filter((x) => x.endsWith('.html') && !x.endsWith('preview.html') && !x.endsWith('404.html'))) {
  let p = f.replace(dist, '').replace(/index\.html$/, '');
  let h = readFileSync(f, 'utf8')
    .replace(/<link rel="stylesheet" href="\/css\/style\.css">/, () => `<style>${css}</style>`)
    .replace(/<script src="\/js\/main\.js" defer><\/script>/, () => `${bridge}<script>${js.replace(/<\/script/g, '<\\/script')}<\/script>`);
  pages[p] = h;
}
const labels = { '/': 'HOME', '/business/': 'BUSINESS', '/producers/': 'PRODUCERS', '/buyers/': 'BUYERS', '/selection/': 'H-LINK SELECTION', '/sustainability/': 'SUSTAINABILITY', '/about/': 'ABOUT', '/news/': 'NEWS', '/contact/': 'CONTACT', '/privacy/': 'Privacy', '/terms/': 'Terms', '/en/': 'EN' };
const opts = Object.keys(pages).map((p) => `<option value="${p}">${labels[p] || p.replace('/news/', 'NEWS › ')}</option>`).join('');
const data = JSON.stringify(pages).replace(/<\//g, '<\\/');
writeFileSync(out, `<title>H-LINK 公式サイト</title>
<style>
:root{--bg:#f5f3ef;--fg:#111;--line:#dad5cb;--red:#d71920}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1a1a1a;--fg:#f2f0ea;--line:#3a3a3a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1a1a1a;--fg:#f2f0ea;--line:#3a3a3a;color-scheme:dark}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--fg);display:flex;flex-direction:column;font-family:system-ui,sans-serif}
.bar{display:flex;gap:12px;align-items:center;padding:6px 16px;border-bottom:1px solid var(--line);font-size:12px;flex:none;flex-wrap:wrap}
.bar b{letter-spacing:.14em;color:var(--red)}
.bar select{font:inherit;padding:4px 8px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:3px;max-width:100%}
.bar span{opacity:.7}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
iframe{flex:1;min-height:0;width:100%;border:0;background:#fff}
</style>
<div class="bar"><b>PREVIEW</b><label for="pg" class="sr">ページ</label><select id="pg">${opts}</select><span>画像は差し替え用のプレースホルダーです。フォームは送信されません。</span></div>
<iframe id="fr" title="H-LINK 公式サイトのプレビュー" sandbox="allow-scripts"></iframe>
<script>
var PAGES=${data};
var fr=document.getElementById('fr'),sel=document.getElementById('pg');
function go(u){var m=u.match(/^([^?#]*)(\\?[^#]*)?(#.*)?$/),p=m[1],q=m[2]||'',hs=(m[3]||'').slice(1);
if(!PAGES[p])p='/';sel.value=p;
var pre='<script>window.__query='+JSON.stringify(q)+';window.__hash='+JSON.stringify(hs)+';<\\/script>';
fr.srcdoc=PAGES[p].replace('<head>','<head>'+pre);}
addEventListener('message',function(e){if(e.source===fr.contentWindow&&e.data&&e.data.go)go(e.data.go)});
sel.addEventListener('change',function(){go(sel.value)});
go('/');
</script>
`);
console.log('preview →', out, (readFileSync(out).length / 1024).toFixed(0) + 'KB');
