// 荷物追跡サーバー本体（依存なし・Node 20+）。認証・権限・荷物データ・監査ログ・追跡中継・画面配信。
//  - 認証: 社員ID＋パスワード（scrypt）。5回失敗で15分ロック。初回ログインでパスワード変更を強制
//  - セッション: サーバー側保持（HttpOnly / SameSite=Strict）。ログアウト・無効化で即失効。最終操作から2時間で失効、最長12時間
//  - 権限: admin（全操作・ユーザー管理・削除・監査ログ）／staff（荷物の登録・編集・更新）
//  - データ: DATA_DIR（既定 tracker/data）の users.json / shipments.json / audit.log
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const MODES = new Set(['sea', 'air', 'domestic', 'intl']);
const STAGES = ['booked', 'picked_up', 'departed', 'in_transit', 'arrived', 'customs', 'delivered'];
const STR_FIELDS = ['bookingNo', 'blNo', 'carrier', 'vessel', 'voyage', 'pol', 'pod', 'etd', 'eta', 'freeTimeEnd', 'lot', 'producer', 'buyer', 'note', 'exceptionNote', 'lastEventAt', 'checkedAt'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };

const IDLE_MS = 2 * 3600e3;
const MAX_MS = 12 * 3600e3;
const LOCK_MS = 15 * 60e3;
const MAX_FAILS = 5;

function randomPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(14), (b) => chars[b % chars.length]).join('');
}
function hashPw(pw, salt) { return crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64).toString('hex'); }
function makeCred(pw) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPw(pw, salt) }; }
function checkPw(user, pw) {
  const a = Buffer.from(hashPw(pw, user.salt), 'hex'), b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// 新しいパスワードの最低条件。長さと、IDや同一文字の連続でないこと
function pwProblem(pw, id) {
  if (typeof pw !== 'string' || pw.length < 10) return 'パスワードは10文字以上にしてください';
  if (pw.length > 200) return 'パスワードが長すぎます';
  if (pw.toLowerCase().includes(String(id).toLowerCase())) return 'パスワードにIDを含めないでください';
  if (/^(.)\1+$/.test(pw)) return '同じ文字だけのパスワードは使えません';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'パスワードは英字と数字の両方を含めてください';
  return '';
}

// ---- TOTP（RFC 6238 / SHA-1 / 6桁 / 30秒）。Google・Microsoft Authenticator 等と互換 ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(str) {
  let bits = 0, val = 0; const out = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch); if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secret, counter) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(b).digest();
  const o = h[19] & 15;
  const n = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
  return String(n).padStart(6, '0');
}
// 前後1ステップ（±30秒）を許容。使用済みステップ以前は拒否（コードの使い回し防止）。成功時はステップ番号、失敗は null
function totpVerify(secretB32, code, lastStep, now) {
  const key = b32dec(secretB32), step = Math.floor((now == null ? Date.now() : now) / 30000);
  for (let d = -1; d <= 1; d++) {
    const st = step + d; if (st <= (lastStep || 0)) continue;
    const a = Buffer.from(hotp(key, st)), b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return st;
  }
  return null;
}

function cleanShipment(s) {
  if (!s || typeof s !== 'object') return null;
  const no = String(s.containerNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{5,40}$/.test(no) || !MODES.has(s.mode)) return null;
  const o = { mode: s.mode, containerNo: no, stage: STAGES.includes(s.stage) ? s.stage : 'booked' };
  for (const k of STR_FIELDS) if (typeof s[k] === 'string' && s[k].length <= 500) o[k] = s[k];
  if (typeof s.exception === 'boolean') o.exception = s.exception;
  if (s.position && Number.isFinite(s.position.lat) && Number.isFinite(s.position.lon)) o.position = { lat: s.position.lat, lon: s.position.lon };
  if (Array.isArray(s.events)) {
    o.events = s.events.slice(0, 50).filter((e) => e && typeof e.at === 'string' && typeof e.text === 'string')
      .map((e) => ({ at: e.at.slice(0, 40), text: e.text.slice(0, 300), place: typeof e.place === 'string' ? e.place.slice(0, 100) : '' }));
  }
  return o;
}

