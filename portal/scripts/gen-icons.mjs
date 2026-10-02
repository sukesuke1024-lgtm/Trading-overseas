// H-LINK のアプリアイコン一式を、ロゴ原本 brand/src/mark.png から生成する（全端末・ポータルと CRM で同一）。
//   npm run icons  →  portal/public と crm/public の icons/・brand/ に同じファイルを書き出す
// ロゴは加工しません（拡大縮小・白地への配置のみ。描き直し・変形・シャープ処理はしない）。
import sharp from "sharp";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [path.join(root, "public"), path.join(root, "..", "crm", "public")]; // 同期先（常に同一内容）
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// ロゴ原本（透明背景）。余白だけを詰める
const mark = await sharp(path.join(root, "brand/src/mark.png")).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();

/** size 四方の白地にロゴを中央配置。shape: "square"=全面白（iOS・ストア・maskable）/ "rounded"=角丸 */
async function tile(size, { shape = "rounded", fill = 0.8, border = true } = {}) {
  const logo = await sharp(mark).resize({ width: Math.round(size * fill), kernel: "lanczos3" }).png().toBuffer();
  const r = Math.round(size * 0.224);
  const bg = shape === "rounded"
    ? sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${r}" fill="#fff"${border && size >= 64 ? ` stroke="#d9d9d9" stroke-width="${Math.max(1, size / 256)}"` : ""}/></svg>`))
    : sharp({ create: { width: size, height: size, channels: 4, background: WHITE } });
  return bg.composite([{ input: logo, gravity: "center" }]).png().toBuffer();
}
/** ロゴの形をそのまま保つため、ファビコンはロゴを大きめ（幅の92%）に置く */
const fav = (s) => tile(s, { fill: 0.92 });

const out = {}; // ファイル名 → Buffer
out["app-icon-1024.png"] = await tile(1024, { shape: "square", fill: 0.78 });          // ストア提出・Mac/iOS/Android の原版（OS が角丸を付ける）
out["app-icon-1024-rounded.png"] = await tile(1024);                                    // 角丸つき（見せる用）
out["icon-512.png"] = await tile(512); out["icon-192.png"] = await tile(192);           // PWA（Android・Windows・Mac のインストール）
out["icon-maskable-512.png"] = await tile(512, { shape: "square", fill: 0.56 });        // Android の丸/しずく型に切られても欠けない
out["apple-touch-icon.png"] = await tile(180, { shape: "square", fill: 0.74 });         // iPhone / iPad のホーム画面
for (const s of [16, 32, 48]) out[`favicon-${s}.png`] = await fav(s);
for (const s of [150, 310]) out[`windows-tile-${s}.png`] = await tile(s, { shape: "square", fill: 0.7 }); // Windows スタートのタイル
out["logo-mark-transparent.png"] = await sharp(mark).resize({ width: 1200 }).png().toBuffer();

// favicon.ico / Windows 用 .ico（PNG 格納の複数サイズ）
function ico(list) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(list.length, 4);
  let off = 6 + 16 * list.length; const dir = [];
  for (const { size, buf } of list) {
    const e = Buffer.alloc(16); e[0] = size >= 256 ? 0 : size; e[1] = size >= 256 ? 0 : size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(off, 12);
    dir.push(e); off += buf.length;
  }
  return Buffer.concat([head, ...dir, ...list.map((p) => p.buf)]);
}
out["favicon.ico"] = ico([16, 32, 48].map((s) => ({ size: s, buf: out[`favicon-${s}.png`] })));
const winSizes = [16, 24, 32, 48, 64, 128, 256];
out["H-LINK-windows.ico"] = ico(await Promise.all(winSizes.map(async (s) => ({ size: s, buf: await tile(s, { fill: 0.92 }) }))));

// Mac 用 .icns（PNG 格納）
function icns(parts) {
  const chunks = parts.map(([type, buf]) => { const h = Buffer.alloc(8); h.write(type, 0, "ascii"); h.writeUInt32BE(buf.length + 8, 4); return Buffer.concat([h, buf]); });
  const total = 8 + chunks.reduce((n, c) => n + c.length, 0);
  const h = Buffer.alloc(8); h.write("icns", 0, "ascii"); h.writeUInt32BE(total, 4);
  return Buffer.concat([h, ...chunks]);
}
out["H-LINK-mac.icns"] = icns([["icp4", await tile(16, { fill: 0.92 })], ["icp5", await tile(32, { fill: 0.92 })], ["icp6", await tile(64)], ["ic07", await tile(128)], ["ic08", await tile(256)], ["ic09", out["icon-512.png"]], ["ic10", await tile(1024)]]);

// ブラウザタブの見本
const tabSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120"><rect width="720" height="120" fill="#e8eaed"/><path d="M20 120V44q0-14 14-14h300q14 0 14 14v76z" fill="#fff"/><image href="data:image/png;base64,${out["favicon-32.png"].toString("base64")}" x="44" y="46" width="32" height="32"/><text x="92" y="68" font-family="sans-serif" font-size="20" fill="#202124">H-LINK ｜ つなぐ、越える、</text></svg>`;
out["browser-tab-sample.png"] = await sharp(Buffer.from(tabSvg)).png().toBuffer();
const readme = "H-LINK アイコン一式（ロゴは加工していません）\n\n[Mac] H-LINK-mac.icns / app-icon-1024.png\n[Windows] H-LINK-windows.ico / windows-tile-150,310.png\n[iPhone・iPad] apple-touch-icon.png（ホーム画面に追加）\n[Android・Chrome・Edge] icon-192/512.png / icon-maskable-512.png\n[ブラウザのタブ] favicon.ico / favicon-16,32,48.png\n[ストア・印刷] app-icon-1024.png（全面白地）/ app-icon-1024-rounded.png（角丸）\n[透明背景] logo-mark-transparent.png\n";

const web = new Set(["icon-512.png", "icon-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-16.png", "favicon-32.png", "favicon-48.png", "favicon.ico"]);
for (const app of targets) {
  const icons = path.join(app, "icons"), brand = path.join(app, "brand"), tmp = path.join(brand, "_zip");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(icons, { recursive: true }); await mkdir(tmp, { recursive: true });
  for (const [name, buf] of Object.entries(out)) { await writeFile(path.join(tmp, name), buf); if (web.has(name)) await writeFile(path.join(icons, name), buf); }
  for (const f of ["app-icon-1024.png", "H-LINK-mac.icns", "H-LINK-windows.ico"]) await writeFile(path.join(brand, f), out[f]); // 直接ダウンロード用
  await writeFile(path.join(tmp, "README.txt"), readme);
  const zip = path.join(brand, "H-LINK-icons.zip"); await rm(zip, { force: true });
  const files = (await readdir(tmp)).sort().map((f) => path.join(tmp, f));
  execFileSync("zip", ["-X", "-j", "-q", zip, ...files]);
  await rm(tmp, { recursive: true });
}
console.log("icons generated:", Object.keys(out).length, "files ×", targets.length, "apps");
