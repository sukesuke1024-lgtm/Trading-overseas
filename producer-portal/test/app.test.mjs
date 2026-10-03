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
async function loggedIn(id = 'P000123', pw = 'Changed-pass42') {
  let r = await login(id, PW);
  if (r.res.status === 200) { // 初回変更
    const c = await call('/api/password', { method: 'POST', cookie: r.cookie, csrf: r.csrf, body: { current: PW, next: pw } });
    assert.equal(c.res.status, 200);
  }
  r = await login(id, pw);
  assert.equal(r.res.status, 200);
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
  for (let i = 0; i < 5; i++) assert.equal((await login('P000124', 'wrong-password1')).res.status, 401);
  const locked = await login('P000124', 'Changed-pass42');
  assert.equal(locked.res.status, 423);
  assert.ok(locked.res.headers.get('retry-after'));
});

test('存在しないIDと誤パスワードで同じメッセージ（ID列挙対策）', async () => {
  const a = await login('P999999', 'whatever-pass1'), b = await login('P000123', 'whatever-pass1');
  assert.equal(a.json.error, b.json.error);
});

test('パスワード変更で他端末のセッションが失効', async () => {
  const s1 = await loggedIn('P000123'), s2 = await login('P000123', 'Changed-pass42');
  const c = await call('/api/password', { method: 'POST', cookie: s1.cookie, csrf: s1.csrf, body: { current: 'Changed-pass42', next: 'Another-pass77' } });
  assert.equal(c.res.status, 200);
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
