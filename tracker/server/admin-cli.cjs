// 緊急用の管理コマンド（サーバー上で実行）。管理者全員がログインできなくなったときの復旧に使う。
//   node server/admin-cli.cjs reset-password <ID>   → 仮パスワードを発行（次回ログインで変更を強制）
//   node server/admin-cli.cjs reset-2fa <ID>        → 二段階認証を解除（次回ログインで再登録を強制）
//   node server/admin-cli.cjs list                  → ユーザー一覧
// 必ずサーバーを停止してから実行し、終わったら起動し直すこと（稼働中は、サーバーが保持している内容で上書きされ、変更が消える）。
// DATA_DIR を指定している場合は同じ値を付けて実行する。
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const file = path.join(dir, 'users.json');
const [cmd, id] = process.argv.slice(2);
let users;
try { users = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { console.error('users.json が読めません: ' + file); process.exit(1); }

if (cmd === 'list') { for (const u of users) console.log(`${u.id}\t${u.name}\t${u.role}\t${u.disabled ? '無効' : '有効'}\t2FA:${u.totp && u.totp.enabled ? '済' : '未'}`); process.exit(0); }
const u = users.find((x) => x.id === id);
if (!['reset-password', 'reset-2fa'].includes(cmd) || !u) { console.error('使い方: node server/admin-cli.cjs <list | reset-password ID | reset-2fa ID>'); process.exit(1); }

if (cmd === 'reset-2fa') u.totp = null;
else {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const pw = Array.from(crypto.randomBytes(14), (b) => chars[b % chars.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  Object.assign(u, { salt, hash: crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64).toString('hex'), mustChange: true, failed: 0, lockedUntil: 0 });
  console.log('仮パスワード: ' + pw);
}
fs.writeFileSync(file + '.tmp', JSON.stringify(users, null, 1), { mode: 0o600 });
fs.renameSync(file + '.tmp', file);
fs.appendFileSync(path.join(dir, 'audit.log'), JSON.stringify({ at: new Date().toISOString(), by: 'cli', action: cmd === 'reset-2fa' ? 'totp_reset' : 'user_reset', target: id, detail: 'サーバー上のコマンド' }) + '\n', { mode: 0o600 });
console.log(`${id}: ${cmd} を実行しました。サーバーを起動し直してください。`);
