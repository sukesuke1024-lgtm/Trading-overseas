// 認証・セッション・CSRF・レート制限など、セキュリティ関連の部品（外部依存なし）
import crypto from 'node:crypto';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const expected = Buffer.from(k, 'base64');
  const key = crypto.scryptSync(pw, Buffer.from(s, 'base64'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(key, expected);
}

// 存在しないIDでも同じ時間をかけるためのダミー（ユーザー列挙・タイミング攻撃対策）
export const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

/** パスワード強度：10文字以上、英字・数字を含み、ID/よくある文字列でない */
export function passwordProblem(pw, producerId = '') {
  if (typeof pw !== 'string') return 'パスワードを入力してください。';
  if (pw.length < 10) return 'パスワードは10文字以上にしてください。';
  if (pw.length > 128) return 'パスワードは128文字以内にしてください。';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'パスワードは英字と数字の両方を含めてください。';
  if (producerId && pw.toLowerCase().includes(producerId.toLowerCase())) return 'パスワードに生産者IDを含めないでください。';
  if (/^(password|12345678|qwerty|hlink)/i.test(pw)) return '推測されやすいパスワードです。別のものにしてください。';
  return null;
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

export class Sessions {
  constructor({ idleMs = 30 * 60e3, absoluteMs = 12 * 3600e3 } = {}) {
    this.idleMs = idleMs; this.absoluteMs = absoluteMs; this.map = new Map();
  }
  create(producerId, mustChange) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.map.set(sha(token), { producerId, mustChange, csrf: crypto.randomBytes(24).toString('base64url'), created: now, seen: now });
    return token;
  }
  get(token) {
    if (!token) return null;
    const key = sha(token);
    const s = this.map.get(key);
    if (!s) return null;
    const now = Date.now();
    if (now - s.seen > this.idleMs || now - s.created > this.absoluteMs) { this.map.delete(key); return null; }
    s.seen = now;
    return s;
  }
  destroy(token) { if (token) this.map.delete(sha(token)); }
  destroyAllFor(producerId, exceptToken) {
    const keep = exceptToken ? sha(exceptToken) : null;
    for (const [k, s] of this.map) if (s.producerId === producerId && k !== keep) this.map.delete(k);
  }
  sweep() { for (const t of [...this.map.keys()]) { const s = this.map.get(t); const n = Date.now(); if (n - s.seen > this.idleMs || n - s.created > this.absoluteMs) this.map.delete(t); } }
}

/** 固定ウィンドウのレート制限 */
export class RateLimiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  take(key) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || now > e.reset) { e = { n: 0, reset: now + this.windowMs }; this.hits.set(key, e); }
    e.n++;
    return e.n <= this.max ? { ok: true } : { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) };
  }
  sweep() { const n = Date.now(); for (const [k, e] of this.hits) if (n > e.reset) this.hits.delete(k); }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
