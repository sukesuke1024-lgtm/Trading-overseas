// 電子カタログ・電子チラシ・メール用チラシの HTML 生成（純関数）。仕入原価などの社内情報は出力しない。
import type { Lang, Product, ProductCategory } from "./types.ts";

export const COMPANY = { name: "H-LINK", tagline: "つなぐ、越える、食の可能性をひらく。", taglineEn: "Connecting Japan's finest food to the world." };
export const CATEGORY_HUE: Record<ProductCategory, number> = { "和牛・精肉": 8, "水産物・冷凍": 205, "日本酒・焼酎": 265, "茶・抹茶": 120, "青果・果物": 350, "調味料・加工食品": 32, "米・穀物": 48 };
export const CATEGORY_EN: Record<ProductCategory, string> = { "和牛・精肉": "Wagyu & Meat", "水産物・冷凍": "Seafood (Frozen)", "日本酒・焼酎": "Sake & Shochu", "茶・抹茶": "Tea & Matcha", "青果・果物": "Fruit & Produce", "調味料・加工食品": "Seasonings & Foods", "米・穀物": "Rice & Grains" };

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const t = (p: Product, lang: Lang) => ({ name: lang === "en" ? p.nameEn : p.name, spec: lang === "en" ? p.specEn : p.spec, desc: lang === "en" ? p.descEn : p.desc, cat: lang === "en" ? CATEGORY_EN[p.category] : p.category });
export const priceLabel = (p: Product, lang: Lang) => `FOB US$${p.priceUSD.toLocaleString("en-US")} / ${p.unit}${lang === "en" ? "" : "（参考）"}`;

/** 商品のイメージ（グラデーションと頭文字。写真を登録するまでの仮の絵柄）。data URI の SVG */
export function productArt(p: Product, w = 640, h = 400): string {
  const hue = CATEGORY_HUE[p.category];
  const initial = esc(p.name.replace(/^冷凍|^本格|^純米/, "").slice(0, 1) || p.name.slice(0, 1));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 38%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 60% 22%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.78}" cy="${h * 0.3}" r="${h * 0.42}" fill="hsl(${hue} 70% 70%)" opacity=".16"/><circle cx="${w * 0.2}" cy="${h * 0.95}" r="${h * 0.5}" fill="#fff" opacity=".07"/><text x="${w * 0.08}" y="${h * 0.62}" font-family="Hiragino Mincho ProN,Yu Mincho,Noto Serif JP,serif" font-size="${h * 0.5}" fill="#fff" opacity=".9" font-weight="700">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface FlyerOpts { title: string; subtitle: string; validUntil: string; contactName: string; contactEmail: string; lang: Lang; showPrice: boolean; note: string }

const CSS_BASE = `*{box-sizing:border-box}body{margin:0;font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,system-ui,sans-serif;color:#17171a;background:#f3f3f1}.red{color:#c8102e}`;

