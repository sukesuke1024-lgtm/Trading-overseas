import type { Product } from "./types";

export interface ChecklistTemplate {
  key: string;
  title: string;
  group: string;
  offset: number; // 案件作成日からの目安日数
}

// 「商品 × 輸出国」で共通に必要な項目 (仕様書 ⑦ の順)
const BASE: ChecklistTemplate[] = [
  { key: "hs", title: "HS Code確認", group: "規制・適合", offset: 3 },
  { key: "jp_export_reg", title: "日本側輸出規制確認", group: "規制・適合", offset: 3 },
  { key: "import_reg", title: "輸入国規制確認", group: "規制・適合", offset: 5 },
  { key: "food_import_reg", title: "食品輸入規制確認", group: "規制・適合", offset: 5 },
  { key: "ingredients", title: "原材料確認", group: "規制・適合", offset: 5 },
  { key: "additives", title: "添加物確認", group: "規制・適合", offset: 5 },
  { key: "allergens", title: "アレルゲン確認", group: "規制・適合", offset: 5 },
  { key: "label", title: "ラベル要件確認", group: "規制・適合", offset: 7 },
  { key: "local_lang", title: "現地言語表示確認", group: "規制・適合", offset: 7 },
  { key: "certification", title: "Certification確認", group: "規制・適合", offset: 7 },
  { key: "origin_cert", title: "原産地証明確認", group: "規制・適合", offset: 10 },
  { key: "authority_reg", title: "FDA等当局登録確認", group: "規制・適合", offset: 10 },
  { key: "moq", title: "MOQ確認", group: "商談・条件", offset: 7 },
  { key: "quotation", title: "見積作成", group: "商談・条件", offset: 10 },
  { key: "incoterms", title: "Incoterms決定", group: "商談・条件", offset: 12 },
  { key: "payment_terms", title: "Payment Terms決定", group: "商談・条件", offset: 12 },
  { key: "shipping_quote", title: "Shipping Quote取得", group: "物流", offset: 14 },
  { key: "insurance", title: "Insurance確認", group: "物流", offset: 14 },
  { key: "invoice", title: "Invoice作成", group: "書類", offset: 21 },
  { key: "packing_list", title: "Packing List作成", group: "書類", offset: 21 },
  { key: "export_declaration", title: "輸出申告", group: "通関・出荷", offset: 25 },
  { key: "customs_clearance", title: "Customs Clearance", group: "通関・出荷", offset: 28 },
  { key: "shipment", title: "Shipment", group: "通関・出荷", offset: 30 },
  { key: "arrival", title: "Arrival", group: "通関・出荷", offset: 45 },
  { key: "buyer_receipt", title: "Buyer受領確認", group: "完了", offset: 47 },
  { key: "payment_confirm", title: "Payment確認", group: "完了", offset: 50 },
];

