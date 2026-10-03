import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const { createApp } = createRequire(import.meta.url)('../server/app.cjs');

async function boot() {
  const dir = mkdtempSync(join(tmpdir(), 'trk-'));
  const app = createApp({ dataDir: dir, distDir: dir, adminId: 'admin', adminPassword: 'Init-Pass-1234', providers: { domestic: async (no: string) => ({ stage: 'in_transit', eta: '2026-10-05', echo: no }) } });
  const server = app.server();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const client = () => {
    let cookie = '';
    return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
      const res = await fetch(base + path, {
        method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Requested-With': 'tracker' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
      let json: any = null; try { json = await res.json(); } catch { /* html など */ }
      return { status: res.status, json, headers: res.headers };
    };
  };
  return { dir, server, client, close: () => server.close() };
}
const ship = { mode: 'sea', containerNo: 'CSQU3054383', stage: 'booked', lot: 'L1' };
const STRONG = 'Better-Pass-2026';

test('未ログインはAPIを使えない／ログイン前の保護', async () => {
  const t = await boot(); const c = t.client();
  assert.equal((await c('GET', '/api/me')).status, 401);
  assert.equal((await c('GET', '/api/shipments')).status, 401);
  assert.equal((await c('GET', '/api/track?mode=domestic&no=123456789012')).status, 401);
  t.close();
});

test('初回はパスワード変更必須 → 変更後に利用可能、ログアウトで失効', async () => {
  const t = await boot(); const c = t.client();
  const bad = await c('POST', '/api/login', { id: 'admin', password: 'wrong' });
  assert.equal(bad.status, 401);
  const ok = await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie') ?? '', /HttpOnly; SameSite=Strict/);
  assert.equal(ok.json.user.mustChange, true);
  assert.equal(JSON.stringify(ok.json).includes('hash'), false);
  assert.equal((await c('GET', '/api/shipments')).json.error, 'password_change_required');
  assert.equal((await c('POST', '/api/password', { current: 'Init-Pass-1234', next: 'short1' })).status, 400);
  assert.equal((await c('POST', '/api/password', { current: 'Init-Pass-1234', next: 'aaaaaaaaaaaa' })).status, 400);
  assert.equal((await c('POST', '/api/password', { current: 'Init-Pass-1234', next: STRONG })).status, 200);
  assert.equal((await c('GET', '/api/shipments')).status, 200);
  assert.equal((await c('POST', '/api/logout')).status, 200);
  assert.equal((await c('GET', '/api/me')).status, 401);
  assert.equal((await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' })).status, 401); // 旧パスワードは無効
  t.close();
});

test('5回失敗でロック、正しいパスワードでも拒否', async () => {
  const t = await boot(); const c = t.client();
  for (let i = 0; i < 5; i++) await c('POST', '/api/login', { id: 'admin', password: 'x' + i });
  assert.equal((await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' })).status, 423);
  t.close();
});

test('CSRF: 変更系はヘッダ必須、別Originは拒否', async () => {
  const t = await boot(); const c = t.client();
  const raw = await fetch(t.server.address() ? `http://127.0.0.1:${(t.server.address() as AddressInfo).port}/api/login` : '', { method: 'POST', body: '{}' });
  assert.equal(raw.status, 403);
  const cross = await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' }, { Origin: 'https://evil.example' });
  assert.equal(cross.status, 403);
  t.close();
});

async function loginAdmin(t: Awaited<ReturnType<typeof boot>>) {
  const c = t.client();
  await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' });
  await c('POST', '/api/password', { current: 'Init-Pass-1234', next: STRONG });
  return c;
}

test('荷物: 登録・更新・重複・検証・削除は管理者のみ・履歴', async () => {
  const t = await boot(); const a = await loginAdmin(t);
  assert.equal((await a('POST', '/api/shipments', { shipment: { ...ship, mode: 'bogus' } })).status, 400);
  const created = await a('POST', '/api/shipments', { shipment: { ...ship, __proto__: { x: 1 }, evil: '<script>' } });
  assert.equal(created.status, 200);
  assert.equal(created.json.shipment.updatedBy, 'admin');
  assert.equal('evil' in created.json.shipment, false); // 未知の項目は保存しない
  await a('POST', '/api/shipments', { shipment: { ...ship, stage: 'in_transit' } });
  const list = (await a('GET', '/api/shipments')).json.shipments;
  assert.equal(list.length, 1); assert.equal(list[0].stage, 'in_transit');
  await a('POST', '/api/shipments', { shipment: { ...ship, containerNo: 'MSKU0000000' } });
  assert.equal((await a('POST', '/api/shipments', { shipment: { ...ship, containerNo: 'MSKU0000000' }, originalNo: 'CSQU3054383' })).status, 409);

  // 一般ユーザー
  const made = await a('POST', '/api/users', { id: 'u01', name: '山田', role: 'staff' });
  assert.equal(made.status, 200); assert.ok(made.json.tempPassword.length >= 12);
  const s = t.client();
  assert.equal((await s('POST', '/api/login', { id: 'u01', password: made.json.tempPassword })).json.user.mustChange, true);
  await s('POST', '/api/password', { current: made.json.tempPassword, next: 'Staff-Pass-2026' });
  assert.equal((await s('GET', '/api/shipments')).status, 200);
  assert.equal((await s('POST', '/api/shipments', { shipment: { ...ship, containerNo: 'ONEU1111111' } })).status, 200);
  assert.equal((await s('DELETE', '/api/shipments/CSQU3054383')).status, 403);
  assert.equal((await s('GET', '/api/users')).status, 403);
  assert.equal((await s('GET', '/api/audit')).status, 403);
  assert.equal((await a('DELETE', '/api/shipments/CSQU3054383')).status, 200);
  const audit = (await a('GET', '/api/audit')).json.entries;
  assert.ok(audit.some((e: any) => e.action === 'shipment_delete' && e.by === 'admin'));
  assert.ok(audit.some((e: any) => e.action === 'shipment_create' && e.by === 'u01'));
  assert.ok(!readFileSync(join(t.dir, 'audit.log'), 'utf8').includes(STRONG)); // パスワードは記録しない
  t.close();
});

test('ユーザー管理: 無効化で即ログアウト、最後の管理者は守る、リセットで再設定必須', async () => {
  const t = await boot(); const a = await loginAdmin(t);
  assert.equal((await a('POST', '/api/users/admin/disable')).status, 400);
  assert.equal((await a('POST', '/api/users/admin/role', { role: 'staff' })).status, 400);
  const made = await a('POST', '/api/users', { id: 'u02', name: '佐藤' });
  const s = t.client();
  await s('POST', '/api/login', { id: 'u02', password: made.json.tempPassword });
  await s('POST', '/api/password', { current: made.json.tempPassword, next: 'Staff-Pass-2026' });
  assert.equal((await s('GET', '/api/me')).status, 200);
  await a('POST', '/api/users/u02/disable');
  assert.equal((await s('GET', '/api/me')).status, 401);
  assert.equal((await s('POST', '/api/login', { id: 'u02', password: 'Staff-Pass-2026' })).status, 401);
  await a('POST', '/api/users/u02/enable');
  const reset = await a('POST', '/api/users/u02/reset');
  assert.equal((await s('POST', '/api/login', { id: 'u02', password: 'Staff-Pass-2026' })).status, 401);
  assert.equal((await s('POST', '/api/login', { id: 'u02', password: reset.json.tempPassword })).json.user.mustChange, true);
  t.close();
});

test('追跡中継は認証後のみ。入力は検証される', async () => {
  const t = await boot(); const a = await loginAdmin(t);
  const r = await a('GET', '/api/track?mode=domestic&no=100000000004');
  assert.equal(r.status, 200); assert.equal(r.json.stage, 'in_transit');
  assert.equal((await a('GET', '/api/track?mode=sea&no=CSQU3054383')).status, 501);
  assert.equal((await a('GET', '/api/track?mode=domestic&no=')).status, 400);
  t.close();
});
