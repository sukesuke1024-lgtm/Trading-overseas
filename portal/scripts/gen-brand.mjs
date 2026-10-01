// H-LINK のロゴ素材（brand/src）から、透明背景のロゴ・暗い背景用の白抜きロゴ・アプリアイコン（PWA/iOS/ブラウザタブ）を自動生成する。
// ロゴを差し替えたいときは brand/src の画像を入れ替えて `npm run icons` を実行するだけ。
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => path.join(root, "brand/src", f);
const brand = path.join(root, "public/brand");
const icons = path.join(root, "public/icons");
await mkdir(brand, { recursive: true });
await mkdir(icons, { recursive: true });

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), w: info.width, h: info.height };
}
const png = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });

/** 元画像は透明背景のPNG。縁の薄いゴミ（アルファ8未満）だけ消して、トリミングしやすくする */
function clean({ data, w, h }) {
  const o = Buffer.from(data);
  for (let i = 0; i < o.length; i += 4) if (o[i + 3] < 8) { o[i] = o[i + 1] = o[i + 2] = o[i + 3] = 0; }
  return { data: o, w, h };
}
/** 暗い色（黒・濃い灰）を白にする。赤はそのまま。暗い背景（サイドバー等）で使う */
function darkToWhite({ data, w, h }) {
  const o = Buffer.from(data);
  for (let i = 0; i < o.length; i += 4) {
    const r = o[i], g = o[i + 1], b = o[i + 2];
    const redish = r > 120 && g < 90 && b < 90;
    if (!redish && o[i + 3] > 0) { o[i] = o[i + 1] = o[i + 2] = 255; } // 黒・灰色（影を含む）は白、赤はそのまま
  }
  return { data: o, w, h };
}
async function trimmed(img, pad = 0.04) {
  const t = await png(img).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const p = Math.round(Math.max(t.info.width, t.info.height) * pad);
  return sharp(t.data).extend({ top: p, bottom: p, left: p, right: p, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
}

// ---- 円形ロゴ：受領した黒丸（ナイトモード・アプリアイコン）と赤丸（ライトモード）----
const circle = await sharp(src("circle-black.png")).resize(1024, 1024).png().toBuffer();
await sharp(circle).resize(512, 512).png().toFile(path.join(brand, "logo-circle-black.png"));
await sharp(src("circle-red.png")).resize(512, 512).png().toFile(path.join(brand, "logo-circle-red.png"));
await sharp(circle).resize(512, 512).png().toFile(path.join(brand, "logo-circle.png")); // 旧名の互換

// ---- ナイトモード用の縦・横ロゴ：黒い背景を透明にする（明るさをそのまま不透明度に。縁の黒はにじまない）----
async function blackToAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const o = Buffer.from(data);
  for (let i = 0; i < o.length; i += 4) {
    const a = Math.max(o[i], o[i + 1], o[i + 2]);
    if (a < 6) { o[i] = o[i + 1] = o[i + 2] = o[i + 3] = 0; continue; }
    o[i] = Math.min(255, Math.round((o[i] * 255) / a)); o[i + 1] = Math.min(255, Math.round((o[i + 1] * 255) / a)); o[i + 2] = Math.min(255, Math.round((o[i + 2] * 255) / a)); o[i + 3] = a;
  }
  return { data: o, w: info.width, h: info.height };
}
for (const [name, f] of [["vertical", "vertical-night.webp"], ["horizontal", "horizontal-night.png"]]) {
  const img = await blackToAlpha(src(f));
  await (await trimmed(img)).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).toFile(path.join(brand, `logo-${name}-night.png`));
}

// ---- 透明背景版 / 暗い背景用（白抜き）版 ----
const files = { vertical: "vertical.png", mark: "mark.png", mono: "mono.png", horizontal: "horizontal.png" };
for (const [name, f] of Object.entries(files)) {
  const t = clean(await raw(src(f)));
  const normal = await trimmed(t);
  await normal.resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).toFile(path.join(brand, `logo-${name}.png`));
  const light = await trimmed(darkToWhite(t));
  await light.resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).toFile(path.join(brand, `logo-${name}-light.png`));
}

// ---- アプリアイコン（円形ロゴを使用）----
const black = { r: 0, g: 0, b: 0, alpha: 1 };
const onBlack = async (size, scale) => {
  const inner = Math.round(size * scale);
  const c = await sharp(circle).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: black } }).composite([{ input: c, gravity: "center" }]).png();
};
await sharp(circle).resize(192, 192).png().toFile(path.join(icons, "icon-192.png"));
await sharp(circle).resize(512, 512).png().toFile(path.join(icons, "icon-512.png"));
await sharp(circle).resize(32, 32).png().toFile(path.join(icons, "favicon-32.png"));
await (await onBlack(512, 0.72)).toFile(path.join(icons, "icon-maskable-512.png")); // 端末側で角が切り取られても欠けない余白つき
await (await onBlack(180, 0.9)).toFile(path.join(icons, "apple-touch-icon.png")); // iOSが角丸を付ける
console.log("brand + icons generated");
