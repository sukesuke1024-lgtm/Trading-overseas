// ミライHD ポータル Service Worker
// - 画面部品（静的ファイル）はキャッシュ優先、画面（HTML）は通信優先で、圏外のときは直近の画面を表示
// - /api/ はキャッシュしない（業務データ・認証情報を端末のキャッシュに残さない）
const CACHE = "mirai-portal-v2";
const SCOPE = new URL(self.registration.scope).pathname; // 例: "/" or "/Trading-overseas/portal/"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SCOPE)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  if (/\/_next\/static\/|\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match(req).then((h) => h || caches.match(SCOPE))));
  }
});
