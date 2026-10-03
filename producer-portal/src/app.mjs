// HTTPサーバー本体：静的配信 + JSON API。認可はすべてサーバー側で行う。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { Sessions, RateLimiter, parseCookies, safeEqual, verifyPassword, hashPassword, passwordProblem, maskIp, DUMMY_HASH, SECURITY_HEADERS } from './security.mjs';
import { computeDashboard, computeSettlements, computeSales } from './logic.mjs';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const COOKIE = 'hl_sid';
const MAX_FAILS = 5, LOCK_MS = 15 * 60e3;
const FLOW = { '注文確定': '出荷準備中', '出荷準備中': '出荷済み' }; // 生産者が進められる状態遷移
const CATEGORIES = ['grain', 'veg', 'fruit', 'bean', 'other'];

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const str = (v, max, label, { required = true } = {}) => {
  if (typeof v !== 'string') { if (!required && v == null) return ''; throw new HttpError(400, `${label}を入力してください。`); }
  const t = v.trim();
  if (required && !t) throw new HttpError(400, `${label}を入力してください。`);
  if (t.length > max) throw new HttpError(400, `${label}は${max}文字以内にしてください。`);
  return t;
};
const int = (v, min, max, label) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new HttpError(400, `${label}は${min}〜${max}の整数で入力してください。`);
  return v;
};
const dateStr = (v, label) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(400, `${label}は日付（YYYY-MM-DD）で入力してください。`); return v; };

