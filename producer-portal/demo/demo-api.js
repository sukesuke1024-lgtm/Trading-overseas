// GitHub Pages / 共有ページ用デモ：/api/* をブラウザ内（localStorage）で擬似的に処理します。
// 数値の計算は src/logic.mjs（logic.js として同梱）をサーバーと共通で使います。
// ※ 認証・CSRF・ロックなどのセキュリティ機能は本物ではありません（デモ専用）。
(() => {
  const KEY = 'hlink-producer-demo-v2', SES = 'hlink-producer-demo-session', IDLE = 30 * 60e3;
  const CATEGORIES = ['grain', 'veg', 'fruit', 'bean', 'other'];
  const realFetch = window.fetch.bind(window);
  let db = null, mem = null, hist = [];
  const load = async () => {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { /* 破損・無効 */ }
    if (!db) { const el = document.getElementById('demo-data'); db = el ? JSON.parse(el.textContent) : await (await realFetch(new URL('demo-data.json', document.baseURI))).json(); }
    return db;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 容量/無効 */ } };
  const J = (status, body, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: typeof body === 'string' ? headers : { 'Content-Type': 'application/json', ...headers } });
  const err = (s, m, extra) => J(s, { error: m, ...extra });
  const sid = () => { try { return sessionStorage.getItem(SES) || mem; } catch { return mem; } };
  const log = (action) => { hist.push({ at: new Date().toISOString(), action, ip: '192.168.*.*' }); };
  const FLOW = { '注文確定': '出荷準備中', '出荷準備中': '出荷済み' };
  const need = (v, n, l) => { if (typeof v !== 'string' || !v.trim()) throw new Error(`${l}を入力してください。`); if (v.length > n) throw new Error(`${l}は${n}文字以内にしてください。`); return v.trim(); };
  const num = (v, l) => { if (!Number.isInteger(v) || v < 0 || v > 10_000_000) throw new Error(`${l}は0以上の整数で入力してください。`); return v; };

  async function route(path, method, body) {
    await load();
    if (path === '/api/login' && method === 'POST') {
      const id = String(body.id || '').trim().toUpperCase();
      const p = db.producers.find((x) => x.id === id);
      if (!p || body.password !== 'demo') return err(401, '生産者IDまたはパスワードが正しくありません。');
      const prev = [...hist].reverse().find((a) => a.action === 'login');
      mem = id; try { sessionStorage.setItem(SES, id); } catch { /* 無効 */ }
      log('login');
      return J(200, { ok: true, csrf: 'demo', mustChange: false, idleMs: IDLE, prevLogin: prev ? { at: prev.at, ip: prev.ip } : null, producer: { id: p.id, name: p.name, owner: p.owner } });
    }
    const pid = sid(), p = db.producers.find((x) => x.id === pid);
    if (path === '/api/me') return p ? J(200, { csrf: 'demo', mustChange: false, idleMs: IDLE, prevLogin: null, producer: { id: p.id, name: p.name, owner: p.owner, email: p.email } }) : err(401, 'ログインが必要です。');
    if (!p) return err(401, 'ログインの有効期限が切れました。もう一度ログインしてください。');
    const end = () => { mem = null; try { sessionStorage.removeItem(SES); } catch { /* 無効 */ } };
    if (path === '/api/logout') { log('logout'); end(); return J(200, { ok: true }); }
    if (path === '/api/logout-all') { log('logout_all'); end(); return J(200, { ok: true }); }
    if (path === '/api/password') return J(200, { ok: true }); // デモでは変更しない
    if (path === '/api/account') return J(200, { producer: { id: p.id, name: p.name, owner: p.owner, email: p.email }, history: [...hist].reverse().slice(0, 15), idleMinutes: IDLE / 60e3 });
    const d = db.data[p.id]; let r;
    try {
      if (path === '/api/dashboard') return J(200, computeDashboard(d, db.notices.filter((n) => !d.read.includes(n.id)).length));
      if ((r = path.match(/^\/api\/orders\/(O\d{5})$/)) && method === 'GET') { const o = d.orders.find((x) => x.id === r[1]); return o ? J(200, { order: o }) : err(404, '注文が見つかりません。'); }
      if (path === '/api/orders') return J(200, { orders: [...d.orders].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) });
      if ((r = path.match(/^\/api\/orders\/(O\d{5})\/advance$/))) {
        const o = d.orders.find((x) => x.id === r[1]); if (!o) return err(404, '注文が見つかりません。');
        const next = FLOW[o.status]; if (!next) return err(409, `「${o.status}」の注文は、これ以上進められません。`);
        if (next === '出荷済み') { const pr = d.products.find((x) => x.id === o.productId); if (pr) { if (pr.stock < o.qty) return err(409, `在庫が足りません（現在 ${pr.stock}${pr.unit}）。在庫を更新してください。`); pr.stock -= o.qty; } }
        o.status = next; save(); return J(200, { order: o });
      }
      if (path === '/api/products' && method === 'GET') return J(200, { products: d.products });
      const pf = (b) => ({ name: need(b.name, 60, '商品名'), spec: String(b.spec || '').slice(0, 60), price: num(b.price, '単価'), unit: need(b.unit, 6, '単位'), safety: num(b.safety ?? 0, '安全在庫'), stock: num(b.stock ?? 0, '在庫数'), category: CATEGORIES.includes(b.category) ? b.category : 'other' });
      if (path === '/api/products' && method === 'POST') { const pr = { id: `PR${Math.random().toString(16).slice(2, 10)}`, ...pf(body) }; d.products.push(pr); save(); return J(201, { product: pr }); }
      if ((r = path.match(/^\/api\/products\/(PR\w+)$/))) {
        const pr = d.products.find((x) => x.id === r[1]); if (!pr) return err(404, '商品が見つかりません。');
        if (method === 'PUT') { Object.assign(pr, pf(body)); save(); return J(200, { product: pr }); }
        if (method === 'DELETE') { if (d.orders.some((o) => o.productId === pr.id && o.status !== '納品完了')) return err(409, '進行中の注文がある商品は削除できません。'); d.products = d.products.filter((x) => x !== pr); save(); return J(200, { ok: true }); }
      }
      if ((r = path.match(/^\/api\/products\/(PR\w+)\/stock$/))) { const pr = d.products.find((x) => x.id === r[1]); if (!pr) return err(404, '商品が見つかりません。'); pr.stock = num(body.stock, '在庫数'); save(); return J(200, { product: pr }); }
      if (path === '/api/lots' && method === 'GET') return J(200, { lots: [...d.lots].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)) });
      if (path === '/api/lots' && method === 'POST') {
        const pr = d.products.find((x) => x.id === body.productId); if (!pr) return err(400, '商品を選択してください。');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.harvestDate || '')) return err(400, '収穫日は日付で入力してください。');
        const lot = { id: `L${Math.random().toString(16).slice(2, 10)}`, lot: need(body.lot, 30, 'ロット番号'), productId: pr.id, product: pr.name, field: need(body.field, 40, '圃場・産地'), harvestDate: body.harvestDate, shipDate: body.shipDate || '', note: String(body.note || '').slice(0, 200) };
        d.lots.push(lot); save(); return J(201, { lot });
      }
      if (path === '/api/sales') return J(200, computeSales(d));
      if (path === '/api/settlements') return J(200, { settlements: computeSettlements(d.orders).reverse() });
      if ((r = path.match(/^\/api\/settlements\/(\d{4}-\d{2})\/csv$/))) {
        const s = computeSettlements(d.orders).find((x) => x.month === r[1]); if (!s) return err(404, '精算が見つかりません。');
        const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const rows = [['注文番号', '注文日', '取引先', '商品', '数量', '金額']].concat(d.orders.filter((o) => o.date.startsWith(s.month)).map((o) => [o.id, o.date, o.buyer, o.product, `${o.qty}${o.unit}`, o.amount]), [['売上合計', '', '', '', '', s.sales], ['手数料(8%)', '', '', '', '', -s.fee], ['振込額', '', '', '', '', s.payout]]);
        return J(200, '﻿' + rows.map((x) => x.map(esc).join(',')).join('\r\n'), { 'Content-Type': 'text/csv; charset=utf-8' });
      }
      if (path === '/api/notices') return J(200, { notices: [...db.notices].sort((a, b) => b.at.localeCompare(a.at)).map((n) => ({ ...n, read: d.read.includes(n.id) })) });
      if ((r = path.match(/^\/api\/notices\/(N\w+)\/read$/))) { if (!d.read.includes(r[1])) d.read.push(r[1]); save(); return J(200, { ok: true }); }
      if (path === '/api/tickets' && method === 'GET') return J(200, { tickets: [...d.tickets].reverse() });
      if (path === '/api/tickets' && method === 'POST') { const t = { id: `T${String(d.tickets.length + 1).padStart(4, '0')}`, at: new Date().toISOString(), subject: need(body.subject, 80, '件名'), body: need(body.body, 2000, '内容'), status: '受付中' }; d.tickets.push(t); save(); return J(201, { ticket: t }); }
    } catch (e) { return err(400, e.message); }
    return err(404, 'Not Found');
  }

  window.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!u.pathname.includes('/api/')) return realFetch(input, init);
    let body = {}; try { body = init.body ? JSON.parse(init.body) : {}; } catch { /* 空 */ }
    return route(u.pathname.slice(u.pathname.indexOf('/api/')), (init.method || 'GET').toUpperCase(), body);
  };
})();
