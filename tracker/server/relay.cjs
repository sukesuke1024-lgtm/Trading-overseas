// 追跡中継サーバー（依存なし・Node 20+）。APIキーをブラウザに置かないための中継。
//   npm run build && TRACK17_KEY=xxxx npm start   → http://localhost:8080 （画面(dist/)も同じサーバーで配信）
// 画面の「設定」で中継URLに、このサーバーのアドレスを指定すると、更新で実データを取得します。
// 認証: TRACKER_TOKEN を設定すると、/api/* は Authorization: Bearer <token> が必須になります。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8080);
const DIST = path.join(__dirname, '..', 'dist'); // npm run build の出力
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };

// 17TRACK のステータス → 共通工程
const STATUS17 = { NotFound: 'booked', InfoReceived: 'booked', InTransit: 'in_transit', AvailableForPickup: 'arrived', OutForDelivery: 'customs', Delivered: 'delivered' };
const EXCEPTION17 = new Set(['Exception', 'DeliveryFailure', 'Expired']);

async function post17(endpoint, body) {
  const r = await fetch('https://api.17track.net/track/v2.2/' + endpoint, {
    method: 'POST',
    headers: { '17token': process.env.TRACK17_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('17TRACK HTTP ' + r.status);
  return r.json();
}

// 17TRACK: 初回は register（クォータを1消費）→ gettrackinfo で取得。登録済みの番号は再登録しない
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
    .filter((e) => e.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);
  const out = { events, lastEventAt: events[0] && events[0].at };
  if (STATUS17[status]) out.stage = STATUS17[status];
  if (EXCEPTION17.has(status)) { out.exception = true; out.exceptionNote = status; }
  const eta = info.time_metrics && info.time_metrics.estimated_delivery_date && info.time_metrics.estimated_delivery_date.from;
  if (eta) out.eta = String(eta).slice(0, 10);
  return out;
}

// 海上・航空は専用API（ShipsGo 等）の契約後にここへ追加する。キー未設定の間は 501 を返し、画面は手入力のまま動く
const PROVIDERS = {
  domestic: process.env.TRACK17_KEY ? track17 : null,
  intl: process.env.TRACK17_KEY ? track17 : null,
  sea: null,
  air: null,
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/track') {
    const token = process.env.TRACKER_TOKEN;
    if (token && req.headers.authorization !== 'Bearer ' + token) return send(res, 401, { error: 'unauthorized' });
    const mode = u.searchParams.get('mode');
    const no = String(u.searchParams.get('no') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!no || no.length > 40) return send(res, 400, { error: 'bad number' });
    const fn = PROVIDERS[mode];
    if (!fn) return send(res, 501, { error: 'この輸送手段の追跡サービスは未設定です' });
    try { return send(res, 200, await fn(no)); } catch (e) { return send(res, 502, { error: String(e.message || e) }); }
  }
  // dist/ 配下だけを配信（../ による抜け出しは拒否）。存在しないパスは画面(index.html)へ
  let rel;
  try { rel = decodeURIComponent(u.pathname); } catch { return send(res, 400, 'bad request', 'text/plain'); }
  let file = path.join(DIST, rel === '/' ? 'index.html' : rel);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return send(res, 404, 'not found', 'text/plain');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  fs.readFile(file, (err, buf) => err ? send(res, 503, '画面が未ビルドです。先に npm run build を実行してください。', 'text/plain; charset=utf-8') : send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream'));
}).listen(PORT, () => console.log('tracker: http://localhost:' + PORT + (process.env.TRACK17_KEY ? '  (17TRACK 有効)' : '  (追跡API未設定: 手入力モード)')));
