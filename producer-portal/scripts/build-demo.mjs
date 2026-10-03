// GitHub Pages 用のデモ版を dist-demo/ に書き出す（サーバー不要・ブラウザ内で動作）。
//   BASE_URL=https://example.github.io/repo/producer/  node scripts/build-demo.mjs
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { seed } from '../src/store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-demo');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
fs.copyFileSync(path.join(root, 'demo', 'demo-api.js'), path.join(out, 'demo-api.js'));
// サーバーと共通の計算ロジックを、ブラウザ用の通常スクリプトとして同梱（export 行だけ除去）
fs.writeFileSync(path.join(out, 'logic.js'), fs.readFileSync(path.join(root, 'src', 'logic.mjs'), 'utf8').replace(/^export \{[^}]*\};?\s*$/m, ''));

const db = seed('demo-only-Pass1');
db.producers.forEach((p) => { delete p.pw; });
db.audit = [];
fs.writeFileSync(path.join(out, 'demo-data.json'), JSON.stringify(db));

// 絶対パス（/style.css 等）をサブパスで動く相対パスに直し、デモ用スクリプトとバナーを差し込む
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
  .replace(/(href|src)="\//g, '$1="./')
  .replace('<script src="./app.js" type="module">', '<script src="./logic.js"></script>\n<script src="./demo-api.js"></script>\n<script src="./app.js" type="module">');
fs.writeFileSync(path.join(out, 'index.html'), html);
let js = fs.readFileSync(path.join(out, 'app.js'), 'utf8').replaceAll("'/brand/", "'./brand/");
js = js.replace("      h('p', { class: 'hint' }, 'IDまたはパスワードを", "      h('div', { class: 'okmsg' }, 'デモ版：生産者ID P000123、パスワード demo でログインできます。データはこの端末のブラウザ内だけに保存されます。'),\n      h('p', { class: 'hint' }, 'IDまたはパスワードを");
if (!js.includes('デモ版：')) throw new Error('デモ用バナーの差し込みに失敗');
fs.writeFileSync(path.join(out, 'app.js'), js);
fs.writeFileSync(path.join(out, '.nojekyll'), '');

if (process.env.BASE_URL) {
  await QRCode.toFile(path.join(out, 'qr-producer.png'), process.env.BASE_URL, { width: 480, margin: 2 });
  console.log('QR:', process.env.BASE_URL);
}
console.log('dist-demo/ を作成しました');
