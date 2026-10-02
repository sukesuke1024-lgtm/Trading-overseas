// メール本文のHTML（文章・商品一覧の表）。チラシ・カタログ・マイソクは作らず、実際のファイル（PDF・画像）を添付して送る。
import type { Lang, Product } from "./types.ts";

export const COMPANY = { name: "H-LINK", tagline: "つなぐ、越える、食の可能性をひらく。", taglineEn: "Connecting Japan's finest food to the world." };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const priceLabel = (p: Product) => `FOB US$${p.priceUSD.toLocaleString("en-US")} / ${p.unit}`;

/** 本文に入れる商品一覧（任意）。メールソフトで崩れにくいテーブル＋インライン CSS。仕入原価は出さない */
export function productTableHtml(items: Product[], lang: Lang, showPrice: boolean): string {
  const rows = items.map((p) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e4e3df"><b>${esc(lang === "en" ? p.nameEn : p.name)}</b><br><span style="color:#54565e;font-size:12px">${esc(lang === "en" ? p.specEn : p.spec)}</span></td><td style="padding:8px 10px;border-bottom:1px solid #e4e3df;text-align:right;white-space:nowrap;font-size:12px">${showPrice ? `<b>${esc(priceLabel(p))}</b><br>` : ""}MOQ ${p.moq}${esc(p.unit)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:12px auto;border:1px solid #e4e3df;border-collapse:collapse;font-family:'Hiragino Sans','Noto Sans JP',Meiryo,Arial,sans-serif;font-size:13px">${rows}</table>`;
}
export function productTableText(items: Product[], lang: Lang, showPrice: boolean): string {
  return items.map((p) => `■ ${lang === "en" ? p.nameEn : p.name}\n  ${lang === "en" ? p.specEn : p.spec}\n  ${showPrice ? priceLabel(p) + " ／ " : ""}MOQ ${p.moq}${p.unit}`).join("\n");
}
