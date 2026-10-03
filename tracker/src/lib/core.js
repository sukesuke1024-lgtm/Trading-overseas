// 統合追跡の純粋ロジック（UI非依存・テスト対象）

// 港（UN/LOCODE 5文字）と空港（IATA 3文字）。経路の地図表示と位置推定に使う
const PLACES = {
  JPYOK: ['横浜', 35.45, 139.65], JPTYO: ['東京', 35.62, 139.79], JPNGO: ['名古屋', 35.08, 136.88],
  JPOSA: ['大阪', 34.65, 135.43], JPUKB: ['神戸', 34.67, 135.2], JPHKT: ['博多', 33.6, 130.4],
  SGSIN: ['シンガポール', 1.26, 103.82], HKHKG: ['香港', 22.3, 114.17], CNSHA: ['上海', 31.23, 121.49],
  KRPUS: ['釜山', 35.1, 129.04], TWKHH: ['高雄', 22.61, 120.28], THLCH: ['レムチャバン', 13.08, 100.88],
  VNSGN: ['ホーチミン', 10.77, 106.7], USLAX: ['ロサンゼルス港', 33.74, -118.26], NLRTM: ['ロッテルダム', 51.95, 4.14],
  AEJEA: ['ジェベル・アリ', 25.01, 55.06],
  NRT: ['成田空港', 35.77, 140.39], HND: ['羽田空港', 35.55, 139.78], KIX: ['関西空港', 34.43, 135.24],
  NGO: ['中部空港', 34.86, 136.81], FUK: ['福岡空港', 33.59, 130.45], SIN: ['シンガポール空港', 1.36, 103.99],
  HKG: ['香港空港', 22.31, 113.91], PVG: ['上海浦東空港', 31.14, 121.81], ICN: ['仁川空港', 37.46, 126.44],
  BKK: ['バンコク空港', 13.69, 100.75], LAX: ['ロサンゼルス空港', 33.94, -118.41], JFK: ['ニューヨークJFK', 40.64, -73.78],
  FRA: ['フランクフルト', 50.03, 8.57], DXB: ['ドバイ空港', 25.25, 55.36],
};
const PORTS = {};
Object.keys(PLACES).forEach((k) => { PORTS[k] = { name: PLACES[k][0], lat: PLACES[k][1], lon: PLACES[k][2] }; });

const MODES = {
  sea: { name: '海外・海上コンテナ', short: '海外' },
  air: { name: '海外・航空貨物', short: '海外' },
  intl: { name: '海外・国際宅配', short: '海外' },
  mainland: { name: '道外・国内宅配', short: '道外' },
  hokkaido: { name: '道内・国内宅配', short: '道内' },
};
// 場所（海外・道外・道内）と手段（船・飛行機・トラック・宅配便）。追跡の方法(mode)は、この2つの組み合わせで決まる
const AREAS = { overseas: '海外', mainland: '道外', hokkaido: '道内' };
const MEANS = { ship: '船', plane: '飛行機', truck: 'トラック', parcel: '宅配便' };
const areaOf = (mode) => (mode === 'mainland' ? 'mainland' : mode === 'hokkaido' || mode === 'domestic' ? 'hokkaido' : 'overseas');
const defaultMeans = (mode) => (mode === 'sea' ? 'ship' : mode === 'air' ? 'plane' : mode === 'intl' ? 'parcel' : 'truck');
const meansOf = (s) => (MEANS[s.means] ? s.means : defaultMeans(s.mode));
// 海外は手段で追跡方法が決まる（船=コンテナ番号、飛行機=AWB、それ以外=国際宅配）。国内は場所がそのまま追跡方法（手段は表示用）
const resolveMode = (area, means) => (area === 'mainland' ? 'mainland' : area === 'hokkaido' ? 'hokkaido' : means === 'ship' ? 'sea' : means === 'plane' ? 'air' : 'intl');
// 既定の手段と同じなら保存しない（モードを変えたときに古い手段が残らないように）
const normalizeMeans = (mode, means) => (means && MEANS[means] && means !== defaultMeans(mode) ? means : undefined);
// 旧データ・番号判別の「国内」は、既定で道内として扱う（画面で道外へ変更できる）
const isDomestic = (mode) => mode === 'hokkaido' || mode === 'mainland' || mode === 'domestic';
const defaultMode = (mode) => (mode === 'domestic' ? 'hokkaido' : mode);