function createApp(opts) {
  const dataDir = opts.dataDir;
  const distDir = opts.distDir;
  const providers = opts.providers || {};
  const secureCookie = !!opts.secureCookie;
  const trustProxy = !!opts.trustProxy;
  const require2fa = opts.require2fa !== false; // 既定: 全員に二段階認証を必須とする
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const F = { users: path.join(dataDir, 'users.json'), ships: path.join(dataDir, 'shipments.json'), audit: path.join(dataDir, 'audit.log') };

  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const writeJson = (f, v) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1), { mode: 0o600 }); fs.renameSync(t, f); };
  const audit = (by, action, target, detail) => {
    fs.appendFileSync(F.audit, JSON.stringify({ at: new Date().toISOString(), by, action, target, detail: detail || '' }) + '\n', { mode: 0o600 });
  };

  let users = readJson(F.users, null);
  let shipments = readJson(F.ships, []);
  let initialAdmin = null;
  if (!users) {
    const id = opts.adminId || 'admin';
    const pw = opts.adminPassword || randomPassword();
    users = [{ id, name: '管理者', role: 'admin', ...makeCred(pw), mustChange: true, disabled: false, failed: 0, lockedUntil: 0 }];
    writeJson(F.users, users);
    initialAdmin = { id, password: pw };
    audit('system', 'init', id, '初期管理者を作成');
  }
  const saveUsers = () => writeJson(F.users, users);
  const saveShips = () => writeJson(F.ships, shipments);
  const findUser = (id) => users.find((u) => u.id === id);
  const hasTotp = (u) => !!(u.totp && u.totp.enabled);
  const needTotp = (u) => require2fa && !hasTotp(u);
  const pub = (u) => ({ id: u.id, name: u.name, role: u.role, mustChange: !!u.mustChange, disabled: !!u.disabled, locked: u.lockedUntil > Date.now(), totp: hasTotp(u), needTotp: needTotp(u) });
  const dummy = makeCred('dummy-password-for-timing');

  const sessions = new Map(); // token -> { id, created, last, pendingSecret }
  const pending = new Map(); // パスワード確認済み・認証コード待ち: token -> { id, exp }
  const ipFails = new Map();
  const killSessions = (id, except) => { for (const [t, s] of sessions) if (s.id === id && t !== except) sessions.delete(t); };

  const ipOf = (req) => (trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((p) => p[0]));
  const setCookie = (res, token, maxAge, name = 'hlt_sid') => {
    const c = `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
    const cur = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', cur ? [].concat(cur, c) : c);
  };
  const sessionOf = (req) => {
    const t = cookies(req).hlt_sid;
    const s = t && sessions.get(t);
    if (!s) return null;
    const now = Date.now();
    const u = findUser(s.id);
    if (now - s.last > IDLE_MS || now - s.created > MAX_MS || !u || u.disabled) { sessions.delete(t); return null; }
    s.last = now;
    return { token: t, user: u };
  };

  const SEC = {
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
  const send = (res, code, body, type, extra) => {
    res.writeHead(code, { ...SEC, 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readBody = (req, limit = 2e6) => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', reject);
  });

  function startSession(res, user, now) {
    user.failed = 0; user.lockedUntil = 0; saveUsers();
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, created: now, last: now });
    setCookie(res, token, MAX_MS / 1000);
    audit(user.id, 'login', user.id);
    return send(res, 200, { user: pub(user) });
  }

  async function api(req, res, u) {
    const method = req.method;
    const p = u.pathname;
    // CSRF: 変更系は専用ヘッダ必須、Origin があれば Host と一致すること（SameSite=Strict に加えた二重防御）
    if (method !== 'GET' && method !== 'HEAD') {
      if (req.headers['x-requested-with'] !== 'tracker') return send(res, 403, { error: 'forbidden' });
      const o = req.headers.origin;
      if (o && new URL(o).host !== req.headers.host) return send(res, 403, { error: 'forbidden' });
    }

    if (p === '/api/login' && method === 'POST') {
      const ip = ipOf(req), now = Date.now();
      const f = ipFails.get(ip);
      if (f && f.reset > now && f.n >= 20) return send(res, 429, { error: '試行回数が多すぎます。しばらくしてからやり直してください' });
      const b = await readBody(req, 1e4);
      const id = String(b.id || '').trim(), pw = String(b.password || '');
      const user = findUser(id);
      const bump = () => { const c = ipFails.get(ip); ipFails.set(ip, c && c.reset > now ? { n: c.n + 1, reset: c.reset } : { n: 1, reset: now + 10 * 60e3 }); };
      if (!user || user.disabled) { checkPw(dummy, pw); bump(); audit(id || '?', 'login_fail', id, user ? '無効なアカウント' : '不明なID'); return send(res, 401, { error: 'IDまたはパスワードが違います' }); }
      if (user.lockedUntil > now) return send(res, 423, { error: 'アカウントがロックされています。15分後にやり直すか、管理者に解除を依頼してください' });
      if (!checkPw(user, pw)) {
        bump(); user.failed = (user.failed || 0) + 1;
        if (user.failed >= MAX_FAILS) { user.lockedUntil = now + LOCK_MS; user.failed = 0; audit(id, 'locked', id, `${MAX_FAILS}回失敗`); }
        saveUsers(); audit(id, 'login_fail', id, 'パスワード不一致');
        return send(res, 401, { error: 'IDまたはパスワードが違います' });
      }
      if (hasTotp(user)) {
        // パスワードは合っている。認証アプリのコードを確認するまでセッションは発行しない（5分以内に入力）
        const pre = crypto.randomBytes(24).toString('hex');
        pending.set(pre, { id: user.id, exp: now + 5 * 60e3 });
        setCookie(res, pre, 300, 'hlt_pre');
        return send(res, 200, { totp: true });
      }
      return startSession(res, user, now);
    }
    if (p === '/api/login/totp' && method === 'POST') {
      const now = Date.now();
      const pre = cookies(req).hlt_pre;
      const pd = pre && pending.get(pre);
      if (!pd || pd.exp < now) { if (pre) pending.delete(pre); return send(res, 401, { error: '時間切れです。最初からログインし直してください' }); }
      const user = findUser(pd.id);
      if (!user || user.disabled || !hasTotp(user)) { pending.delete(pre); return send(res, 401, { error: '最初からログインし直してください' }); }
      if (user.lockedUntil > now) return send(res, 423, { error: 'アカウントがロックされています。15分後にやり直すか、管理者に解除を依頼してください' });
      const b = await readBody(req, 1e3);
      const code = String(b.code || '').replace(/\s/g, '');
      const step = /^[0-9]{6}$/.test(code) ? totpVerify(user.totp.secret, code, user.totp.lastStep, now) : null;
      if (step === null) {
        user.failed = (user.failed || 0) + 1;
        if (user.failed >= MAX_FAILS) { user.lockedUntil = now + LOCK_MS; user.failed = 0; pending.delete(pre); audit(user.id, 'locked', user.id, `${MAX_FAILS}回失敗(認証コード)`); }
        saveUsers(); audit(user.id, 'totp_fail', user.id);
        return send(res, 401, { error: '認証コードが違います。認証アプリの最新の6桁を入力してください' });
      }
      user.totp.lastStep = step; pending.delete(pre); setCookie(res, '', 0, 'hlt_pre');
      return startSession(res, user, now);
    }
    if (p === '/api/logout' && method === 'POST') {
      const s = sessionOf(req);
      if (s) { sessions.delete(s.token); audit(s.user.id, 'logout', s.user.id); }
      setCookie(res, '', 0);
      return send(res, 200, { ok: true });
    }

    const sess = sessionOf(req);
    if (!sess) return send(res, 401, { error: 'ログインが必要です' });
    const me = sess.user;
    if (p === '/api/me' && method === 'GET') return send(res, 200, { user: pub(me) });

    if (p === '/api/password' && method === 'POST') {
      const b = await readBody(req, 1e4);
      if (!checkPw(me, String(b.current || ''))) return send(res, 400, { error: '現在のパスワードが違います' });
      const prob = pwProblem(b.next, me.id);
      if (prob) return send(res, 400, { error: prob });
      if (b.next === b.current) return send(res, 400, { error: '現在と同じパスワードは使えません' });
      Object.assign(me, makeCred(b.next), { mustChange: false });
      saveUsers(); killSessions(me.id, sess.token); audit(me.id, 'password_change', me.id);
      return send(res, 200, { user: pub(me) });
    }
    if (me.mustChange) return send(res, 403, { error: 'password_change_required' });
    if (needTotp(me) && p !== '/api/totp/setup' && p !== '/api/totp/enable') return send(res, 403, { error: 'totp_setup_required' });

    // ---- 二段階認証の登録（QRコード用の情報を返し、認証アプリのコードで確認してから有効化）----
    if (p === '/api/totp/setup' && method === 'POST') {
      if (hasTotp(me)) return send(res, 400, { error: 'すでに登録されています。変更は管理者に解除を依頼してください' });
      const secret = b32enc(crypto.randomBytes(20));
      sessions.get(sess.token).pendingSecret = secret;
      const label = encodeURIComponent('H-LINK 荷物追跡') + ':' + encodeURIComponent(me.id);
      return send(res, 200, { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('H-LINK 荷物追跡')}&algorithm=SHA1&digits=6&period=30` });
    }
    if (p === '/api/totp/enable' && method === 'POST') {
      const ss = sessions.get(sess.token);
      if (!ss.pendingSecret) return send(res, 400, { error: '先に登録用のQRコードを表示してください' });
      const b = await readBody(req, 1e3);
      const code = String(b.code || '').replace(/\s/g, '');
      const step = /^[0-9]{6}$/.test(code) ? totpVerify(ss.pendingSecret, code, 0) : null;
      if (step === null) return send(res, 400, { error: '認証コードが違います。アプリに表示されている最新の6桁を入力してください' });
      me.totp = { secret: ss.pendingSecret, enabled: true, lastStep: step }; ss.pendingSecret = null;
      saveUsers(); audit(me.id, 'totp_enable', me.id);
      return send(res, 200, { user: pub(me) });
    }

    const admin = me.role === 'admin';
    const needAdmin = () => { if (!admin) { send(res, 403, { error: '管理者のみ実行できます' }); return false; } return true; };

    // ---- 荷物 ----
    if (p === '/api/shipments' && method === 'GET') return send(res, 200, { shipments });
    if (p === '/api/shipments' && method === 'POST') {
      const b = await readBody(req);
      const s = cleanShipment(b.shipment);
      if (!s) return send(res, 400, { error: '荷物の内容が正しくありません（追跡番号・輸送手段）' });
      const orig = b.originalNo ? String(b.originalNo).toUpperCase().replace(/[^A-Z0-9]/g, '') : s.containerNo;
      const i = shipments.findIndex((x) => x.containerNo === orig);
      if (s.containerNo !== orig && shipments.some((x) => x.containerNo === s.containerNo)) return send(res, 409, { error: 'その追跡番号はすでに登録されています' });
      const rec = { ...s, updatedBy: me.id, updatedAt: new Date().toISOString() };
      if (i < 0) { shipments.unshift(rec); audit(me.id, 'shipment_create', s.containerNo, s.mode); }
      else {
        const changed = [...new Set([...Object.keys(s), ...Object.keys(shipments[i])])].filter((k) => !['updatedBy', 'updatedAt'].includes(k) && JSON.stringify(s[k]) !== JSON.stringify(shipments[i][k]));
        shipments[i] = rec; if (changed.length) audit(me.id, 'shipment_update', s.containerNo, changed.join(','));
      }
      saveShips();
      return send(res, 200, { shipment: rec });
    }
    if (p === '/api/shipments/bulk' && method === 'POST') {
      const b = await readBody(req, 8e6);
      if (!Array.isArray(b.rows) || b.rows.length > 5000) return send(res, 400, { error: '取り込めない形式です' });
      let added = 0, updated = 0, skipped = 0;
      for (const r of b.rows) {
        const s = cleanShipment(r); if (!s) { skipped++; continue; }
        const i = shipments.findIndex((x) => x.containerNo === s.containerNo);
        const rec = { ...s, updatedBy: me.id, updatedAt: new Date().toISOString() };
        if (i < 0) { shipments.push(rec); added++; } else { shipments[i] = { ...shipments[i], ...rec }; updated++; }
      }
      saveShips(); audit(me.id, 'shipment_import', '-', `新規${added} 更新${updated} 除外${skipped}`);
      return send(res, 200, { added, updated, skipped });
    }
    const del = p.match(/^\/api\/shipments\/([A-Za-z0-9]{5,40})$/);
    if (del && method === 'DELETE') {
      if (!needAdmin()) return;
      const no = del[1].toUpperCase(); const i = shipments.findIndex((x) => x.containerNo === no);
      if (i < 0) return send(res, 404, { error: '見つかりません' });
      shipments.splice(i, 1); saveShips(); audit(me.id, 'shipment_delete', no);
      return send(res, 200, { ok: true });
    }

    // ---- 追跡サービス中継 ----
    if (p === '/api/track' && method === 'GET') {
      const mode = u.searchParams.get('mode');
      const no = String(u.searchParams.get('no') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!no || no.length > 40) return send(res, 400, { error: 'bad number' });
      const fn = providers[mode];
      if (!fn) return send(res, 501, { error: 'この輸送手段の追跡サービスは未設定です' });
      try { return send(res, 200, await fn(no)); } catch (e) { return send(res, 502, { error: String((e && e.message) || e) }); }
    }

    // ---- 管理者: ユーザー・監査ログ ----
    if (p === '/api/users' && method === 'GET') { if (!needAdmin()) return; return send(res, 200, { users: users.map(pub) }); }
    if (p === '/api/users' && method === 'POST') {
      if (!needAdmin()) return;
      const b = await readBody(req, 1e4);
      const id = String(b.id || '').trim(), name = String(b.name || '').trim();
      if (!/^[A-Za-z0-9_.-]{2,32}$/.test(id)) return send(res, 400, { error: 'IDは英数字・._- の2〜32文字にしてください' });
      if (!name || name.length > 50) return send(res, 400, { error: '氏名を入力してください' });
      if (findUser(id)) return send(res, 409, { error: 'そのIDはすでに使われています' });
      const role = b.role === 'admin' ? 'admin' : 'staff';
      const temp = randomPassword();
      users.push({ id, name, role, ...makeCred(temp), mustChange: true, disabled: false, failed: 0, lockedUntil: 0 });
      saveUsers(); audit(me.id, 'user_create', id, role);
      return send(res, 200, { user: pub(findUser(id)), tempPassword: temp });
    }
    const um = p.match(/^\/api\/users\/([A-Za-z0-9_.-]{2,32})\/(reset|reset2fa|unlock|disable|enable|role)$/);
    if (um && method === 'POST') {
      if (!needAdmin()) return;
      const t = findUser(um[1]); if (!t) return send(res, 404, { error: '見つかりません' });
      const act = um[2];
      const activeAdmins = users.filter((x) => x.role === 'admin' && !x.disabled);
      const lastAdmin = t.role === 'admin' && !t.disabled && activeAdmins.length <= 1;
      if (act === 'reset') {
        const temp = randomPassword();
        Object.assign(t, makeCred(temp), { mustChange: true, failed: 0, lockedUntil: 0 }); killSessions(t.id);
        saveUsers(); audit(me.id, 'user_reset', t.id);
        return send(res, 200, { user: pub(t), tempPassword: temp });
      }
      if (act === 'reset2fa') {
        t.totp = null; killSessions(t.id); saveUsers(); audit(me.id, 'totp_reset', t.id);
        return send(res, 200, { user: pub(t) });
      }
      if (act === 'unlock') { t.failed = 0; t.lockedUntil = 0; saveUsers(); audit(me.id, 'user_unlock', t.id); return send(res, 200, { user: pub(t) }); }
      if (act === 'disable') {
        if (t.id === me.id) return send(res, 400, { error: '自分自身は無効にできません' });
        if (lastAdmin) return send(res, 400, { error: '最後の管理者は無効にできません' });
        t.disabled = true; killSessions(t.id); saveUsers(); audit(me.id, 'user_disable', t.id);
        return send(res, 200, { user: pub(t) });
      }
      if (act === 'enable') { t.disabled = false; saveUsers(); audit(me.id, 'user_enable', t.id); return send(res, 200, { user: pub(t) }); }
      if (act === 'role') {
        const b = await readBody(req, 1e3); const role = b.role === 'admin' ? 'admin' : 'staff';
        if (role !== 'admin' && lastAdmin) return send(res, 400, { error: '最後の管理者は一般にできません' });
        t.role = role; saveUsers(); audit(me.id, 'user_role', t.id, role);
        return send(res, 200, { user: pub(t) });
      }
    }
    if (p === '/api/audit' && method === 'GET') {
      if (!needAdmin()) return;
      const n = Math.min(Number(u.searchParams.get('limit')) || 100, 500);
      let lines = [];
      try { lines = fs.readFileSync(F.audit, 'utf8').trim().split('\n').slice(-n); } catch { /* 空 */ }
      return send(res, 200, { entries: lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse() });
    }
    return send(res, 404, { error: 'not found' });
  }

  function handler(req, res) {
    let u;
    try { u = new URL(req.url, 'http://x'); } catch { return send(res, 400, 'bad request', 'text/plain'); }
    if (u.pathname.startsWith('/api/')) {
      return api(req, res, u).catch((e) => {
        if (!res.headersSent) send(res, e && (e.code === 400 || e.code === 413) ? e.code : 500, { error: e && e.code === 413 ? '大きすぎます' : e && e.code === 400 ? '形式が正しくありません' : 'サーバーエラー' });
      });
    }
    // dist/ 配下だけを配信（../ による抜け出しは拒否）。存在しないパスは画面(index.html)へ
    let rel;
    try { rel = decodeURIComponent(u.pathname); } catch { return send(res, 400, 'bad request', 'text/plain'); }
    let file = path.join(distDir, rel === '/' ? 'index.html' : rel);
    if (file !== distDir && !file.startsWith(distDir + path.sep)) return send(res, 404, 'not found', 'text/plain');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    fs.readFile(file, (err, buf) => err ? send(res, 503, '画面が未ビルドです。先に npm run build を実行してください。', 'text/plain; charset=utf-8') : send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream'));
  }

  return { handler, initialAdmin, server: () => http.createServer(handler) };
}

module.exports = { createApp, pwProblem, cleanShipment, hotp, b32dec, b32enc, totpVerify };
