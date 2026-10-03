// 数値の計算ロジック（サーバーとデモ版で共通。外部依存なし・純粋関数のみ）
const FEE_RATE = 0.08;
const ymd = (d) => d.toISOString().slice(0, 10);
const monthKey = (offset = 0, now = new Date()) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)); return d.toISOString().slice(0, 7); };
const sumBy = (orders, pred) => orders.filter(pred).reduce((s, o) => s + o.amount, 0);

/** 月次精算：売上＝その月の注文金額の合計、手数料8%（四捨五入）、振込は翌月末 */
function computeSettlements(orders, now = new Date()) {
  const today = ymd(now);
  const rows = [];
  for (let m = -3; m <= 0; m++) {
    const key = monthKey(m, now);
    const sales = sumBy(orders, (o) => o.date.startsWith(key));
    const fee = Math.round(sales * FEE_RATE);
    const [y, mo] = key.split('-').map(Number);
    const transferDate = ymd(new Date(Date.UTC(y, mo + 1, 0))); // 翌月末
    rows.push({ month: key, sales, fee, payout: sales - fee, transferDate, status: m === 0 ? '集計中' : transferDate < today ? '振込済み' : '振込予定' });
  }
  return rows;
}

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

/** ダッシュボード：前月比は「前月の同じ日まで」と比べる（月の途中でも公平に比較）。出荷予定は今日から7日以内（期限超過を含む） */
function computeDashboard(d, unread, now = new Date()) {
  const cur = monthKey(0, now), prev = monthKey(-1, now), day = now.getUTCDate();
  const inCur = (o) => o.date.startsWith(cur);
  const inPrevToDate = (o) => o.date.startsWith(prev) && Number(o.date.slice(8, 10)) <= day;
  const limit = ymd(new Date(now.getTime() + 6 * 864e5));
  const settlements = computeSettlements(d.orders, now);
  const next = settlements.find((s) => s.status === '振込予定') || settlements.at(-1);
  return {
    orders: { count: d.orders.filter(inCur).length, diff: pct(d.orders.filter(inCur).length, d.orders.filter(inPrevToDate).length) },
    shipments: d.orders.filter((o) => (o.status === '注文確定' || o.status === '出荷準備中') && o.shipDate <= limit).length,
    sales: { amount: sumBy(d.orders, inCur), diff: pct(sumBy(d.orders, inCur), sumBy(d.orders, inPrevToDate)) },
    payout: { amount: next.payout, month: next.month, transferDate: next.transferDate },
    chart: Array.from({ length: 7 }, (_, i) => monthKey(i - 6, now)).map((k) => ({ month: k, amount: sumBy(d.orders, (o) => o.date.startsWith(k)) })),
    recent: [...d.orders].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5),
    unread,
    lowStock: d.products.filter((x) => x.stock <= x.safety).length,
  };
}

function computeSales(d) {
  const byMonth = {}, byProduct = {};
  for (const o of d.orders) { const k = o.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + o.amount; byProduct[o.product] = (byProduct[o.product] || 0) + o.amount; }
  return { months: Object.keys(byMonth).sort().map((k) => ({ month: k, amount: byMonth[k] })), products: Object.entries(byProduct).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) };
}

export { FEE_RATE, monthKey, computeSettlements, computeDashboard, computeSales };