// 全手段共通の7工程。表示名だけ手段ごとに変える
const STAGE_KEYS = ['booked', 'picked_up', 'departed', 'in_transit', 'arrived', 'customs', 'delivered'];
const LABELS = {
  sea: ['ブッキング済', '積地ターミナル搬入', '本船積込', '航海中', '揚地到着', '通関中', '配送完了'],
  air: ['手配済', '空港受付', '搭載・出発', '飛行中', '到着', '通関中', '配達完了'],
  hokkaido: ['受付済', '集荷', '発送', '輸送中', '配達店到着', '配達中', '配達完了'],
  mainland: ['受付済', '集荷', '発送（道外へ）', '輸送中（海峡・長距離）', '配達店到着', '配達中', '配達完了'],
  intl: ['受付済', '集荷', '発送', '国際輸送中', '到着国', '通関・配達中', '配達完了'],
};
// 旧データ（海上専用版）のキーからの移行
const LEGACY_STAGE = { gate_in: 'picked_up', loaded: 'departed', sailing: 'in_transit' };

const STAGES = STAGE_KEYS.map((key, i) => ({ key, label: LABELS.sea[i] }));
function stageLabels(mode) { return STAGE_KEYS.map((key, i) => ({ key, label: (LABELS[defaultMode(mode)] || LABELS.sea)[i] })); }
function stageIndex(key) {
  const k = LEGACY_STAGE[key] || key;
  const i = STAGE_KEYS.indexOf(k);
  return i < 0 ? 0 : i;
}

const CARRIERS = {
  MSKU: 'Maersk', MRKU: 'Maersk', MAEU: 'Maersk', MSCU: 'MSC', CMAU: 'CMA CGM',
  HLXU: 'Hapag-Lloyd', HLCU: 'Hapag-Lloyd', ONEU: 'ONE', OOLU: 'OOCL', COSU: 'COSCO',
  EGHU: 'Evergreen', EISU: 'Evergreen', YMLU: 'Yang Ming', HDMU: 'HMM', ZIMU: 'ZIM',
};
// 航空会社（AWB先頭3桁）の一部
const AIRLINES = { 131: '日本航空', 205: '全日空', 160: 'キャセイパシフィック', 618: 'シンガポール航空', 176: 'エミレーツ', 180: '大韓航空', 297: 'チャイナエアライン', 784: '中国南方航空', 406: 'UPS Airlines', 23: 'FedEx', 6: 'デルタ航空', 1: 'ユナイテッド航空', 20: 'ルフトハンザ' };

function normalizeNo(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
const normalizeContainerNo = normalizeNo;

// ---- 番号の検証 ----
function isValidContainerNo(s) {
  const n = normalizeNo(s);
  if (!/^[A-Z]{3}[UJZ][0-9]{7}$/.test(n)) return false;
  let sum = 0, val = 10;
  const letter = {};
  for (let c = 65; c <= 90; c++) { if (val % 11 === 0) val++; letter[String.fromCharCode(c)] = val++; }
  for (let i = 0; i < 10; i++) sum += (/[A-Z]/.test(n[i]) ? letter[n[i]] : Number(n[i])) * Math.pow(2, i);
  return (sum % 11) % 10 === Number(n[10]);
}
// AWB: 航空会社3桁 + シリアル7桁 + 検査数字1桁（シリアル7桁 mod 7）
function isValidAwb(s) {
  const n = normalizeNo(s);
  return /^[0-9]{11}$/.test(n) && Number(n.slice(3, 10)) % 7 === Number(n[10]);
}
// ヤマト運輸: 12桁、先頭11桁 mod 7 = 末尾（運送業界で広く使われる検査方式）
function isValidYamato(s) {
  const n = normalizeNo(s);
  return /^[0-9]{12}$/.test(n) && Number(n.slice(0, 11)) % 7 === Number(n[11]);
}
// 万国郵便連合 S10: 英字2 + 数字8 + 検査1 + 英字2
function isValidS10(s) {
  const n = normalizeNo(s);
  if (!/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(n)) return false;
  const w = [8, 6, 4, 2, 3, 5, 9, 7];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(n[2 + i]) * w[i];
  let c = 11 - (sum % 11);
  if (c === 10) c = 0; else if (c === 11) c = 5;
  return c === Number(n[10]);
}

// 番号から輸送手段の候補を推定（可能性の高い順）。同じ桁数で衝突するものは複数返す
function detect(input) {
  const n = normalizeNo(input);
  const out = [];
  const add = (mode, carrier, valid) => out.push({ mode, carrier, valid });
  if (!n) return out;
  if (/^[A-Z]{3}[UJZ][0-9]{7}$/.test(n)) add('sea', CARRIERS[n.slice(0, 4)] || '', isValidContainerNo(n));
  if (/^[0-9]{11}$/.test(n)) {
    const al = AIRLINES[Number(n.slice(0, 3))] || '';
    if (isValidAwb(n)) { add('air', al, true); add('domestic', '佐川急便/日本郵便', false); } else { add('domestic', '佐川急便/日本郵便', true); add('air', al, false); }
  }
  if (/^[0-9]{12}$/.test(n)) {
    if (isValidYamato(n)) { add('domestic', 'ヤマト運輸', true); add('domestic', '佐川急便', true); } else { add('domestic', '佐川急便', true); add('domestic', 'ヤマト運輸', false); }
  }
  if (/^[0-9]{10}$/.test(n)) add('intl', 'DHL', true);
  if (/^1Z[A-Z0-9]{16}$/.test(n)) add('intl', 'UPS', true);
  if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(n)) {
    if (/JP$/.test(n)) add(n.slice(0, 2) === 'EE' || n.slice(0, 2) === 'EM' ? 'intl' : 'intl', '日本郵便（EMS・国際郵便）', isValidS10(n));
    else add('intl', '国際郵便', isValidS10(n));
  }
  return out;
}