/** A4 の電子チラシ（画面でもそのまま印刷／PDF保存できる） */
export function flyerHtml(items: Product[], o: FlyerOpts): string {
  const cards = items.slice(0, 6).map((p) => { const x = t(p, o.lang); return `<div class="c"><img src="${productArt(p, 480, 300)}" alt=""><div class="b"><div class="k">${esc(x.cat)}</div><h3>${esc(x.name)}</h3><p>${esc(x.spec)}</p>${o.showPrice ? `<div class="p">${esc(priceLabel(p, o.lang))}</div>` : ""}<small>MOQ ${p.moq}${esc(p.unit)} ・ ${esc(p.origin)}${p.certs.length ? " ・ " + esc(p.certs.join(" / ")) : ""}</small></div></div>`; }).join("");
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title><style>${CSS_BASE}
.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.12);display:flex;flex-direction:column}
.hd{background:#0d0d10;color:#fff;padding:22px 26px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:5px solid #c8102e}.hd b{font-size:28px;letter-spacing:.04em}.hd span{font-size:11px;opacity:.75}
.ttl{padding:22px 26px 6px}.ttl h1{margin:0;font-size:26px;line-height:1.25}.ttl p{margin:6px 0 0;color:#54565e;font-size:13px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px 26px 8px}.c{border:1px solid #e4e3df;border-radius:10px;overflow:hidden}.c img{width:100%;display:block;height:120px;object-fit:cover}.b{padding:10px 12px}.k{font-size:10px;color:#c8102e;font-weight:700;letter-spacing:.06em}.b h3{margin:2px 0 4px;font-size:15px}.b p{margin:0 0 6px;font-size:11.5px;color:#54565e;line-height:1.5}.p{font-weight:700;font-size:14px}.b small{display:block;margin-top:4px;color:#8a8c95;font-size:10px}
.nt{padding:6px 26px;font-size:12px;color:#54565e}.ft{margin-top:auto;background:#f6ecec;padding:16px 26px;font-size:12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.ft b{font-size:13px}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;width:auto}@page{size:A4;margin:0}}@media(max-width:700px){.page{width:auto;margin:0}.g{grid-template-columns:1fr}}</style></head><body><div class="page">
<div class="hd"><b>${COMPANY.name}</b><span>${esc(o.lang === "en" ? COMPANY.taglineEn : COMPANY.tagline)}</span></div>
<div class="ttl"><h1>${esc(o.title)}</h1><p>${esc(o.subtitle)}</p></div><div class="g">${cards}</div>${o.note ? `<div class="nt">${esc(o.note)}</div>` : ""}
<div class="ft"><div><b>${o.lang === "en" ? "Contact" : "お問い合わせ"}</b><br>${esc(o.contactName)} ／ ${esc(o.contactEmail)}</div><div>${o.lang === "en" ? "Valid until" : "有効期限"}：<b>${esc(o.validUntil)}</b><br>${o.lang === "en" ? "Prices are indicative (FOB). Subject to change by exchange rate and season." : "価格は目安（FOB）です。為替・時期により変動します。"}</div></div></div></body></html>`;
}

/** メール用：テーブルレイアウト＋インライン CSS（メールソフトで崩れにくい）。画像は使わず色面で表現する */
export function emailFlyerBlock(items: Product[], o: FlyerOpts): string {
  const rows = items.slice(0, 6).map((p) => { const x = t(p, o.lang); const hue = CATEGORY_HUE[p.category];
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e3df"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="6" style="background:hsl(${hue},55%,38%)"></td><td style="padding:0 12px"><div style="font-size:11px;color:#c8102e;font-weight:bold">${esc(x.cat)}</div><div style="font-size:16px;font-weight:bold;color:#17171a">${esc(x.name)}</div><div style="font-size:12px;color:#54565e;margin-top:2px">${esc(x.spec)}</div><div style="font-size:12px;color:#54565e;margin-top:2px">${esc(x.desc)}</div></td><td width="150" align="right" style="padding-right:4px;vertical-align:top">${o.showPrice ? `<div style="font-size:14px;font-weight:bold">US$${p.priceUSD.toLocaleString("en-US")}</div><div style="font-size:11px;color:#54565e">FOB / ${esc(p.unit)}</div>` : ""}<div style="font-size:11px;color:#8a8c95;margin-top:4px">MOQ ${p.moq}${esc(p.unit)}</div></td></tr></table></td></tr>`; }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:16px auto;border:1px solid #e4e3df;font-family:'Hiragino Sans','Noto Sans JP',Meiryo,Arial,sans-serif"><tr><td style="background:#0d0d10;color:#ffffff;padding:16px 20px;border-bottom:4px solid #c8102e"><span style="font-size:22px;font-weight:bold;letter-spacing:1px">${COMPANY.name}</span><span style="font-size:11px;opacity:.75;margin-left:12px">${esc(o.lang === "en" ? COMPANY.taglineEn : COMPANY.tagline)}</span></td></tr><tr><td style="padding:16px 20px 4px"><div style="font-size:19px;font-weight:bold;color:#17171a">${esc(o.title)}</div><div style="font-size:12px;color:#54565e;margin-top:4px">${esc(o.subtitle)}</div></td></tr><tr><td style="padding:4px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr><tr><td style="background:#f6ecec;padding:12px 20px;font-size:12px;color:#17171a">${o.lang === "en" ? "Valid until" : "有効期限"}：<b>${esc(o.validUntil)}</b> ／ ${esc(o.contactName)} ${esc(o.contactEmail)}</td></tr></table>`;
}

/** 単一ファイルの電子カタログ（HTML）。検索・カテゴリ絞り込み・印刷に対応。メールに添付／共有できる */
export function catalogHtml(items: Product[], lang: Lang, o: { validUntil: string; contactEmail: string; showPrice: boolean }): string {
  const data = items.map((p) => { const x = t(p, lang); return { id: p.id, cat: x.cat, name: x.name, spec: x.spec, desc: x.desc, price: o.showPrice ? priceLabel(p, lang) : "", moq: `${p.moq}${p.unit}`, storage: p.storage, shelf: p.shelfLife, origin: p.origin, hs: p.hsCode, certs: p.certs.join(" / "), art: productArt(p, 480, 300) }; });
  const cats = [...new Set(data.map((x) => x.cat))];
  const L = lang === "en" ? { search: "Search products", all: "All", moq: "MOQ", storage: "Storage", shelf: "Shelf life", origin: "Origin", hs: "HS code", cert: "Certifications", valid: "Valid until", contact: "Contact", note: "Prices are indicative (FOB) and subject to change." } : { search: "商品を検索", all: "すべて", moq: "最小ロット", storage: "保存", shelf: "賞味期限", origin: "産地", hs: "HSコード", cert: "認証", valid: "有効期限", contact: "お問い合わせ", note: "価格は目安（FOB）です。為替・時期により変動します。" };
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${COMPANY.name} Catalog</title><style>${CSS_BASE}
header{background:#0d0d10;color:#fff;padding:18px 24px;border-bottom:5px solid #c8102e}header b{font-size:26px;letter-spacing:.04em}header span{display:block;font-size:12px;opacity:.75}
.bar{display:flex;gap:8px;flex-wrap:wrap;padding:14px 24px;position:sticky;top:0;background:#f3f3f1;z-index:2}input{height:36px;border:1px solid #cfcdc7;border-radius:8px;padding:0 12px;min-width:220px;font-size:14px}button{height:36px;border:0;border-radius:18px;padding:0 14px;background:#fff;box-shadow:0 0 0 1px #cfcdc7;cursor:pointer;font-size:13px}button.on{background:#17171a;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;padding:6px 24px 24px}.c{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}.c img{width:100%;height:150px;object-fit:cover;display:block}.b{padding:12px 14px}.k{font-size:11px;color:#c8102e;font-weight:700}.b h3{margin:2px 0 6px;font-size:16px}.b p{margin:0 0 8px;font-size:12.5px;color:#54565e;line-height:1.55}.p{font-weight:700;font-size:15px;margin-bottom:6px}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:11.5px;margin:0}dt{color:#8a8c95}dd{margin:0}
footer{padding:18px 24px 30px;font-size:12px;color:#54565e}@media print{.bar{display:none}body{background:#fff}.c{break-inside:avoid;box-shadow:none;border:1px solid #ddd}}</style></head><body>
<header><b>${COMPANY.name}</b><span>${esc(lang === "en" ? COMPANY.taglineEn : COMPANY.tagline)}</span></header>
<div class="bar"><input id="q" placeholder="${L.search}"><button class="on" data-c="">${L.all}</button>${cats.map((c) => `<button data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
<div class="grid" id="g"></div><footer>${L.valid}: <b>${esc(o.validUntil)}</b> ／ ${L.contact}: ${esc(o.contactEmail)}<br>${L.note}</footer>
<script>var D=${JSON.stringify(data).replace(/</g, "\\u003c")},L=${JSON.stringify(L)},cat="";function R(){var q=document.getElementById("q").value.toLowerCase(),h="";D.forEach(function(p){if(cat&&p.cat!==cat)return;if(q&&(p.name+p.spec+p.desc+p.cat).toLowerCase().indexOf(q)<0)return;h+='<div class="c"><img src="'+p.art+'" alt=""><div class="b"><div class="k">'+p.cat+'</div><h3>'+p.name+'</h3><p>'+p.spec+'</p><p>'+p.desc+'</p>'+(p.price?'<div class="p">'+p.price+'</div>':'')+'<dl><dt>'+L.moq+'</dt><dd>'+p.moq+'</dd><dt>'+L.storage+'</dt><dd>'+p.storage+'</dd><dt>'+L.shelf+'</dt><dd>'+p.shelf+'</dd><dt>'+L.origin+'</dt><dd>'+p.origin+'</dd><dt>'+L.hs+'</dt><dd>'+p.hs+'</dd>'+(p.certs?'<dt>'+L.cert+'</dt><dd>'+p.certs+'</dd>':'')+'</dl></div></div>'});document.getElementById("g").innerHTML=h}document.getElementById("q").oninput=R;[].forEach.call(document.querySelectorAll("button[data-c]"),function(b){b.onclick=function(){cat=b.dataset.c;[].forEach.call(document.querySelectorAll("button[data-c]"),function(x){x.className=x===b?"on":""});R()}});R()</script></body></html>`;
}
