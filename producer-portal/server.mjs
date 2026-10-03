import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './src/store.mjs';
import { createApp } from './src/app.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const store = new Store(process.env.PORTAL_DB || path.join(dir, 'data', 'db.json'));
const initial = process.env.PORTAL_INITIAL_PASSWORD || `Hl-${crypto.randomBytes(5).toString('hex')}9`;
const { created } = store.load(initial);
if (created) {
  console.log('--- 初期データを作成しました（初回ログイン時にパスワード変更が必須です）---');
  console.log('生産者ID: P000123（山田農園） / P000124（佐藤果樹園）');
  console.log(`初期パスワード: ${initial}`);
}
const prod = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3100;
// 本番は HTTPS（リバースプロキシ）配下で運用し、Cookie に Secure を付ける
createApp(store, { secureCookie: prod || process.env.PORTAL_SECURE_COOKIE === '1', trustProxy: process.env.PORTAL_TRUST_PROXY === '1' })
  .listen(port, process.env.HOST || '127.0.0.1', () => console.log(`H-LINK 生産者ポータル: http://${process.env.HOST || '127.0.0.1'}:${port}`));