function validFor(mode, no) {
  const n = normalizeNo(no);
  if (mode === 'sea') return isValidContainerNo(n);
  if (mode === 'air') return isValidAwb(n);
  if (isDomestic(mode)) return /^[0-9]{11,12}$/.test(n);
  if (mode === 'intl') return /^[0-9]{10}$/.test(n) || /^1Z[A-Z0-9]{16}$/.test(n) || isValidS10(n) || /^[0-9A-Z]{8,30}$/.test(n);
  return false;
}

function carrierOf(no, mode) {
  const n = normalizeNo(no);
  if (mode === 'air') return AIRLINES[Number(n.slice(0, 3))] || '不明';
  return CARRIERS[n.slice(0, 4)] || '不明';
}

// ---- 進捗・位置・アラート ----
function haversineKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const nowOf = (n) => (n == null ? Date.now() : n);

function voyageProgress(s, now) {
  const etd = Date.parse(s.etd), eta = Date.parse(s.eta);
  if (!isFinite(etd) || !isFinite(eta) || eta <= etd) return stageIndex(s.stage) >= 4 ? 1 : 0;
  return Math.max(0, Math.min(1, (nowOf(now) - etd) / (eta - etd)));
}
// 実績位置(s.position)があればそれを優先。無ければ出発〜到着予定からの推定
function estimatePosition(s, now) {
  if (s.position && isFinite(s.position.lat) && isFinite(s.position.lon)) return { lat: s.position.lat, lon: s.position.lon, p: voyageProgress(s, now), actual: true };
  const from = PORTS[s.pol], to = PORTS[s.pod];
  if (!from || !to) return null;
  const idx = stageIndex(s.stage);
  if (idx < 3) return { lat: from.lat, lon: from.lon, p: 0, actual: false };
  if (idx >= 4) return { lat: to.lat, lon: to.lon, p: 1, actual: false };
  const p = voyageProgress(s, now);
  return { lat: from.lat + (to.lat - from.lat) * p, lon: from.lon + (to.lon - from.lon) * p, p, actual: false };
}
function delayDays(s, now) {
  if (stageIndex(s.stage) >= 4) return 0;
  const eta = Date.parse(s.eta);
  if (!isFinite(eta)) return 0;
  const d = Math.floor((nowOf(now) - eta) / 86400000);
  return d > 0 ? d : 0;
}
function daysToEta(s, now) {
  const eta = Date.parse(s.eta);
  return isFinite(eta) ? Math.ceil((eta - nowOf(now)) / 86400000) : null;
}
// 手段ごとの「更新が止まっている」とみなす日数
const STALE_DAYS = { sea: 5, air: 2, hokkaido: 2, mainland: 4, intl: 5 };