export function createApp(store, { secureCookie = false, trustProxy = false, loginIpMax = 20, idleMs = 30 * 60e3 } = {}) {
  const sessions = new Sessions({ idleMs });
  const loginIpLimit = new RateLimiter(loginIpMax, 10 * 60e3);
  const apiLimit = new RateLimiter(300, 60e3);
  const timer = setInterval(() => { sessions.sweep(); loginIpLimit.sweep(); apiLimit.sweep(); }, 60e3); timer.unref();

  const clientIp = (req) => (trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '-';

  function send(res, status, body, headers = {}) {
    const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
    res.writeHead(status, { ...SECURITY_HEADERS, ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...headers });
    res.end(isObj ? JSON.stringify(body) : body);
  }

  function setCookie(res, token, maxAge) {
    const v = `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', v);
  }

  async function readJson(req) {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Content-Type は application/json にしてください。');
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 64 * 1024) throw new HttpError(413, 'リクエストが大きすぎます。'); chunks.push(c); }
    try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (j === null || typeof j !== 'object' || Array.isArray(j)) throw 0; return j; } catch { throw new HttpError(400, 'JSON の形式が正しくありません。'); }
  }

  async function handleApi(req, res, url) {
    const ip = clientIp(req);
    const method = req.method;
    const lim = apiLimit.take(ip);
    if (!lim.ok) throw new HttpError(429, 'リクエストが多すぎます。しばらくしてからお試しください。', { retryAfter: lim.retryAfter });
    const headers = { 'Cache-Control': 'no-store' };
    const out = (status, body, extra = {}) => send(res, status, body, { ...headers, ...extra });

    // 変更系は Origin を検証（CSRF 多層防御）
    const mutating = method !== 'GET' && method !== 'HEAD';
    if (mutating) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, '不正なリクエスト元です。');
    }

    const token = parseCookies(req.headers.cookie)[COOKIE];

    // ---- 認証前 ----
    if (url.pathname === '/api/login' && method === 'POST') {
      const l = loginIpLimit.take(ip);
      if (!l.ok) throw new HttpError(429, '試行回数が多すぎます。しばらくしてからお試しください。', { retryAfter: l.retryAfter });
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id.trim().toUpperCase().slice(0, 32) : '';
      const pw = typeof body.password === 'string' ? body.password.slice(0, 256) : '';
      const p = store.producer(id);
      const now = Date.now();
      const generic = () => new HttpError(401, '生産者IDまたはパスワードが正しくありません。');
      if (p && p.lockUntil > now) {
        verifyPassword(pw, DUMMY_HASH);
        store.audit(id, 'login_locked', ip);
        throw new HttpError(423, 'アカウントが一時的にロックされています。時間をおいて再度お試しください。', { retryAfter: Math.ceil((p.lockUntil - now) / 1000) });
      }
      const ok = verifyPassword(pw, p ? p.pw : DUMMY_HASH) && !!p;
      if (!ok) {
        if (p) {
          p.failed++; store.audit(id, 'login_failed', ip);
          const justLocked = p.failed >= MAX_FAILS;
          if (justLocked) { p.lockUntil = now + LOCK_MS; p.failed = 0; store.audit(id, 'locked', ip); }
          store.save();
          if (justLocked) throw new HttpError(423, 'ログインに5回失敗したため、アカウントを15分間ロックしました。', { retryAfter: LOCK_MS / 1000 });
        }
        throw generic();
      }
      p.failed = 0; p.lockUntil = 0;
      sessions.destroy(token); // セッション固定化対策：ログインのたびに新しいIDを発行
      const prev = [...store.db.audit].reverse().find((a) => a.producerId === p.id && a.action === 'login');
      const t = sessions.create(p.id, !!p.mustChange, { prevLogin: prev ? { at: prev.at, ip: maskIp(prev.ip) } : null });
      store.audit(p.id, 'login', ip); store.save();
      setCookie(res, t, 12 * 3600);
      const s = sessions.get(t);
      return out(200, { ok: true, csrf: s.csrf, mustChange: s.mustChange, idleMs, prevLogin: s.prevLogin, producer: { id: p.id, name: p.name, owner: p.owner } });
    }

    const sess = sessions.get(token);
    if (url.pathname === '/api/me' && method === 'GET') {
      if (!sess) return out(401, { error: 'ログインが必要です。' });
      const p = store.producer(sess.producerId);
      return out(200, { csrf: sess.csrf, mustChange: sess.mustChange, idleMs, prevLogin: sess.prevLogin, producer: { id: p.id, name: p.name, owner: p.owner, email: p.email } });
    }
    if (!sess) throw new HttpError(401, 'ログインの有効期限が切れました。もう一度ログインしてください。');

    if (mutating && !safeEqual(req.headers['x-csrf-token'] || '', sess.csrf)) throw new HttpError(403, 'セキュリティトークンが無効です。ページを再読み込みしてください。');

    if (url.pathname === '/api/logout' && method === 'POST') {
      sessions.destroy(token); store.audit(sess.producerId, 'logout', ip); store.save();
      setCookie(res, '', 0);
      return out(200, { ok: true });
    }

    const p = store.producer(sess.producerId);
    if (url.pathname === '/api/logout-all' && method === 'POST') {
      sessions.destroyAllFor(p.id); store.audit(p.id, 'logout_all', ip); store.save(); setCookie(res, '', 0);
      return out(200, { ok: true });
    }
    if (url.pathname === '/api/account' && method === 'GET') {
      const history = store.db.audit.filter((a) => a.producerId === p.id && ['login', 'login_failed', 'locked', 'logout', 'logout_all', 'password_changed'].includes(a.action)).slice(-15).reverse().map((a) => ({ at: a.at, action: a.action, ip: maskIp(a.ip) }));
      return out(200, { producer: { id: p.id, name: p.name, owner: p.owner, email: p.email }, history, idleMinutes: Math.round(idleMs / 60e3) });
    }
    if (url.pathname === '/api/password' && method === 'POST') {
      const b = await readJson(req);
      if (typeof b.current !== 'string' || !verifyPassword(b.current, p.pw)) throw new HttpError(400, '現在のパスワードが正しくありません。');
      const problem = passwordProblem(b.next, p.id);
      if (problem) throw new HttpError(400, problem);
      if (b.next === b.current) throw new HttpError(400, '現在と異なるパスワードにしてください。');
      p.pw = hashPassword(b.next); p.mustChange = false; sess.mustChange = false;
      sessions.destroyAllFor(p.id, token); // 他端末のセッションを失効
      store.audit(p.id, 'password_changed', ip); store.save();
      return out(200, { ok: true });
    }
    if (sess.mustChange) throw new HttpError(403, '初回ログインのため、パスワードを変更してください。', { code: 'password_change_required' });

    const d = store.db.data[p.id];
    const m = (re) => url.pathname.match(re);
    let r;

    if (url.pathname === '/api/dashboard' && method === 'GET') return out(200, computeDashboard(d, store.db.notices.filter((n) => !d.read.includes(n.id)).length));

    // 注文
    if ((r = m(/^\/api\/orders\/(O\d{5})$/)) && method === 'GET') { const o = d.orders.find((x) => x.id === r[1]); if (!o) throw new HttpError(404, '注文が見つかりません。'); return out(200, { order: o }); }
    if (url.pathname === '/api/orders' && method === 'GET') return out(200, { orders: [...d.orders].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)) });
    if ((r = m(/^\/api\/orders\/(O\d{5})\/advance$/)) && method === 'POST') {
      const o = d.orders.find((x) => x.id === r[1]);
      if (!o) throw new HttpError(404, '注文が見つかりません。');
      const next = FLOW[o.status];
      if (!next) throw new HttpError(409, `「${o.status}」の注文は、これ以上進められません。`);
      if (next === '出荷済み') { const pr = d.products.find((x) => x.id === o.productId); if (pr) { if (pr.stock < o.qty) throw new HttpError(409, `在庫が足りません（現在 ${pr.stock}${pr.unit}）。在庫を更新してください。`); pr.stock -= o.qty; } }
      o.status = next; store.audit(p.id, `order_${o.id}_${next}`, ip); store.save();
      return out(200, { order: o });
    }

    // 商品
    if (url.pathname === '/api/products' && method === 'GET') return out(200, { products: d.products });
    const productFields = (b) => ({ name: str(b.name, 60, '商品名'), spec: str(b.spec, 60, '規格', { required: false }), price: int(b.price, 0, 10_000_000, '単価'), unit: str(b.unit, 6, '単位'), safety: int(b.safety ?? 0, 0, 100000, '安全在庫'), stock: int(b.stock ?? 0, 0, 1_000_000, '在庫数'), category: CATEGORIES.includes(b.category) ? b.category : 'other' });
    if (url.pathname === '/api/products' && method === 'POST') {
      if (d.products.length >= 200) throw new HttpError(409, '登録できる商品数の上限です。');
      const pr = { id: `PR${crypto.randomBytes(4).toString('hex')}`, ...productFields(await readJson(req)) };
      d.products.push(pr); store.audit(p.id, `product_add_${pr.id}`, ip); store.save();
      return out(201, { product: pr });
    }
    if ((r = m(/^\/api\/products\/(PR[\w]+)$/))) {
      const pr = d.products.find((x) => x.id === r[1]);
      if (!pr) throw new HttpError(404, '商品が見つかりません。');
      if (method === 'PUT') { Object.assign(pr, productFields(await readJson(req))); store.audit(p.id, `product_edit_${pr.id}`, ip); store.save(); return out(200, { product: pr }); }
      if (method === 'DELETE') {
        if (d.orders.some((o) => o.productId === pr.id && o.status !== '納品完了')) throw new HttpError(409, '進行中の注文がある商品は削除できません。');
        d.products = d.products.filter((x) => x !== pr); store.audit(p.id, `product_del_${pr.id}`, ip); store.save(); return out(200, { ok: true });
      }
    }
    if ((r = m(/^\/api\/products\/(PR[\w]+)\/stock$/)) && method === 'POST') {
      const pr = d.products.find((x) => x.id === r[1]);
      if (!pr) throw new HttpError(404, '商品が見つかりません。');
      pr.stock = int((await readJson(req)).stock, 0, 1_000_000, '在庫数'); store.audit(p.id, `stock_${pr.id}_${pr.stock}`, ip); store.save();
      return out(200, { product: pr });
    }

    // ロット（トレーサビリティ）
    if (url.pathname === '/api/lots' && method === 'GET') return out(200, { lots: [...d.lots].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)) });
    if (url.pathname === '/api/lots' && method === 'POST') {
      const b = await readJson(req);
      const pr = d.products.find((x) => x.id === b.productId);
      if (!pr) throw new HttpError(400, '商品を選択してください。');
      if (d.lots.length >= 2000) throw new HttpError(409, '登録できるロット数の上限です。');
      const lot = { id: `L${crypto.randomBytes(4).toString('hex')}`, lot: str(b.lot, 30, 'ロット番号'), productId: pr.id, product: pr.name, field: str(b.field, 40, '圃場・産地'), harvestDate: dateStr(b.harvestDate, '収穫日'), shipDate: b.shipDate ? dateStr(b.shipDate, '出荷日') : '', note: str(b.note, 200, '備考', { required: false }) };
      d.lots.push(lot); store.audit(p.id, `lot_add_${lot.id}`, ip); store.save();
      return out(201, { lot });
    }

    // 売上・精算
    if (url.pathname === '/api/sales' && method === 'GET') return out(200, computeSales(d));
    if (url.pathname === '/api/settlements' && method === 'GET') return out(200, { settlements: computeSettlements(d.orders).reverse() });
    if ((r = m(/^\/api\/settlements\/(\d{4}-\d{2})\/csv$/)) && method === 'GET') {
      const s = computeSettlements(d.orders).find((x) => x.month === r[1]);
      if (!s) throw new HttpError(404, '精算が見つかりません。');
      const esc = (v) => { let t = String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; }; // CSVインジェクション対策
      const rows = [['注文番号', '注文日', '取引先', '商品', '数量', '金額']].concat(d.orders.filter((o) => o.date.startsWith(s.month)).map((o) => [o.id, o.date, o.buyer, o.product, `${o.qty}${o.unit}`, o.amount]));
      rows.push([], ['売上合計', '', '', '', '', s.sales], ['手数料(8%)', '', '', '', '', -s.fee], ['振込額', '', '', '', '', s.payout]);
      return send(res, 200, '﻿' + rows.map((x) => x.map(esc).join(',')).join('\r\n'), { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="settlement-${s.month}.csv"` });
    }

    // お知らせ
    if (url.pathname === '/api/notices' && method === 'GET') return out(200, { notices: [...store.db.notices].sort((a, b) => b.at.localeCompare(a.at)).map((n) => ({ ...n, read: d.read.includes(n.id) })) });
    if ((r = m(/^\/api\/notices\/(N\w+)\/read$/)) && method === 'POST') {
      if (!store.db.notices.some((n) => n.id === r[1])) throw new HttpError(404, 'お知らせが見つかりません。');
      if (!d.read.includes(r[1])) d.read.push(r[1]); store.save(); return out(200, { ok: true });
    }

    // サポート
    if (url.pathname === '/api/tickets' && method === 'GET') return out(200, { tickets: [...d.tickets].reverse() });
    if (url.pathname === '/api/tickets' && method === 'POST') {
      const b = await readJson(req);
      if (d.tickets.length >= 500) throw new HttpError(409, 'チケット数の上限です。');
      const t = { id: `T${String(d.tickets.length + 1).padStart(4, '0')}`, at: new Date().toISOString(), subject: str(b.subject, 80, '件名'), body: str(b.body, 2000, '内容'), status: '受付中' };
      d.tickets.push(t); store.audit(p.id, `ticket_${t.id}`, ip); store.save();
      return out(201, { ticket: t });
    }
    throw new HttpError(404, 'Not Found');
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad Request'); }
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || rel.includes('\0')) return send(res, 404, 'Not Found');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'Not Found');
      const ext = path.extname(file);
      send(res, 200, buf, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache' });
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (secureCookie) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      const status = e instanceof HttpError ? e.status : 500;
      const body = { error: e instanceof HttpError ? e.message : 'サーバーでエラーが発生しました。', ...(e.extra || {}) };
      if (res.headersSent) return res.end();
      send(res, status, body, { 'Cache-Control': 'no-store', ...(e.extra?.retryAfter ? { 'Retry-After': String(e.extra.retryAfter) } : {}) });
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.on('close', () => clearInterval(timer));
  return server;
}
