// コンテナ追跡の純粋ロジック（UI非依存・テスト対象）
(function (root) {
  'use strict';

  // 主要コンテナ港（緯度経度）。経路の地図表示と進捗計算に使う
  const PORTS = {
    JPYOK: { name: '横浜', lat: 35.45, lon: 139.65 },
    JPTYO: { name: '東京', lat: 35.62, lon: 139.79 },
    JPNGO: { name: '名古屋', lat: 35.08, lon: 136.88 },
    JPOSA: { name: '大阪', lat: 34.65, lon: 135.43 },
    JPUKB: { name: '神戸', lat: 34.67, lon: 135.2 },
    JPHKT: { name: '博多', lat: 33.6, lon: 130.4 },
    SGSIN: { name: 'シンガポール', lat: 1.26, lon: 103.82 },
    HKHKG: { name: '香港', lat: 22.3, lon: 114.17 },
    CNSHA: { name: '上海', lat: 31.23, lon: 121.49 },
    KRPUS: { name: '釜山', lat: 35.1, lon: 129.04 },
    TWKHH: { name: '高雄', lat: 22.61, lon: 120.28 },
    THLCH: { name: 'レムチャバン', lat: 13.08, lon: 100.88 },
    VNSGN: { name: 'ホーチミン', lat: 10.77, lon: 106.7 },
    USLAX: { name: 'ロサンゼルス', lat: 33.74, lon: -118.26 },
    NLRTM: { name: 'ロッテルダム', lat: 51.95, lon: 4.14 },
    AEJEA: { name: 'ジェベル・アリ', lat: 25.01, lon: 55.06 },
  };

  // 船会社プレフィックス（オーナーコード3文字＋U）の一部。未登録は「不明」
  const CARRIERS = {
    MSKU: 'Maersk', MRKU: 'Maersk', MAEU: 'Maersk', MSCU: 'MSC', CMAU: 'CMA CGM',
    HLXU: 'Hapag-Lloyd', HLCU: 'Hapag-Lloyd', ONEU: 'ONE', OOLU: 'OOCL', COSU: 'COSCO',
    EGHU: 'Evergreen', EISU: 'Evergreen', YMLU: 'Yang Ming', HDMU: 'HMM', ZIMU: 'ZIM',
  };

  const STAGES = [
    { key: 'booked', label: 'ブッキング済' },
    { key: 'gate_in', label: '積地ターミナル搬入' },
    { key: 'loaded', label: '本船積込' },
    { key: 'sailing', label: '航海中' },
    { key: 'arrived', label: '揚地到着' },
    { key: 'customs', label: '通関中' },
    { key: 'delivered', label: '配送完了' },
  ];

  function normalizeContainerNo(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // ISO 6346 チェックデジット。形式: 英字4 + 数字7（最後が検査数字）
  function isValidContainerNo(s) {
    const n = normalizeContainerNo(s);
    if (!/^[A-Z]{3}[UJZ][0-9]{7}$/.test(n)) return false;
    let sum = 0;
    let val = 10;
    const letter = {};
    for (let c = 65; c <= 90; c++) {
      if (val % 11 === 0) val++;
      letter[String.fromCharCode(c)] = val++;
    }
    for (let i = 0; i < 10; i++) {
      const ch = n[i];
      const v = /[A-Z]/.test(ch) ? letter[ch] : Number(ch);
      sum += v * Math.pow(2, i);
    }
    return (sum % 11) % 10 === Number(n[10]);
  }

  function carrierOf(containerNo) {
    return CARRIERS[normalizeContainerNo(containerNo).slice(0, 4)] || '不明';
  }

  function stageIndex(key) {
    const i = STAGES.findIndex((s) => s.key === key);
    return i < 0 ? 0 : i;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // 出港〜到着予定の経過時間から航海の進捗(0..1)を推定する。実績が無いときの目安
  function voyageProgress(s, now) {
    const etd = Date.parse(s.etd);
    const eta = Date.parse(s.eta);
    if (!isFinite(etd) || !isFinite(eta) || eta <= etd) return stageIndex(s.stage) >= 4 ? 1 : 0;
    const t = ((now == null ? Date.now() : now) - etd) / (eta - etd);
    return Math.max(0, Math.min(1, t));
  }

  // 現在位置（大圏でなく直線補間の目安）。航海中のみ補間、それ以外は港
  function estimatePosition(s, now) {
    const from = PORTS[s.pol];
    const to = PORTS[s.pod];
    if (!from || !to) return null;
    const idx = stageIndex(s.stage);
    if (idx < 3) return { lat: from.lat, lon: from.lon, p: 0 };
    if (idx >= 4) return { lat: to.lat, lon: to.lon, p: 1 };
    const p = voyageProgress(s, now);
    return { lat: from.lat + (to.lat - from.lat) * p, lon: from.lon + (to.lon - from.lon) * p, p };
  }

  // 遅延日数（ETA超過、未到着のみ）と、ETA/最新イベントの差
  function delayDays(s, now) {
    if (stageIndex(s.stage) >= 4) return 0;
    const eta = Date.parse(s.eta);
    if (!isFinite(eta)) return 0;
    const d = Math.floor(((now == null ? Date.now() : now) - eta) / 86400000);
    return d > 0 ? d : 0;
  }

  function daysToEta(s, now) {
    const eta = Date.parse(s.eta);
    if (!isFinite(eta)) return null;
    return Math.ceil((eta - (now == null ? Date.now() : now)) / 86400000);
  }

  function alertsFor(s, now) {
    const out = [];
    const late = delayDays(s, now);
    if (late > 0) out.push({ level: 'danger', text: 'ETA を ' + late + ' 日超過しています' });
    const left = daysToEta(s, now);
    if (stageIndex(s.stage) < 4 && left != null && left >= 0 && left <= 3) out.push({ level: 'warn', text: '到着まであと ' + left + ' 日' });
    if (stageIndex(s.stage) >= 4 && stageIndex(s.stage) < 6 && s.freeTimeEnd) {
      const f = Math.ceil((Date.parse(s.freeTimeEnd) - (now == null ? Date.now() : now)) / 86400000);
      if (f <= 0) out.push({ level: 'danger', text: 'フリータイム終了（デマレージ発生中）' });
      else if (f <= 2) out.push({ level: 'warn', text: 'フリータイム残り ' + f + ' 日' });
    }
    if (!isValidContainerNo(s.containerNo)) out.push({ level: 'warn', text: 'コンテナ番号のチェックデジットが不正です' });
    return out;
  }

  // ---- CSV ----
  const CSV_COLS = ['containerNo', 'bookingNo', 'blNo', 'vessel', 'voyage', 'pol', 'pod', 'etd', 'eta', 'stage', 'freeTimeEnd', 'lot', 'producer', 'buyer', 'note'];

  function csvEscape(v) {
    const t = v == null ? '' : String(v);
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  function toCsv(list) {
    return [CSV_COLS.join(',')].concat(list.map((s) => CSV_COLS.map((c) => csvEscape(s[c])).join(','))).join('\r\n');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    const src = String(text).replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const o = {};
      head.forEach((h, i) => { if (CSV_COLS.includes(h)) o[h] = (r[i] || '').trim(); });
      o.containerNo = normalizeContainerNo(o.containerNo);
      if (!STAGES.some((s) => s.key === o.stage)) o.stage = 'booked';
      return o;
    }).filter((o) => o.containerNo);
  }

  const api = { PORTS, CARRIERS, STAGES, CSV_COLS, normalizeContainerNo, isValidContainerNo, carrierOf, stageIndex, haversineKm, voyageProgress, estimatePosition, delayDays, daysToEta, alertsFor, toCsv, parseCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