// 国別の追加項目（当局名などを具体化）
const COUNTRY_EXTRA: Record<string, ChecklistTemplate[]> = {
  US: [
    { key: "us_fda_facility", title: "FDA Food Facility Registration（生産者）確認", group: "規制・適合", offset: 10 },
    { key: "us_prior_notice", title: "FDA Prior Notice 提出", group: "通関・出荷", offset: 27 },
    { key: "us_fsvp", title: "FSVP（輸入者側）対応確認", group: "規制・適合", offset: 10 },
    { key: "us_nutrition", title: "Nutrition Facts ラベル作成", group: "規制・適合", offset: 14 },
  ],
  CA: [{ key: "ca_sfcr", title: "SFCR / CFIA ライセンス確認", group: "規制・適合", offset: 10 }],
  CN: [
    { key: "cn_gacc", title: "GACC（海関総署）生産企業登録確認", group: "規制・適合", offset: 10 },
    { key: "cn_region", title: "日本産食品の輸入停止地域・品目確認", group: "規制・適合", offset: 3 },
    { key: "cn_label", title: "中文ラベル（GB7718）作成", group: "規制・適合", offset: 14 },
  ],
  HK: [{ key: "hk_cfs", title: "CFS 輸入規制・放射性物質証明の要否確認", group: "規制・適合", offset: 7 }],
  TW: [
    { key: "tw_tfda", title: "TFDA 輸入規制・産地証明の要否確認", group: "規制・適合", offset: 7 },
    { key: "tw_label", title: "繁体字ラベル作成", group: "規制・適合", offset: 14 },
  ],
  KR: [
    { key: "kr_mfds", title: "MFDS 海外製造業者登録確認", group: "規制・適合", offset: 10 },
    { key: "kr_label", title: "ハングルラベル作成", group: "規制・適合", offset: 14 },
  ],
  SG: [{ key: "sg_sfa", title: "SFA 輸入ライセンス（Buyer側）確認", group: "規制・適合", offset: 7 }],
  TH: [{ key: "th_fda", title: "Thai FDA 輸入許可・製品登録確認", group: "規制・適合", offset: 10 }],
  VN: [{ key: "vn_reg", title: "ベトナム 自己公表 / 登録要否確認", group: "規制・適合", offset: 10 }],
  MY: [{ key: "my_halal", title: "Halal 要件の確認", group: "規制・適合", offset: 7 }],
  ID: [
    { key: "id_bpom", title: "BPOM 登録（ML番号）確認", group: "規制・適合", offset: 10 },
    { key: "id_halal", title: "Halal 義務化対象か確認", group: "規制・適合", offset: 7 },
  ],
  PH: [{ key: "ph_fda", title: "Philippine FDA LTO / CPR 確認", group: "規制・適合", offset: 10 }],
  AU: [{ key: "au_bicon", title: "BICON（輸入条件）確認", group: "規制・適合", offset: 7 }],
  NZ: [{ key: "nz_mpi", title: "MPI 輸入要件確認", group: "規制・適合", offset: 7 }],
  GB: [{ key: "gb_ipaffs", title: "IPAFFS 事前通知・UKラベル確認", group: "規制・適合", offset: 10 }],
  FR: [{ key: "eu_health", title: "EU 衛生証明書・動物由来原料の確認", group: "規制・適合", offset: 10 }],
  DE: [{ key: "eu_health", title: "EU 衛生証明書・動物由来原料の確認", group: "規制・適合", offset: 10 }],
  NL: [{ key: "eu_health", title: "EU 衛生証明書・動物由来原料の確認", group: "規制・適合", offset: 10 }],
  IT: [{ key: "eu_health", title: "EU 衛生証明書・動物由来原料の確認", group: "規制・適合", offset: 10 }],
  AE: [{ key: "ae_zad", title: "ZAD / Dubai Municipality 製品登録・Halal確認", group: "規制・適合", offset: 10 }],
  SA: [{ key: "sa_sfda", title: "SFDA 登録・Halal確認", group: "規制・適合", offset: 10 }],
};

/** 商品の性質による追加項目 */
function productExtras(product?: Product | null): ChecklistTemplate[] {
  if (!product) return [];
  const extras: ChecklistTemplate[] = [];
  const storage = product.storage || "";
  if (storage.includes("冷凍") || storage.includes("冷蔵")) {
    extras.push({ key: "cold_chain", title: `${storage}コンテナ / Reefer 手配`, group: "物流", offset: 14 });
  }
  if (["水産品", "水産加工品"].includes(product.category)) {
    extras.push({ key: "fish_health_cert", title: "水産物衛生証明書の申請", group: "書類", offset: 21 });
  }
  if (["畜産品", "乳製品"].includes(product.category)) {
    extras.push({ key: "animal_health_cert", title: "動物検疫・衛生証明書の申請", group: "書類", offset: 21 });
  }
  if (product.category === "農産品" || product.category === "米・穀物") {
    extras.push({ key: "phyto", title: "植物検疫証明書（Phytosanitary）", group: "書類", offset: 21 });
  }
  if (product.category === "酒類") {
    extras.push({ key: "liquor", title: "酒類の輸出免税手続き・現地酒類ライセンス確認", group: "規制・適合", offset: 10 });
  }
  if (product.export_restrictions?.trim()) {
    extras.push({ key: "restriction", title: `輸出制限事項の確認：${product.export_restrictions.slice(0, 40)}`, group: "規制・適合", offset: 3 });
  }
  return extras;
}

export function buildChecklist(country: string, product?: Product | null): ChecklistTemplate[] {
  const extras = [...(COUNTRY_EXTRA[country] ?? []), ...productExtras(product)];
  const seen = new Set<string>();
  const merged: ChecklistTemplate[] = [];
  // 区分ごとにまとめ、同区分の基本項目の後ろに追加項目を差し込む
  const groups = Array.from(new Set(BASE.map((b) => b.group)));
  for (const g of groups) {
    for (const t of [...BASE.filter((b) => b.group === g), ...extras.filter((e) => e.group === g)]) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      merged.push(t);
    }
  }
  return merged;
}

export const CHECKLIST_GROUPS = ["規制・適合", "商談・条件", "物流", "書類", "通関・出荷", "完了"];
