import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const { createApp, hotp, b32dec } = createRequire(import.meta.url)('../server/app.cjs');

async function boot(extra: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'trk-'));
  const app = createApp({ dataDir: dir, distDir: dir, adminId: 'admin', adminPassword: 'Init-Pass-1234', require2fa: false, ...extra, providers: { hokkaido: async (no: string) => ({ stage: 'in_transit', eta: '2026-10-05', echo: no }) } });
  const server = app.server();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const client = () => {
    const jar = new Map<string, string>();
    return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
      const res = await fetch(base + path, {
        method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Requested-With': 'tracker' } : {}), ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const sc of res.headers.getSetCookie()) {
        const [kv] = sc.split(';'); const i = kv.indexOf('=');
        const k = kv.slice(0, i), v = kv.slice(i + 1);
        if (v) jar.set(k, v); else jar.delete(k);
      }
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
  assert.equal((await c('GET', '/api/track?mode=hokkaido&no=123456789012')).status, 401);
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
  const r = await a('GET', '/api/track?mode=hokkaido&no=100000000004');
  assert.equal(r.status, 200); assert.equal(r.json.stage, 'in_transit');
  assert.equal((await a('GET', '/api/track?mode=sea&no=CSQU3054383')).status, 501);
  assert.equal((await a('GET', '/api/track?mode=hokkaido&no=')).status, 400);
  t.close();
});

// ---- 二段階認証 ----
const code = (secret: string, offset = 0) => hotp(b32dec(secret), Math.floor(Date.now() / 30000) + offset);

test('TOTP: RFC 6238 のテストベクタ', () => {
  assert.equal(hotp(Buffer.from('12345678901234567890'), 1), '287082'); // T=59秒
  assert.equal(hotp(Buffer.from('12345678901234567890'), 37037036), '081804'); // T=1111111080
});

test('2FA必須: パスワード変更→QR登録まで他の操作は不可、登録後は認証コードが必要', async () => {
  const t = await boot({ require2fa: true }); const c = t.client();
  await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' });
  await c('POST', '/api/password', { current: 'Init-Pass-1234', next: STRONG });
  assert.equal((await c('GET', '/api/me')).json.user.needTotp, true);
  assert.equal((await c('GET', '/api/shipments')).json.error, 'totp_setup_required');
  const setup = await c('POST', '/api/totp/setup');
  assert.match(setup.json.uri, /^otpauth:\/\/totp\/.+secret=[A-Z2-7]+/);
  assert.equal((await c('POST', '/api/totp/enable', { code: '000000' })).status, 400);
  const secret = setup.json.secret as string;
  assert.equal((await c('POST', '/api/totp/enable', { code: code(secret) })).status, 200);
  assert.equal((await c('GET', '/api/shipments')).status, 200);
  assert.equal((await c('POST', '/api/totp/setup')).status, 400); // 上書き不可
  await c('POST', '/api/logout');

  // 新しいログイン: パスワードだけではセッションが発行されない
  const d = t.client();
  const step1 = await d('POST', '/api/login', { id: 'admin', password: STRONG });
  assert.equal(step1.json.totp, true); assert.equal(step1.json.user, undefined);
  assert.equal((await d('GET', '/api/me')).status, 401);
  assert.equal((await d('POST', '/api/login/totp', { code: '123456' })).status, 401);
  // 登録時に使ったコード（今のステップ）は使用済み扱い。次のステップのコードならログインできる
  assert.equal((await d('POST', '/api/login/totp', { code: code(secret) })).status, 401);
  const used = code(secret, 1);
  assert.equal((await d('POST', '/api/login/totp', { code: used })).status, 200);
  assert.equal((await d('GET', '/api/me')).status, 200);
  // 同じコードの再利用は拒否（リプレイ対策）
  await d('POST', '/api/logout');
  const e = t.client();
  await e('POST', '/api/login', { id: 'admin', password: STRONG });
  assert.equal((await e('POST', '/api/login/totp', { code: used })).status, 401);
  t.close();
});

