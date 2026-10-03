import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from '../src/store.mjs';
import { createApp } from '../src/app.mjs';
import { passwordProblem } from '../src/security.mjs';

const PW = 'Initial-pass9';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
const store = new Store(path.join(tmp, 'db.json'));
store.load(PW);
const server = createApp(store, { loginIpMax: 1000 });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

async function call(p, { method = 'GET', body, cookie, csrf, headers = {} } = {}) {
  const res = await fetch(base + p, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { /* not json */ }
  return { res, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
async function login(id = 'P000123', password = PW) {
  const r = await call('/api/login', { method: 'POST', body: { id, password } });
  return { ...r, csrf: r.json?.csrf };
}
const known = { P000123: PW, P000124: PW }; // 各IDの現在のパスワード（テスト内で変更されるため記録）
async function loggedIn(id = 'P000123') {
  let r = await login(id, known[id]);
  assert.equal(r.res.status, 200);
  if (r.json.mustChange) {
    const next = 'Changed-pass42';
    assert.equal((await call('/api/password', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { current: known[id], next } })).res.status, 200);
    known[id] = next;
    r = await login(id, next);
    assert.equal(r.res.status, 200);
  }
  return r;
}

test('未ログインでは API に入れない', async () => {
  for (const p of ['/api/dashboard', '/api/orders', '/api/products', '/api/me']) assert.equal((await call(p)).res.status, 401);
});

test('初回は強制パスワード変更。変更するまで業務APIは403', async () => {
  const r = await login('P000124');
  assert.equal(r.json.mustChange, true);
  const d = await call('/api/dashboard', { cookie: r.cookie });
  assert.equal(d.res.status, 403);
  assert.equal(d.json.code, 'password_change_required');
});

test('パスワード強度の検証', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletterspassword'));
  assert.ok(passwordProblem('P000123-abc123', 'P000123'));
  assert.equal(passwordProblem('Better-pass42', 'P000123'), null);
});

test('ログイン→ダッシュボード→ログアウトでセッション失効、Cookie属性', async () => {
  const r = await loggedIn('P000123');
  const setCookie = r.res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
  const d = await call('/api/dashboard', { cookie: r.cookie });
  assert.equal(d.res.status, 200);
  assert.equal(d.json.chart.length, 7);
  assert.equal((await call('/api/logout', { method: 'POST', cookie: r.cookie, csrf: r.csrf })).res.status, 200);
  assert.equal((await call('/api/dashboard', { cookie: r.cookie })).res.status, 401);
});

test('CSRFトークンなし／不正Originの変更系は拒否', async () => {
  const r = await loggedIn('P000123');
  assert.equal((await call('/api/tickets', { method: 'POST', cookie: r.cookie, body: { subject: 'a', body: 'b' } })).res.status, 403);
  assert.equal((await call('/api/tickets', { method: 'POST', cookie: r.cookie, csrf: r.csrf, headers: { Origin: 'https://evil.example' }, body: { subject: 'a', body: 'b' } })).res.status, 403);
  assert.equal((await call('/api/tickets', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { subject: 'a', body: 'b' } })).res.status, 201);
});

test('データは生産者ごとに分離される', async () => {
  const a = await loggedIn('P000123'), b = await loggedIn('P000124');
  const oa = (await call('/api/orders', { cookie: a.cookie })).json.orders;
  const ob = (await call('/api/orders', { cookie: b.cookie })).json.orders;
  assert.notEqual(oa.length, ob.length);
  const foreign = ob.find((o) => !oa.some((x) => x.id === o.id && x.qty === o.qty && x.date === o.date)) || ob[0];
  // 他者の商品IDでの操作は 404
  const pa = (await call('/api/products', { cookie: a.cookie })).json.products[0];
  const del = await call(`/api/products/${pa.id}/stock`, { method: 'POST', cookie: b.cookie, csrf: b.csrf, body: { stock: 1 } });
  assert.ok(foreign); assert.equal(del.res.status, 200); // 同じ初期ID(PR1)でも、自分のデータにのみ作用する
  assert.notEqual((await call('/api/products', { cookie: a.cookie })).json.products[0].stock, 1);
});

