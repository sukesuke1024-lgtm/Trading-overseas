// H-LINK のアプリアイコン一式（角丸の白地に H ロゴ）を、ロゴ素材 brand/src/mark.png から生成する。
//   npm run icons  →  portal/public/icons, crm/public/icons, 各アプリの public/brand/H-LINK-icons.zip（ダウンロード用）
import sharp from "sharp";
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const crmRoot = path.join(root, "..", "crm");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// ロゴ（透明背景の H）。余白を詰める
const mark = await sharp(path.join(root, "brand/src/mark.png")).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();

/** size 四方。rounded=角丸(透明の角)。fill=ロゴが占める幅の割合 */
async function icon(size, { rounded = true, fill = 0.8, border = true } = {}) {
  const w = Math.round(size * fill);
  const logo = await sharp(mark).resize({ width: w }).png().toBuffer();
  const r = Math.round(size * 0.224);
  const base = rounded
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"${border ? ` stroke="#d9d9d9" stroke-width="${Math.max(1, size / 128)}"` : ""}/></svg>`)
    : null;
  const bg = base ? sharp(base) : sharp({ create: { width: size, height: size, channels: 4, background: WHITE } });
  return bg.composite([{ input: logo, gravity: "center" }]).png().toBuffer();
}

const sizes = {
  "app-icon-1024.png": await icon(1024),
  "icon-512.png": await icon(512),
  "icon-192.png": await icon(192),
  "icon-maskable-512.png": await icon(512, { rounded: false, fill: 0.56 }), // 端末が角を切り取っても欠けない余白つき
  "apple-touch-icon.png": await icon(180, { rounded: false, fill: 0.74 }), // iOS が角丸を付ける
  "favicon-16.png": await icon(16, { fill: 0.9 }),
  "favicon-32.png": await icon(32, { fill: 0.9 }),
  "favicon-48.png": await icon(48, { fill: 0.9 }),
};

// favicon.ico（16/32/48 の PNG を格納）
function ico(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = 6 + 16 * pngs.length; const dir = [];
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16); e[0] = size; e[1] = size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(off, 12);
    dir.push(e); off += buf.length;
  }
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.buf)]);
}
const icoBuf = ico([16, 32, 48].map((s) => ({ size: s, buf: sizes[`favicon-${s}.png`] })));

// ブラウザタブの見本
const tabSvg = (logoB64) => `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120"><rect width="720" height="120" fill="#e8eaed"/><path d="M20 120V44q0-14 14-14h300q14 0 14 14v76z" fill="#fff"/><image href="data:image/png;base64,${logoB64}" x="44" y="46" width="32" height="32"/><text x="92" y="68" font-family="sans-serif" font-size="20" fill="#202124">H-LINK ｜ つなぐ、越える、</text><text x="318" y="68" font-size="20" fill="#5f6368" font-family="sans-serif">×</text></svg>`;
const tab = await sharp(Buffer.from(tabSvg(sizes["favicon-32.png"].toString("base64")))).png().toBuffer();

for (const app of [path.join(root, "public"), path.join(crmRoot, "public")]) {
  const icons = path.join(app, "icons"), brand = path.join(app, "brand"), tmp = path.join(app, "brand", "_zip");
  await mkdir(icons, { recursive: true }); await mkdir(tmp, { recursive: true });
  for (const [name, buf] of Object.entries(sizes)) { await writeFile(path.join(tmp, name), buf); if (!name.startsWith("app-icon")) await writeFile(path.join(icons, name), buf); }
  await writeFile(path.join(tmp, "favicon.ico"), icoBuf); await writeFile(path.join(icons, "favicon.ico"), icoBuf);
  await writeFile(path.join(tmp, "browser-tab-sample.png"), tab);
  await sharp(mark).resize({ width: 1200 }).png().toFile(path.join(tmp, "logo-mark-transparent.png"));
  await writeFile(path.join(tmp, "README.txt"), "H-LINK アイコン\napp-icon-1024.png … アプリアイコン (1024x1024)\nicon-512/192.png … PWA・ホーム画面\nicon-maskable-512.png … Android 用（全面の白地）\napple-touch-icon.png … iOS ホーム画面\nfavicon.ico / favicon-16,32,48.png … ブラウザのタブ\nbrowser-tab-sample.png … タブ表示の見本\nlogo-mark-transparent.png … 透明背景のロゴ\n");
  const zip = path.join(brand, "H-LINK-icons.zip"); await rm(zip, { force: true });
  execFileSync("zip", ["-j", "-q", zip, ...(await import("node:fs")).readdirSync(tmp).map((f) => path.join(tmp, f))]);
  await copyFile(path.join(tmp, "app-icon-1024.png"), path.join(brand, "app-icon-1024.png"));
  await rm(tmp, { recursive: true });
}
console.log("icons generated");