test('2FA: 認証コードを5回間違えるとロック。コード画面を経ずにセッションは得られない', async () => {
  const t = await boot({ require2fa: true }); const c = t.client();
  await c('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' });
  await c('POST', '/api/password', { current: 'Init-Pass-1234', next: STRONG });
  const { json } = await c('POST', '/api/totp/setup');
  await c('POST', '/api/totp/enable', { code: code(json.secret) });
  await c('POST', '/api/logout');
  const d = t.client();
  await d('POST', '/api/login', { id: 'admin', password: STRONG });
  for (let i = 0; i < 5; i++) await d('POST', '/api/login/totp', { code: '00000' + i });
  assert.equal((await d('POST', '/api/login/totp', { code: code(json.secret, 1) })).status, 401); // 待機中の確認は破棄済み
  assert.equal((await d('POST', '/api/login', { id: 'admin', password: STRONG })).status, 423);
  // コード待ちのCookieなしで /api/login/totp は使えない
  const e = t.client();
  assert.equal((await e('POST', '/api/login/totp', { code: code(json.secret, 1) })).status, 401);
  t.close();
});

test('管理者による2FA解除: 再登録が必須になり、ログイン中のセッションは失効', async () => {
  const t = await boot({ require2fa: true }); const a = t.client();
  await a('POST', '/api/login', { id: 'admin', password: 'Init-Pass-1234' });
  await a('POST', '/api/password', { current: 'Init-Pass-1234', next: STRONG });
  const s1 = (await a('POST', '/api/totp/setup')).json.secret;
  await a('POST', '/api/totp/enable', { code: code(s1) });
  const made = await a('POST', '/api/users', { id: 'u03', name: '鈴木' });
  const u = t.client();
  await u('POST', '/api/login', { id: 'u03', password: made.json.tempPassword });
  await u('POST', '/api/password', { current: made.json.tempPassword, next: 'Staff-Pass-2026' });
  const s2 = (await u('POST', '/api/totp/setup')).json.secret;
  await u('POST', '/api/totp/enable', { code: code(s2) });
  assert.equal((await u('GET', '/api/shipments')).status, 200);
  assert.equal((await a('POST', '/api/users/u03/reset2fa')).status, 200);
  assert.equal((await u('GET', '/api/me')).status, 401);
  const again = t.client();
  assert.equal((await again('POST', '/api/login', { id: 'u03', password: 'Staff-Pass-2026' })).json.user.needTotp, true);
  const list = (await a('GET', '/api/users')).json.users;
  assert.equal(JSON.stringify(list).includes(s2), false); // 秘密鍵はAPIで返さない
  t.close();
});

