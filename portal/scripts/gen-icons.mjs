// Webアプリのアイコンを自動生成する（PWA / ホーム画面 / ブラウザタブ用）。
// マークのデザインは下の SVG だけを編集すれば、全サイズが再生成される。  実行: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "icons");
await mkdir(out, { recursive: true });

// scale: マークの大きさ（maskable は端末側で角が切り取られるため小さめ＝セーフゾーン内に収める）
const svg = ({ scale = 1, radius = 7 }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14559a"/><stop offset="1" stop-color="#0b3d6e"/></linearGradient>
  </defs>
  <rect width="32" height="32" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(16 16) scale(${scale}) translate(-16 -16)">
    <path d="M8 23V9l8 9 8-9v14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="24" cy="8" r="2" fill="#7cc4ff"/>
  </g>
</svg>`;

const jobs = [
  ["icon-192.png", 192, svg({})],
  ["icon-512.png", 512, svg({})],
  ["apple-touch-icon.png", 180, svg({ radius: 0 })], // iOS が角丸を自動で付ける
  ["icon-maskable-512.png", 512, svg({ scale: 0.78, radius: 0 })],
  ["favicon-32.png", 32, svg({})],
];
for (const [name, size, s] of jobs) await sharp(Buffer.from(s)).resize(size, size).png().toFile(path.join(out, name));
await writeFile(path.join(root, "src/app/icon.svg"), svg({}).trim().replace(/ width="512" height="512"/, "") + "\n");
console.log(`icons: ${jobs.map((j) => j[0]).join(", ")}`);