function alertsFor(s, now) {
  const out = [], idx = stageIndex(s.stage), t = nowOf(now);
  if (idx >= 6) return out; // 配達完了は対象外
  if (s.exception) out.push({ level: 'danger', text: '配送上の問題が報告されています' + (s.exceptionNote ? '：' + s.exceptionNote : '') });
  const late = delayDays(s, now);
  if (late > 0) out.push({ level: 'danger', text: 'ETA を ' + late + ' 日超過しています' });
  const left = daysToEta(s, now);
  if (idx < 4 && left != null && left >= 0 && left <= 3) out.push({ level: 'warn', text: '到着まであと ' + left + ' 日' });
  if (idx >= 4 && s.freeTimeEnd) {
    const f = Math.ceil((Date.parse(s.freeTimeEnd) - t) / 86400000);
    if (f <= 0) out.push({ level: 'danger', text: 'フリータイム終了（デマレージ発生中）' });
    else if (f <= 2) out.push({ level: 'warn', text: 'フリータイム残り ' + f + ' 日' });
  }
  if (s.lastEventAt && idx >= 1) {
    const quiet = Math.floor((t - Date.parse(s.lastEventAt)) / 86400000);
    if (quiet >= (STALE_DAYS[s.mode] || 5)) out.push({ level: 'warn', text: quiet + ' 日間、動きがありません' });
  }
  if (!validFor(s.mode, s.containerNo)) out.push({ level: 'warn', text: '番号の形式／検査数字が不正です' });
  return out;
}
function severity(s, now) {
  const a = alertsFor(s, now);
  return a.some((x) => x.level === 'danger') ? 2 : a.length ? 1 : 0;
}

// 旧データの移行（mode無し→海上）。破壊せず新しいオブジェクトを返す
function migrate(s) {
  const o = Object.assign({}, s);
  o.mode = o.mode ? defaultMode(o.mode) : 'sea';
  o.stage = STAGE_KEYS[stageIndex(o.stage)];
  return o;
}

// 追跡サービスの結果を荷物に反映（空の値では上書きしない）。変化があれば changed=true
function applyUpdate(s, up) {
  const next = Object.assign({}, s);
  let changed = false;
  ['stage', 'eta', 'vessel', 'voyage', 'exception', 'exceptionNote', 'lastEventAt', 'position', 'events'].forEach((k) => {
    if (up[k] == null || up[k] === '') return;
    if (JSON.stringify(up[k]) !== JSON.stringify(next[k])) { next[k] = up[k]; changed = true; }
  });
  if (up.stage && stageIndex(up.stage) >= 6) next.exception = false;
  next.checkedAt = new Date(nowOf(up.now)).toISOString();
  return { shipment: next, changed };
}

// ---- CSV ----
// 列名 containerNo は旧版との互換のため「追跡番号」の意味で維持
const CSV_COLS = ['mode', 'means', 'containerNo', 'dealId', 'bookingNo', 'blNo', 'carrier', 'vessel', 'voyage', 'pol', 'pod', 'etd', 'eta', 'stage', 'freeTimeEnd', 'lot', 'producer', 'buyer', 'note'];
const csvEscape = (v) => { const t = v == null ? '' : String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
function toCsv(list) { return [CSV_COLS.join(',')].concat(list.map((s) => CSV_COLS.map((c) => csvEscape(s[c])).join(','))).join('\r\n'); }
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { if (CSV_COLS.includes(h)) o[h] = (r[i] || '').trim(); });
    o.containerNo = normalizeNo(o.containerNo);
    o.mode = defaultMode(o.mode);
    if (!MODES[o.mode]) { const d = detect(o.containerNo)[0]; o.mode = d ? defaultMode(d.mode) : 'sea'; }
    o.stage = STAGE_KEYS[stageIndex(o.stage)];
    return o;
  }).filter((o) => o.containerNo);
}

export { AREAS, MEANS, areaOf, defaultMeans, meansOf, resolveMode, normalizeMeans, isDomestic, defaultMode, PORTS, MODES, STAGES, STAGE_KEYS, CARRIERS, AIRLINES, CSV_COLS, stageLabels, normalizeNo, normalizeContainerNo, isValidContainerNo, isValidAwb, isValidYamato, isValidS10, detect, validFor, carrierOf, stageIndex, haversineKm, voyageProgress, estimatePosition, delayDays, daysToEta, alertsFor, severity, migrate, applyUpdate, toCsv, parseCsv };