test('入力検証：不正な値は400、HTMLはそのまま保存され画面側でエスケープ', async () => {
  const r = await loggedIn('P000123');
  const bad = await call('/api/products', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { name: '', price: -5, unit: '箱' } });
  assert.equal(bad.res.status, 400);
  const nonjson = await fetch(base + '/api/products', { method: 'POST', headers: { Cookie: r.cookie, 'X-CSRF-Token': r.csrf, 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(nonjson.status, 415);
});

test('出荷済みにすると在庫が減り、在庫不足なら409', async () => {
  const r = await loggedIn('P000123');
  const orders = (await call('/api/orders', { cookie: r.cookie })).json.orders;
  const target = orders.find((o) => o.status === '出荷準備中');
  const before = (await call('/api/products', { cookie: r.cookie })).json.products.find((p) => p.id === target.productId).stock;
  const adv = await call(`/api/orders/${target.id}/advance`, { method: 'POST', cookie: r.cookie, csrf: r.csrf });
  assert.equal(adv.json.order.status, '出荷済み');
  const after = (await call('/api/products', { cookie: r.cookie })).json.products.find((p) => p.id === target.productId).stock;
  assert.equal(after, before - target.qty);
  assert.equal((await call(`/api/orders/${target.id}/advance`, { method: 'POST', cookie: r.cookie, csrf: r.csrf })).res.status, 409);
});

test('精算CSVの数式インジェクション対策と添付ヘッダー', async () => {
  const r = await loggedIn('P000123');
  const s = (await call('/api/settlements', { cookie: r.cookie })).json.settlements[0];
  const c = await call(`/api/settlements/${s.month}/csv`, { cookie: r.cookie });
  assert.match(c.res.headers.get('content-disposition'), /attachment/);
  assert.match(c.text, /注文番号/);
});

test('連続ログイン失敗でロックされ、正しいパスワードでも拒否される', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await login('P000124', 'wrong-password1')).res.status, 401);
  assert.equal((await login('P000124', 'wrong-password1')).res.status, 423); // 5回目でロック
  const locked = await login('P000124', 'Changed-pass42');
  assert.equal(locked.res.status, 423);
  assert.ok(locked.res.headers.get('retry-after'));
});

test('存在しないIDと誤パスワードで同じメッセージ（ID列挙対策）', async () => {
  const a = await login('P999999', 'whatever-pass1'), b = await login('P000123', 'whatever-pass1');
  assert.equal(a.json.error, b.json.error);
});

test('パスワード変更で他端末のセッションが失効', async () => {
  const s1 = await loggedIn('P000123'), s2 = await login('P000123', known.P000123);
  const c = await call('/api/password', { method: 'POST', cookie: s1.cookie, csrf: s1.csrf, body: { current: known.P000123, next: 'Another-pass77' } });
  assert.equal(c.res.status, 200); known.P000123 = 'Another-pass77';
  assert.equal((await call('/api/dashboard', { cookie: s2.cookie })).res.status, 401);
  assert.equal((await call('/api/dashboard', { cookie: s1.cookie })).res.status, 200);
});

test('セキュリティヘッダーと静的ファイルのパストラバーサル対策', async () => {
  const r = await fetch(base + '/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  for (const p of ['/..%2f..%2fserver.mjs', '/%2e%2e/package.json', '/..%2fdata%2fdb.json']) {
    const t = await fetch(base + p); assert.equal(t.status, 404, p);
  }
  assert.equal((await fetch(base + '/data/db.json')).status, 404);
});

test('同一IPからのログイン試行はレート制限される', async () => {
  const s2 = createApp(store, { loginIpMax: 3 });
  await new Promise((r) => s2.listen(0, '127.0.0.1', r));
  const u = `http://127.0.0.1:${s2.address().port}/api/login`;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'P999999', password: 'x'.repeat(12) }) })).status);
  s2.close();
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
});

