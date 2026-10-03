import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSettlements, computeDashboard, computeSales, monthKey } from '../src/logic.mjs';

const NOW = new Date('2026-10-15T03:00:00Z');
const o = (id, date, amount, status = '納品完了', shipDate = date) => ({ id, date, amount, status, shipDate, product: 'A', productId: 'PR1', qty: 1, unit: '箱', buyer: 'B' });
const orders = [
  o('O00001', '2026-07-10', 100000), o('O00002', '2026-08-05', 200000), o('O00003', '2026-09-03', 300000), o('O00004', '2026-09-20', 150000),
  o('O00005', '2026-10-02', 400000), o('O00006', '2026-10-14', 50000, '出荷準備中', '2026-10-16'), o('O00007', '2026-10-13', 70000, '注文確定', '2026-10-30'),
];
const d = { orders, products: [{ stock: 5, safety: 10 }, { stock: 50, safety: 10 }] };

test('monthKey は月またぎ・年またぎでも正しい', () => {
  assert.equal(monthKey(0, NOW), '2026-10'); assert.equal(monthKey(-1, NOW), '2026-09'); assert.equal(monthKey(-10, NOW), '2025-12'); assert.equal(monthKey(3, NOW), '2027-01');
});

test('精算：売上＝月合計、手数料8%四捨五入、振込＝売上−手数料、振込は翌月末', () => {
  const s = computeSettlements(orders, NOW);
  assert.deepEqual(s.map((x) => x.month), ['2026-07', '2026-08', '2026-09', '2026-10']);
  const sep = s.find((x) => x.month === '2026-09');
  assert.equal(sep.sales, 450000); assert.equal(sep.fee, 36000); assert.equal(sep.payout, 414000); assert.equal(sep.transferDate, '2026-10-31'); assert.equal(sep.status, '振込予定');
  assert.equal(s.find((x) => x.month === '2026-08').status, '振込済み'); // 2026-09-30 < 今日
  assert.equal(s.find((x) => x.month === '2026-10').status, '集計中');
  for (const x of s) assert.equal(x.sales - x.fee, x.payout);
  assert.equal(computeSettlements([o('O00009', '2026-10-01', 1234)], NOW).at(-1).fee, 99); // 98.72 → 99
});

test('ダッシュボード：売上・件数・前月同日比・出荷予定・振込予定額', () => {
  const r = computeDashboard(d, 2, NOW);
  assert.equal(r.orders.count, 3);                       // 10月: 5,6,7
  assert.equal(r.sales.amount, 520000);                  // 400000+50000+70000
  // 前月(9月)の15日まで = O00003 のみ(300000)。 520000/300000 = +73%
  assert.equal(r.sales.diff, 73);
  assert.equal(r.orders.diff, 200);                      // 3件 vs 1件
  assert.equal(r.shipments, 1);                          // 10/16 は7日以内、10/30 は範囲外
  assert.equal(r.payout.amount, 414000); assert.equal(r.payout.month, '2026-09');
  assert.equal(r.lowStock, 1); assert.equal(r.unread, 2);
  assert.equal(r.chart.length, 7); assert.equal(r.chart.at(-1).amount, r.sales.amount);
  assert.equal(r.recent.length, 5);
});

test('前月の実績が0のとき前月比は null（ゼロ除算しない）', () => {
  assert.equal(computeDashboard({ orders: [o('O00001', '2026-10-02', 1000)], products: [] }, 0, NOW).sales.diff, null);
});

test('売上サマリー：月別合計＝商品別合計＝全注文合計', () => {
  const s = computeSales(d);
  const all = orders.reduce((a, x) => a + x.amount, 0);
  assert.equal(s.months.reduce((a, m) => a + m.amount, 0), all);
  assert.equal(s.products.reduce((a, m) => a + m.amount, 0), all);
});
