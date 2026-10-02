import type { Product } from "./types.ts";

// 電子カタログの初期データ（架空の商品・価格。実際の価格は生産者・為替に応じて更新する）。
// 仕入原価（costJPY）は社外向けのカタログ・チラシには出さない。
const P = (id: string, sku: string, name: string, nameEn: string, category: Product["category"], producer: string, origin: string, spec: string, specEn: string, unit: string, moq: number, storage: Product["storage"], shelfLife: string, costJPY: number, priceUSD: number, hsCode: string, certs: string[], desc: string, descEn: string): Product =>
  ({ id, sku, name, nameEn, category, producer, origin, spec, specEn, unit, moq, storage, shelfLife, costJPY, priceUSD, hsCode, certs, desc, descEn, active: true });

export const PRODUCT_SEED: Product[] = [
  P("p1", "HL-BF-001", "和牛A5 サーロイン", "Wagyu A5 Sirloin", "和牛・精肉", "サンプル和牛牧場", "鹿児島県", "A5等級・ブロック／約5kg・冷凍", "Grade A5, block, approx. 5kg, frozen", "kg", 100, "冷凍", "冷凍12か月", 9800, 98, "0202.30", ["牛肉輸出GAP", "輸出認定施設"], "きめ細かな霜降りと、やわらかな口当たり。ステーキ・すき焼き向け。", "Finely marbled and tender. Ideal for steak and sukiyaki."),
  P("p2", "HL-BF-002", "和牛A4 切り落とし", "Wagyu A4 Trimmings", "和牛・精肉", "サンプル和牛牧場", "鹿児島県", "A4等級・スライス用／1kg×10・冷凍", "Grade A4, trimmings, 1kg x 10, frozen", "kg", 100, "冷凍", "冷凍12か月", 4200, 45, "0202.30", ["牛肉輸出GAP", "輸出認定施設"], "レストラン・惣菜向けの使いやすいカット。", "Versatile cuts for restaurants and prepared foods."),
  P("p3", "HL-SF-001", "冷凍ホタテ貝柱 3S", "Frozen Scallop Adductor 3S", "水産物・冷凍", "サンプル水産組合", "北海道", "3Sサイズ／1kg×10・IQF", "3S size, 1kg x 10, IQF", "kg", 500, "冷凍", "冷凍18か月", 2300, 24, "0307.22", ["HACCP", "水産エコラベル"], "刺身でも食べられる鮮度。冷凍でも甘みが逃げにくい急速凍結。", "Sashimi-grade freshness locked in by rapid freezing."),
  P("p4", "HL-SF-002", "冷凍ブリ フィレ", "Frozen Yellowtail Fillet", "水産物・冷凍", "サンプル水産組合", "長崎県", "フィレ・約1.5kg／5kg箱・冷凍", "Fillet, approx. 1.5kg, 5kg case, frozen", "kg", 300, "冷凍", "冷凍12か月", 1800, 19, "0304.89", ["HACCP"], "脂のりがよく、寿司・照り焼きに。", "Rich, fatty fillet for sushi and teriyaki."),
  P("p5", "HL-SK-001", "純米大吟醸 720ml", "Junmai Daiginjo 720ml", "日本酒・焼酎", "サンプル酒造", "新潟県", "720ml×12本／アルコール15%", "720ml x 12 bottles, ABV 15%", "ケース", 20, "常温", "製造後24か月", 21000, 240, "2206.00", ["地理的表示（GI）"], "華やかな香りとすっきりした後味の純米大吟醸。", "Fragrant and clean junmai daiginjo."),
  P("p6", "HL-SK-002", "本格焼酎（芋）720ml", "Imo Shochu 720ml", "日本酒・焼酎", "サンプル酒造", "宮崎県", "720ml×12本／アルコール25%", "720ml x 12 bottles, ABV 25%", "ケース", 20, "常温", "無期限", 14000, 160, "2208.90", [], "サツマイモの甘い香り。ロックやお湯割りに。", "Sweet sweet-potato aroma; enjoy on the rocks or with hot water."),
  P("p7", "HL-TE-001", "抹茶（製菓用）100g缶", "Matcha (Culinary) 100g tin", "茶・抹茶", "サンプル茶園", "静岡県", "100g缶×40", "100g tin x 40", "ケース", 10, "常温", "未開封12か月", 24000, 280, "0902.10", ["有機JAS"], "ラテ・菓子に使いやすい鮮やかな緑色。", "Vivid green; perfect for lattes and sweets."),
  P("p8", "HL-TE-002", "煎茶 リーフ 100g", "Sencha Leaf 100g", "茶・抹茶", "サンプル茶園", "鹿児島県", "100g袋×50", "100g pouch x 50", "ケース", 10, "常温", "未開封12か月", 21000, 240, "0902.10", ["有機JAS"], "すっきりとした香りと旨み。", "Refreshing aroma and umami."),
  P("p9", "HL-FR-001", "いちご（あまおう）", "Strawberry (Amaou)", "青果・果物", "サンプル農園", "福岡県", "大粒・270g×12パック／空輸", "Large, 270g x 12 packs, air freight", "ケース", 50, "冷蔵", "収穫後7日", 6800, 82, "0810.10", ["GLOBALG.A.P."], "大粒で甘く、香りが豊か。空輸で鮮度を保ちます。", "Large, sweet and aromatic; delivered fresh by air."),
  P("p10", "HL-FR-002", "温州みかん", "Mikan (Satsuma Mandarin)", "青果・果物", "サンプル農園", "愛媛県", "5kg箱／M〜Lサイズ", "5kg case, M-L size", "箱", 100, "冷蔵", "収穫後30日", 2400, 29, "0805.21", ["GLOBALG.A.P."], "甘みと酸味のバランスがよく、皮がむきやすい。", "Balanced sweetness and acidity; easy to peel."),
  P("p11", "HL-SE-001", "白味噌 1kg", "White Miso 1kg", "調味料・加工食品", "サンプル味噌蔵", "京都府", "1kg×10袋", "1kg x 10 pouches", "ケース", 20, "常温", "製造後12か月", 6000, 72, "2103.90", ["HACCP", "ハラール（申請中）"], "まろやかで甘みのある白味噌。", "Mild and sweet white miso."),
  P("p12", "HL-SE-002", "醤油 1L", "Soy Sauce 1L", "調味料・加工食品", "サンプル醸造", "千葉県", "1L×12本", "1L x 12 bottles", "ケース", 20, "常温", "製造後18か月", 5400, 64, "2103.10", ["HACCP", "ハラール"], "丸大豆を使った、香りの良い醤油。", "Aromatic whole-soybean shoyu."),
  P("p13", "HL-RC-001", "コシヒカリ 10kg", "Koshihikari Rice 10kg", "米・穀物", "サンプル米穀", "新潟県", "10kg×2袋", "10kg x 2 bags", "ケース", 50, "常温", "精米後6か月", 11000, 128, "1006.30", ["輸出用米"], "つややかで甘みのある日本米の代表品種。", "Glossy, sweet — the classic Japanese rice."),
];