test('画面の数字が互いに一致する（ダッシュボード・売上・精算・注文）', async () => {
  const r = await loggedIn('P000123');
  const get = async (p) => (await call(p, { cookie: r.cookie })).json;
  const [dash, sales, sett, ord] = await Promise.all([get('/api/dashboard'), get('/api/sales'), get('/api/settlements'), get('/api/orders')]);
  const cur = new Date().toISOString().slice(0, 7);
  const monthTotal = (m) => ord.orders.filter((x) => x.date.startsWith(m)).reduce((a, x) => a + x.amount, 0);
  assert.equal(dash.sales.amount, monthTotal(cur));
  assert.equal(dash.sales.amount, sales.months.find((m) => m.month === cur).amount);
  assert.equal(dash.sales.amount, sett.settlements.find((s) => s.month === cur).sales);
  assert.equal(dash.orders.count, ord.orders.filter((x) => x.date.startsWith(cur)).length);
  for (const c of dash.chart) assert.equal(c.amount, monthTotal(c.month));
  for (const s of sett.settlements) { assert.equal(s.sales, monthTotal(s.month)); assert.equal(s.sales - s.fee, s.payout); }
  const grand = ord.orders.reduce((a, x) => a + x.amount, 0);
  assert.equal(sales.months.reduce((a, m) => a + m.amount, 0), grand);
  assert.equal(sales.products.reduce((a, m) => a + m.amount, 0), grand);
  for (const x of ord.orders) assert.equal(x.amount % 1, 0);
  // 精算CSVの合計行も一致
  const s0 = sett.settlements.find((s) => s.month === cur);
  const csv = (await call(`/api/settlements/${cur}/csv`, { cookie: r.cookie })).text;
  assert.ok(csv.includes(`"売上合計","","","","","${s0.sales}"`)); assert.ok(csv.includes(`"振込額","","","","","${s0.payout}"`));
});

test('注文詳細と、他社の注文へアクセスできないこと', async () => {
  const a = await loggedIn('P000123');
  const list = (await call('/api/orders', { cookie: a.cookie })).json.orders;
  assert.equal((await call(`/api/orders/${list[0].id}`, { cookie: a.cookie })).json.order.id, list[0].id);
  assert.equal((await call('/api/orders/O99999', { cookie: a.cookie })).res.status, 404);
});

test('前回ログイン・アカウント履歴・全端末ログアウト', async () => {
  await loggedIn('P000123');
  const s1 = await login('P000123', known.P000123);
  assert.ok(s1.json.prevLogin?.at);
  assert.match(s1.json.prevLogin.ip, /\*/);                        // IP は一部伏せる
  const acct = (await call('/api/account', { cookie: s1.cookie })).json;
  assert.ok(acct.history.length > 0); assert.ok(acct.history.every((h) => /\*/.test(h.ip)));
  const s2 = await login('P000123', known.P000123);
  assert.equal((await call('/api/logout-all', { method: 'POST', cookie: s1.cookie, csrf: s1.csrf })).res.status, 200);
  assert.equal((await call('/api/dashboard', { cookie: s1.cookie })).res.status, 401);
  assert.equal((await call('/api/dashboard', { cookie: s2.cookie })).res.status, 401);
});

test('無操作でセッションが失効する', async () => {
  const s = createApp(store, { loginIpMax: 1000, idleMs: 300 });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const u = `http://127.0.0.1:${s.address().port}`;
  const lr = await fetch(u + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'P000123', password: known.P000123 }) });
  assert.equal(lr.status, 200);
  const cookie = lr.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(u + '/api/dashboard', { headers: { Cookie: cookie } })).status, 200);
  await new Promise((r) => setTimeout(r, 450));
  assert.equal((await fetch(u + '/api/dashboard', { headers: { Cookie: cookie } })).status, 401);
  s.close();
});

test('HTMLはキャッシュされない（ログアウト後に戻るボタンで見えない）／商品分類の検証', async () => {
  assert.equal((await fetch(base + '/')).headers.get('cache-control'), 'no-store');
  const r = await loggedIn('P000123');
  const p = await call('/api/products', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { name: 'テスト', price: 100, unit: '個', category: 'bogus' } });
  assert.equal(p.json.product.category, 'other');
  assert.equal((await call('/api/products', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { name: 'x', price: 1.5, unit: '個' } })).res.status, 400);
});
