// 起動: npm run build && TRACK17_KEY=xxxx npm start   → http://localhost:8080
//   DATA_DIR（既定 tracker/data）  TRACKER_ADMIN_ID / TRACKER_ADMIN_PASSWORD（初回のみ。省略時は自動生成して表示）
//   TRACKER_2FA=off（二段階認証を必須にしない。非推奨）  COOKIE_SECURE=1（https配下で必須） TRUST_PROXY=1（リバースプロキシの X-Forwarded-For を信用）
'use strict';
const path = require('path');
const { createApp } = require('./app.cjs');

const PORT = Number(process.env.PORT || 8080);

// 17TRACK のステータス → 共通工程
const STATUS17 = { NotFound: 'booked', InfoReceived: 'booked', InTransit: 'in_transit', AvailableForPickup: 'arrived', OutForDelivery: 'customs', Delivered: 'delivered' };
const EXCEPTION17 = new Set(['Exception', 'DeliveryFailure', 'Expired']);

async function post17(endpoint, body) {
  const r = await fetch('https://api.17track.net/track/v2.2/' + endpoint, {
    method: 'POST', headers: { '17token': process.env.TRACK17_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('17TRACK HTTP ' + r.status);
  return r.json();
}

// 17TRACK: 取得 → 未登録なら register（クォータを1消費）して再取得
async function track17(no) {
  let res = await post17('gettrackinfo', [{ number: no }]);
  let hit = res && res.data && res.data.accepted && res.data.accepted[0];
  if (!hit) {
    await post17('register', [{ number: no }]);
    res = await post17('gettrackinfo', [{ number: no }]);
    hit = res && res.data && res.data.accepted && res.data.accepted[0];
  }
  if (!hit) return { pending: true };
  const info = hit.track_info || {};
  const status = info.latest_status && info.latest_status.status;
  const providers = (info.tracking && info.tracking.providers) || [];
  const events = [].concat(...providers.map((p) => p.events || []))
    .map((e) => ({ at: e.time_iso || e.time_utc, text: e.description || '', place: e.location || '' }))
    .filter((e) => e.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 30);
  const out = { events, lastEventAt: events[0] && events[0].at };
  if (STATUS17[status]) out.stage = STATUS17[status];
  if (EXCEPTION17.has(status)) { out.exception = true; out.exceptionNote = status; }
  const eta = info.time_metrics && info.time_metrics.estimated_delivery_date && info.time_metrics.estimated_delivery_date.from;
  if (eta) out.eta = String(eta).slice(0, 10);
  return out;
}

// 海上・航空は専用API（ShipsGo 等）の契約後にここへ追加する。未設定の間は 501 を返し、画面は手入力のまま動く
const providers = {
  hokkaido: process.env.TRACK17_KEY ? track17 : null,
  mainland: process.env.TRACK17_KEY ? track17 : null,
  intl: process.env.TRACK17_KEY ? track17 : null,
  sea: null,
  air: null,
};

const app = createApp({
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  distDir: path.join(__dirname, '..', 'dist'),
  providers,
  adminId: process.env.TRACKER_ADMIN_ID,
  adminPassword: process.env.TRACKER_ADMIN_PASSWORD,
  secureCookie: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1',
  require2fa: process.env.TRACKER_2FA !== 'off', // 社内LANのみで運用する場合に限り off にできる（非推奨）
});

app.server().listen(PORT, () => {
  console.log('tracker: http://localhost:' + PORT + (process.env.TRACK17_KEY ? '  (17TRACK 有効)' : '  (追跡API未設定: 手入力モード)'));
  if (app.initialAdmin) {
    console.log('\n初期管理者を作成しました（この表示は一度だけです。初回ログイン時にパスワード変更を求められます）');
    console.log('  ID: ' + app.initialAdmin.id + '\n  パスワード: ' + app.initialAdmin.password + '\n');
  }
});
