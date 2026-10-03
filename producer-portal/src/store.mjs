// JSONファイルの簡易ストア（原子的書き込み）＋ 初期データ
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from './security.mjs';

export class Store {
  constructor(file) { this.file = file; this.db = null; }

  load(initialPassword) {
    if (fs.existsSync(this.file)) { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); return { created: false }; }
    this.db = seed(initialPassword);
    this.save();
    return { created: true };
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  producer(id) { return this.db.producers.find((p) => p.id === id); }
  audit(producerId, action, ip) {
    this.db.audit.push({ at: new Date().toISOString(), producerId, action, ip });
    if (this.db.audit.length > 2000) this.db.audit.splice(0, this.db.audit.length - 2000);
  }
}

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };

export function seed(initialPassword) {
  const pw = hashPassword(initialPassword);
  const producers = [
    { id: 'P000123', name: '山田農園', owner: '山田 太郎', email: 'yamada@example.com', pw, mustChange: true, failed: 0, lockUntil: 0 },
    { id: 'P000124', name: '佐藤果樹園', owner: '佐藤 花子', email: 'sato@example.com', pw, mustChange: true, failed: 0, lockUntil: 0 },
  ];
  const data = {};
  for (const p of producers) data[p.id] = seedProducer(p.id === 'P000123' ? 1 : 0.6, p.id);
  const notices = [
    { id: 'N1', at: ymd(addDays(-1)) + 'T14:20:00Z', title: '出荷に関するお知らせ', body: '年末年始の集荷スケジュールを公開しました。12/28 以降の出荷は事前にご相談ください。' },
    { id: 'N2', at: ymd(addDays(-2)) + 'T10:15:00Z', title: '注文が確定されました', body: '株式会社グッドマートから新しい注文が確定しました。注文管理をご確認ください。' },
    { id: 'N3', at: ymd(addDays(-4)) + 'T09:00:00Z', title: '精算明細を公開しました', body: '先月分の精算明細を公開しました。精算・振込から確認・ダウンロードできます。' },
  ];
  return { producers, data, notices, audit: [] };
}

function seedProducer(scale, pid) {
  const rnd = (() => { let s = [...pid].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
  const products = [
    { id: 'PR1', name: '減農薬コシヒカリ', spec: '玄米 30kg', price: 14500, stock: 120, safety: 40, unit: '袋', category: 'grain' },
    { id: 'PR2', name: '完熟トマト', spec: '4kg箱', price: 3200, stock: 85, safety: 30, unit: '箱', category: 'veg' },
    { id: 'PR3', name: '黒豆（丹波種）', spec: '1kg袋 ×10', price: 9800, stock: 14, safety: 20, unit: '箱', category: 'bean' },
    { id: 'PR4', name: 'シャインマスカット', spec: '2房 約1.2kg', price: 5400, stock: 36, safety: 25, unit: '箱', category: 'fruit' },
  ];
  const buyers = ['株式会社グッドマート', '札幌フーズ', '東京食材センター', 'みらい市場', '大阪フードリンク'];
  const orders = [];
  let seq = 1;
  // 過去7か月分 + 直近（月ごとに増加傾向）
  for (let m = -6; m <= 0; m++) {
    const base = Math.round((6 + (m + 6) * 2.2) * scale);
    const n = m === 0 ? Math.max(2, Math.round((base * new Date().getUTCDate()) / 30)) : base; // 今月は経過日数ぶん
    for (let i = 0; i < n; i++) {
      const pr = products[Math.floor(rnd() * products.length)];
      const qty = 5 + Math.floor(rnd() * 30);
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + m);
      const maxDay = m === 0 ? Math.max(1, new Date().getUTCDate()) : 27;
      d.setUTCDate(1 + Math.floor(rnd() * maxDay));
      orders.push({ id: `O${String(seq++).padStart(5, '0')}`, date: ymd(d), buyer: buyers[Math.floor(rnd() * buyers.length)], productId: pr.id, product: pr.name, qty, unit: pr.unit, amount: qty * pr.price, status: '納品完了', shipDate: ymd(new Date(d.getTime() + 2 * 864e5)) });
    }
  }
  // 進行中の注文（画面の見本と同様の状態）
  const live = [[0, '出荷準備中', 1], [-1, '出荷済み', -1], [-2, '注文確定', 3], [-3, '出荷準備中', 2], [-4, '出荷準備中', 4]];
  live.forEach(([off, status, ship], i) => {
    const pr = products[i % products.length];
    const qty = [24, 10, 30, 15, 20][i];
    orders.push({ id: `O${String(seq++).padStart(5, '0')}`, date: ymd(addDays(off)), buyer: buyers[i], productId: pr.id, product: pr.name, qty, unit: pr.unit, amount: qty * pr.price, status, shipDate: ymd(addDays(ship)) });
  });
  const lots = products.map((p, i) => ({ id: `L${i + 1}`, lot: `${new Date().getUTCFullYear()}-${String(i + 1).padStart(3, '0')}`, productId: p.id, product: p.name, field: ['第1圃場', '第2ハウス', '北圃場', '果樹園A'][i], harvestDate: ymd(addDays(-10 - i * 3)), shipDate: ymd(addDays(-6 - i * 3)), note: '残留農薬検査済み' }));
  return { products, orders, lots, tickets: [], read: [] };
}