test('取引・緊急連絡先・問題報告: 登録・更新・検証・権限・履歴', async () => {
  const t = await boot(); const a = await loginAdmin(t);
  // 取引
  assert.equal((await a('POST', '/api/c/deals', { item: { title: '', partner: 'X' } })).status, 400);
  assert.equal((await a('POST', '/api/c/deals', { item: { title: 'A', partner: 'B', amount: -5 } })).status, 400);
  const d1 = await a('POST', '/api/c/deals', { item: { title: 'ホタテ 1コンテナ', partner: 'Sample Pte', amount: '1200000', currency: 'usd', status: 'ordered', evil: 1 } });
  assert.equal(d1.status, 200); assert.equal(d1.json.item.id, 'D-0001'); assert.equal(d1.json.item.currency, 'USD'); assert.equal('evil' in d1.json.item, false);
  const upd = await a('POST', '/api/c/deals', { item: { id: 'D-0001', title: 'ホタテ 1コンテナ', partner: 'Sample Pte', status: 'shipped' } });
  assert.equal(upd.json.item.status, 'shipped'); assert.equal(upd.json.item.createdBy, 'admin');
  assert.equal((await a('POST', '/api/c/deals', { item: { id: 'D-9999', title: 'x', partner: 'y' } })).status, 404);
  assert.equal((await a('POST', '/api/c/deals', { item: { title: 'B', partner: 'C' } })).json.item.id, 'D-0002');

  // 一般ユーザー: 取引・問題は書ける、緊急連絡先は書けない、削除はできない
  const made = await a('POST', '/api/users', { id: 'u05', name: '高橋' });
  const s = t.client();
  await s('POST', '/api/login', { id: 'u05', password: made.json.tempPassword });
  await s('POST', '/api/password', { current: made.json.tempPassword, next: 'Staff-Pass-2026' });
  assert.equal((await s('POST', '/api/c/deals', { item: { title: 'C', partner: 'D' } })).status, 200);
  assert.equal((await s('DELETE', '/api/c/deals/D-0001')).status, 403);
  assert.equal((await s('POST', '/api/c/contacts', { item: { name: '運送会社', phone: '011-000-0000' } })).status, 403);
  assert.equal((await a('POST', '/api/c/contacts', { item: { name: 'ヤマト運輸 法人窓口', category: 'carrier', phone: 'tel:011' } })).status, 400);
  const ct = await a('POST', '/api/c/contacts', { item: { name: 'ヤマト運輸 法人窓口', category: 'carrier', phone: '0120-123-456', always: true, modes: ['hokkaido', 'mainland', 'bogus'] } });
  assert.equal(ct.status, 200); assert.deepEqual(ct.json.item.modes, ['hokkaido', 'mainland']);
  assert.equal((await s('GET', '/api/c/contacts')).json.items.length, 1); // 一般も閲覧は可能

  // 問題報告 → 解決
  assert.equal((await s('POST', '/api/c/incidents', { item: { title: '' } })).status, 400);
  const inc = await s('POST', '/api/c/incidents', { item: { title: '温度異常', type: 'temperature', severity: 'urgent', shipmentNo: 'csqu 305438-3', detail: '-10℃' } });
  assert.equal(inc.status, 200); assert.equal(inc.json.item.shipmentNo, 'CSQU3054383'); assert.equal(inc.json.item.status, 'open');
  const solved = await s('POST', '/api/c/incidents', { item: { ...inc.json.item, status: 'resolved', resolution: '冷凍機を交換' } });
  assert.equal(solved.json.item.status, 'resolved'); assert.equal(solved.json.item.resolvedBy, 'u05');
  assert.equal((await a('DELETE', `/api/c/incidents/${inc.json.item.id}`)).status, 200);
  assert.equal((await a('DELETE', '/api/c/deals/D-0001')).status, 200);
  const log = (await a('GET', '/api/audit?limit=100')).json.entries.map((e: any) => e.action);
  for (const k of ['deal_create', 'deal_update', 'deal_delete', 'contact_create', 'incident_create', 'incident_resolve', 'incident_delete']) assert.ok(log.includes(k), k);
  t.close();
});

test('国内宅配は道内/道外。旧データ(domestic)は道内として受け付ける', async () => {
  const t = await boot(); const a = await loginAdmin(t);
  const r1 = await a('POST', '/api/shipments', { shipment: { mode: 'mainland', containerNo: '100000000004', stage: 'booked' } });
  assert.equal(r1.json.shipment.mode, 'mainland');
  const r3 = await a('POST', '/api/shipments', { shipment: { mode: 'mainland', means: 'ship', containerNo: '200000000001', stage: 'booked' } });
  assert.equal(r3.json.shipment.means, 'ship');
  assert.equal('means' in (await a('POST', '/api/shipments', { shipment: { mode: 'sea', means: 'rocket', containerNo: 'CSQU3054383', stage: 'booked' } })).json.shipment, false);
  const r2 = await a('POST', '/api/shipments', { shipment: { mode: 'domestic', containerNo: '123456789012', stage: 'booked', dealId: 'D-0001' } });
  assert.equal(r2.json.shipment.mode, 'hokkaido'); assert.equal(r2.json.shipment.dealId, 'D-0001');
  t.close();
});
