// H-LINK 生産者ポータル フロントエンド。データは必ず textContent 経由で描画（XSS対策）。絵文字は使わず SVG アイコンのみ。
const root = document.getElementById('root');
const state = { csrf: '', me: null, route: 'home', arg: '', navOpen: false, idleMs: 30 * 60e3, prevLogin: null, idx: -1 };

/* ---------- アイコン（24x24・線画） ---------- */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  truck: 'M2 6h12v10H2zM14 9h4l4 4v3h-8zM4 18.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 18.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  layers: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14.5h.01',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM21 21l-5-5',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 8 2 8H4s2-2 2-8M10 21a2 2 0 0 0 4 0',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM17 19c0 1.5-2 2-5 2',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.5-1.5M16 8h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  check: 'M4 12l5 5 11-11',
  x: 'M5 5l14 14M19 5L5 19',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6',
  eyeoff: 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.1 6.9A17 17 0 0 0 2 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  mountain: 'M3 19l6-10 4 6 3-4 5 8z',
  users: 'M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-5.5M17 14a6 6 0 0 1 4 6',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7v5l3 2',
  grain: 'M12 21V9M12 9c-3 0-4-2-4-4 3 0 4 2 4 4M12 9c3 0 4-2 4-4-3 0-4 2-4 4M12 14c-3 0-4-2-4-4M12 14c3 0 4-2 4-4M12 3v2',
  veg: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c3-5 6-8 10-10',
  fruit: 'M12 8c-4-2-8 1-8 6 0 4 3 7 6 7 1 0 1.5-.5 2-.5s1 .5 2 .5c3 0 6-3 6-7 0-5-4-8-8-6M12 8c0-2 1-4 3-5',
  bean: 'M7 12c0-4 3-7 6-7 3 0 4 3 4 5 0 4-3 8-7 8-2 0-3-2-3-6z',
  other: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
};
const NS = 'http://www.w3.org/2000/svg';
function icon(name, cls = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', `icon ${cls}`.trim()); svg.setAttribute('aria-hidden', 'true');
  for (const f of (ICONS[name] || ICONS.other).split(/(?=M)/)) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', f); svg.append(p); }
  return svg;
}
const CATEGORY = { grain: '穀物', veg: '野菜', fruit: '果物', bean: '豆類', other: 'その他' };

/* ---------- ユーティリティ ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'style') for (const decl of String(v).split(';')) { const i = decl.indexOf(':'); if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim()); } // CSP: style属性ではなくCSSOMで設定
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`;
const man = (n) => (n >= 10000 ? `${(n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万` : String(n));
const md = (d) => d.slice(5).replace('-', '/');
const ymdSlash = (d) => d.replaceAll('-', '/');
const fmtTime = (iso) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const monthLabel = (m) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;
const clear = (el) => { while (el.firstChild) el.firstChild.remove(); };
const STATUS_CLASS = { '注文確定': 'conf', '出荷準備中': 'prep', '出荷済み': 'sent', '納品完了': 'done', '集計中': 'warn', '振込予定': 'conf', '振込済み': 'sent', '受付中': 'warn' };
const pill = (s) => h('span', { class: `pill ${STATUS_CLASS[s] || 'done'}` }, s);
const btnIcon = (name, label, props = {}) => h('button', { type: 'button', ...props }, icon(name), label);

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(path, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': state.csrf }, body: body ? JSON.stringify(body) : undefined });
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.me) sessionEnded('ログインの有効期限が切れました。もう一度ログインしてください。');
    const e = new Error(data.error || '通信に失敗しました。'); e.status = res.status; e.code = data.code; e.retryAfter = data.retryAfter; throw e;
  }
  return data;
}
function toast(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2600); }
function field(label, input, hint, id) { const f = h('div', {}, h('label', id ? { for: id } : {}, label), input, hint && h('div', { class: 'hint' }, hint)); return f; }
function errBox() { return h('div', { class: 'err', role: 'alert', hidden: true }); }
const showErr = (box, msg) => { box.textContent = msg; box.hidden = false; };

/* ---------- モーダル（Esc／戻るボタンで閉じる） ---------- */
const modals = [];
function modal(title, content, { onClose } = {}) {
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (fromPop) => {
    if (closed) return; closed = true;
    bg.remove(); modals.splice(modals.indexOf(entry), 1); onClose?.();
    if (!fromPop && history.state?.hlModal) { entry.skipPop = true; history.back(); }
    prevFocus?.focus?.();
  };
  const id = `m${Math.random().toString(36).slice(2, 8)}`;
  const bg = h('div', { class: 'modal-bg', onclick: (e) => e.target === bg && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id }, h('h2', { id }, title), content(close)));
  const entry = { close, skipPop: false };
  modals.push(entry);
  history.pushState({ hlModal: true }, '');
  document.body.append(bg);
  bg.querySelector('input,select,textarea,button')?.focus();
  return close;
}
window.addEventListener('popstate', () => {
  if (modals.length) { const top = modals.at(-1); if (top.skipPop) { top.skipPop = false; return; } top.close(true); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modals.length) modals.at(-1).close(); });
// 確認ダイアログ（window.confirm は使わない）
function confirmDialog(title, message, okLabel, onOk, { danger = false } = {}) {
  modal(title, (close) => h('div', {}, h('p', {}, message),
    h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'キャンセル'),
      h('button', { class: `btn${danger ? ' danger' : ''}`, type: 'button', onclick: async () => { close(); await onOk(); } }, okLabel))));
}

/* ---------- ログイン ---------- */
function passwordInput(props) {
  const inp = h('input', { type: 'password', ...props });
  const caps = h('div', { class: 'hint warn', hidden: true }, 'Caps Lock がオンになっています。');
  const tog = h('button', { type: 'button', class: 'eye', 'aria-label': 'パスワードを表示', 'aria-pressed': 'false', onclick: () => {
    const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; tog.setAttribute('aria-pressed', String(show)); tog.setAttribute('aria-label', show ? 'パスワードを隠す' : 'パスワードを表示'); clear(tog); tog.append(icon(show ? 'eyeoff' : 'eye'));
  } }, icon('eye'));
  inp.addEventListener('keyup', (e) => { caps.hidden = !e.getModifierState?.('CapsLock'); });
  inp.addEventListener('blur', () => { caps.hidden = true; });
  return { inp, node: h('div', {}, h('div', { class: 'pwrap' }, inp, tog), caps) };
}

function renderLogin(message) {
  stopIdle(); clear(root); document.title = 'ログイン | H-LINK 生産者ポータル';
  const err = errBox(); if (message) showErr(err, message);
  const id = h('input', { id: 'pid', name: 'id', autocomplete: 'username', required: true, placeholder: 'P000123', maxlength: 32, autocapitalize: 'characters', spellcheck: 'false' });
  const pw = passwordInput({ id: 'pw', name: 'password', autocomplete: 'current-password', required: true, maxlength: 256 });
  const btn = h('button', { class: 'btn block', type: 'submit' }, 'ログイン');
  let lockTimer = null;
  const lockFor = (sec) => {
    btn.disabled = true; let left = sec;
    const tick = () => { if (left <= 0) { btn.disabled = false; btn.textContent = 'ログイン'; err.hidden = true; return; } btn.textContent = `あと${Math.ceil(left / 60)}分お待ちください`; left -= 5; lockTimer = setTimeout(tick, 5000); };
    tick();
  };
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true; btn.disabled = true;
    try {
      const r = await api('/api/login', { method: 'POST', body: { id: id.value, password: pw.inp.value } });
      clearTimeout(lockTimer); applySession(r); start();
    } catch (ex) {
      showErr(err, ex.message); pw.inp.value = '';
      if (ex.status === 423 || ex.status === 429) lockFor(ex.retryAfter || 60); else { btn.disabled = false; pw.inp.focus(); }
    }
  } }, h('label', { for: 'pid' }, '生産者ID'), id, h('label', { for: 'pw' }, 'パスワード'), pw.node, err, btn);
  root.append(h('div', { class: 'login' },
    h('header', { class: 'hero' },
      h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK' }),
      h('h1', { class: 'mincho' }, 'つくる人の想いを、', h('br'), '食の未来へつなぐ。'),
      h('p', {}, 'H-LINKは、生産者の皆さまと市場をつなぎ、安定した出荷・販売、そして持続可能な食の未来を共につくります。')),
    h('main', { class: 'login-body' }, h('div', { class: 'login-card' },
      h('h2', { class: 'card-title' }, '生産者ポータル'), h('p', { class: 'sub' }, '出荷・売上管理ダッシュボード  PRODUCER PORTAL'),
      form,
      h('p', { class: 'hint' }, 'IDまたはパスワードをお忘れの場合は、H-LINK担当者へご連絡ください。5回続けて間違えると15分間ロックされます。'),
      h('div', { class: 'pillars' }, h('span', {}, icon('mountain'), '地域の力をつなぐ'), h('span', {}, icon('users'), '人と産地をつなぐ'), h('span', {}, icon('globe'), '食の可能性をひらく'))))));
  id.focus();
}

function applySession(r) {
  state.csrf = r.csrf; state.me = r.producer; state.mustChange = r.mustChange; state.idleMs = r.idleMs || state.idleMs; state.prevLogin = r.prevLogin || null;
}

/* ---------- パスワード変更 ---------- */
const RULES = [['10文字以上', (v) => v.length >= 10], ['英字を含む', (v) => /[A-Za-z]/.test(v)], ['数字を含む', (v) => /\d/.test(v)], ['IDを含まない', (v) => v.length > 0 && !v.toLowerCase().includes((state.me?.id || '#').toLowerCase())]];
function strengthMeter(getValue) {
  const list = h('ul', { class: 'rules' }, RULES.map(([t]) => h('li', {}, icon('check'), t)));
  const bar = h('div', { class: 'meter' }, h('i'));
  const update = () => {
    const v = getValue(); let score = 0;
    [...list.children].forEach((li, i) => { const ok = RULES[i][1](v); li.classList.toggle('ok', ok); if (ok) score++; });
    if (v.length >= 14 && score === RULES.length) score++;
    bar.firstChild.style.setProperty('width', `${(score / (RULES.length + 1)) * 100}%`); bar.dataset.level = score > RULES.length ? 'strong' : score === RULES.length ? 'ok' : 'weak';
  };
  return { node: h('div', {}, bar, list), update };
}
function passwordForm(onDone, forced) {
  const err = errBox(), ok = h('div', { class: 'okmsg', role: 'status', hidden: true });
  const cur = passwordInput({ id: 'pw-cur', autocomplete: 'current-password', required: true });
  const nw = passwordInput({ id: 'pw-new', autocomplete: 'new-password', required: true, minlength: 10, maxlength: 128 });
  const cf = passwordInput({ id: 'pw-cf', autocomplete: 'new-password', required: true, maxlength: 128 });
  const meter = strengthMeter(() => nw.inp.value);
  nw.inp.addEventListener('input', meter.update); meter.update();
  return h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true; ok.hidden = true;
    if (nw.inp.value !== cf.inp.value) return showErr(err, '新しいパスワードが一致しません。');
    try { await api('/api/password', { method: 'POST', body: { current: cur.inp.value, next: nw.inp.value } }); state.mustChange = false; ok.textContent = 'パスワードを変更しました。他の端末はログアウトされました。'; ok.hidden = false; cur.inp.value = nw.inp.value = cf.inp.value = ''; meter.update(); onDone?.(); }
    catch (ex) { showErr(err, ex.message); }
  } },
    forced && h('p', { class: 'hint' }, '初回ログインのため、パスワードの変更が必要です。'),
    field('現在のパスワード', cur.node, null, 'pw-cur'), field('新しいパスワード', nw.node, null, 'pw-new'), meter.node, field('新しいパスワード（確認）', cf.node, null, 'pw-cf'),
    err, ok, h('button', { class: 'btn block', type: 'submit' }, '変更する'));
}
function renderForcedChange() {
  clear(root); document.title = 'パスワードの設定 | H-LINK 生産者ポータル';
  root.append(h('div', { class: 'login' }, h('header', { class: 'hero' }, h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK' }), h('h1', {}, 'パスワードの設定')),
    h('main', { class: 'login-body' }, h('div', { class: 'login-card' }, h('h2', { class: 'card-title' }, 'パスワードを変更してください'), passwordForm(() => start(), true),
      h('p', { class: 'hint' }, btnIcon('logout', 'ログアウト', { class: 'btn ghost sm', onclick: () => logout() }))))));
}

/* ---------- ログアウト・セッション管理 ---------- */
let bc = null; try { bc = new BroadcastChannel('hlink-producer'); bc.onmessage = (e) => { if (e.data === 'logout' && state.me) sessionEnded('別のタブでログアウトしました。'); }; } catch { /* 未対応 */ }
function resetUi() { modals.splice(0).forEach((m) => m.close(true)); document.querySelectorAll('.modal-bg,.toast').forEach((n) => n.remove()); state.me = null; state.csrf = ''; state.navOpen = false; state.idx = -1; }
function sessionEnded(message) { resetUi(); history.replaceState(null, '', location.pathname); renderLogin(message); }
async function logout(message, all = false) {
  stopIdle();
  try { await api(all ? '/api/logout-all' : '/api/logout', { method: 'POST' }); } catch { /* 既に失効 */ }
  try { bc?.postMessage('logout'); } catch { /* 未対応 */ }
  sessionEnded(message || (all ? 'すべての端末からログアウトしました。' : 'ログアウトしました。'));
}
const askLogout = () => confirmDialog('ログアウト', 'ログアウトしますか？', 'ログアウト', () => logout());

// 無操作タイムアウト：残り2分で警告 → 自動ログアウト。操作中はサーバーのセッションも延長する
let idleTimer = null, lastActive = Date.now(), lastPing = Date.now();
const WARN_BEFORE = 2 * 60e3;
function markActive() { lastActive = Date.now(); }
function startIdle() {
  stopIdle(); lastActive = lastPing = Date.now();
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(ev, markActive, { passive: true });
  idleTimer = setInterval(() => {
    if (!state.me) return;
    const idle = Date.now() - lastActive;
    if (idle >= state.idleMs) { logout('無操作のため自動ログアウトしました。'); return; }
    if (idle >= state.idleMs - WARN_BEFORE && !document.getElementById('idle-warn')) idleWarning();
    else if (idle < 60e3 && Date.now() - lastPing > Math.min(state.idleMs / 3, 5 * 60e3)) { lastPing = Date.now(); fetch('/api/me', { credentials: 'same-origin' }).then((r) => { if (r.status === 401) sessionEnded('ログインの有効期限が切れました。もう一度ログインしてください。'); }).catch(() => {}); }
  }, 1000);
}
function stopIdle() { clearInterval(idleTimer); for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(ev, markActive); }
function idleWarning() {
  const left = h('strong', {}, '');
  const tick = setInterval(() => { const s = Math.max(0, Math.ceil((state.idleMs - (Date.now() - lastActive)) / 1000)); left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (Date.now() - lastActive < state.idleMs - WARN_BEFORE) document.getElementById('idle-warn')?.querySelector('[data-keep]')?.click(); }, 500);
  modal('まもなく自動ログアウトします', (close) => h('div', { id: 'idle-warn' }, h('p', {}, '操作がないため、あと ', left, ' でログアウトします。'),
    h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { close(); logout(); } }, 'ログアウト'),
      h('button', { class: 'btn', type: 'button', 'data-keep': true, onclick: async () => { markActive(); close(); try { await api('/api/me'); } catch { /* 401 は api() が処理 */ } } }, '続ける'))), { onClose: () => clearInterval(tick) });
}
// 戻るボタンで認証後ページのキャッシュが表示されても、セッションを再確認する
window.addEventListener('pageshow', async (e) => { if (e.persisted) { try { const r = await fetch('/api/me', { credentials: 'same-origin' }); if (!r.ok && state.me) sessionEnded('ログインの有効期限が切れました。もう一度ログインしてください。'); else if (r.ok && !state.me) location.reload(); } catch { /* オフライン */ } } });

/* ---------- アプリ枠 ---------- */
const NAV = [
  ['home', 'home', 'ホーム'], ['orders', 'file', '注文管理'], ['shipments', 'truck', '出荷管理'], ['products', 'box', '商品管理'], ['stock', 'layers', '在庫管理'],
  ['sales', 'chart', '売上管理'], ['settlement', 'wallet', '精算・振込'], ['lots', 'search', 'トレーサビリティ'], ['notices', 'bell', 'お知らせ'], ['support', 'headset', 'サポート'], ['account', 'user', 'アカウント'],
];
const TITLES = Object.fromEntries(NAV.map(([k, , t]) => [k, t]));
const PARENT = { orders: '#orders' };
let unread = 0;

function goBack(fallback) { if ((history.state?.idx ?? 0) > 0) history.back(); else location.hash = fallback; }

function shell(detailTitle) {
  clear(root);
  const main = NAV.filter(([k]) => k !== 'account');
  const side = h('nav', { class: `side${state.navOpen ? ' open' : ''}`, 'aria-label': 'メインメニュー' },
    h('a', { class: 'logo', href: '#home' }, h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK ホーム' })),
    main.map(([k, ic, t]) => h('a', { class: `nav${state.route === k ? ' on' : ''}`, href: `#${k}`, 'aria-current': state.route === k ? 'page' : null }, icon(ic), t)),
    h('div', { class: 'spacer' }),
    h('a', { class: `nav${state.route === 'account' ? ' on' : ''}`, href: '#account', 'aria-current': state.route === 'account' ? 'page' : null }, icon('user'), 'アカウント'),
    btnIcon('logout', 'ログアウト', { class: 'nav', onclick: askLogout }));
  const scrim = h('div', { class: `scrim${state.navOpen ? ' open' : ''}`, onclick: () => { state.navOpen = false; side.classList.remove('open'); scrim.classList.remove('open'); } });
  const bell = h('a', { class: 'bell', href: '#notices', 'aria-label': `お知らせ${unread ? ` 未読${unread}件` : ''}` }, icon('bell'), unread ? h('b', {}, unread) : null);
  const page = h('div', { class: 'page', id: 'page' });
  const heading = state.route === 'home' ? `${state.me.name}さん、こんにちは` : (detailTitle || TITLES[state.route]);
  const sub = state.route === 'home' ? ['いつもH-LINKをご利用いただきありがとうございます。', state.prevLogin ? ` 前回のログイン：${fmtTime(state.prevLogin.at)}` : ''] : state.me.name;
  root.append(h('div', { class: 'app' }, side, scrim, h('div', { class: 'main' },
    h('header', { class: 'top' },
      h('button', { class: 'menu-btn', type: 'button', 'aria-label': 'メニューを開く', onclick: () => { state.navOpen = !state.navOpen; side.classList.toggle('open', state.navOpen); scrim.classList.toggle('open', state.navOpen); } }, icon('menu')),
      state.arg && h('button', { class: 'btn ghost sm back', type: 'button', onclick: () => goBack(PARENT[state.route] || '#home') }, icon('back'), '戻る'),
      h('h1', {}, heading, h('small', {}, sub)),
      bell,
      h('a', { class: 'who', href: '#account', 'aria-label': 'アカウント' }, h('span', { class: 'av' }, icon('user')), h('div', { class: 't' }, state.me.name, h('small', {}, `生産者ID：${state.me.id}`)))),
    h('main', {}, page))));
  document.title = `${state.route === 'home' ? 'ホーム' : (detailTitle || TITLES[state.route])} | H-LINK 生産者ポータル`;
  return page;
}

async function route() {
  if (!state.me) return;
  if (history.state?.idx === undefined) history.replaceState({ idx: state.idx + 1 }, '');
  state.idx = history.state.idx;
  const [name, arg = ''] = (location.hash || '#home').slice(1).split('/');
  state.route = TITLES[name] ? name : 'home'; state.arg = arg;
  const page = shell(state.route === 'orders' && arg ? `注文 ${arg}` : undefined);
  page.append(h('p', { class: 'empty' }, '読み込み中…'));
  window.scrollTo(0, 0);
  try { clear(page); await VIEWS[state.route](page, arg); }
  catch (e) {
    if (e.code === 'password_change_required') return renderForcedChange();
    if (!state.me) return;
    clear(page); page.append(h('div', { class: 'err' }, e.message), h('p', {}, h('button', { class: 'btn ghost sm', type: 'button', onclick: route }, '再読み込み')));
  }
}
window.addEventListener('hashchange', () => { if (modals.length) return; state.navOpen = false; route(); });

/* ---------- 画面 ---------- */
const orderTable = (orders, extra) => h('div', { class: 'tw' }, h('table', {},
  h('thead', {}, h('tr', {}, ['日付', '取引先', '商品', '数量', '金額', '状態', extra ? '' : null].map((t) => t != null && h('th', { class: t === '数量' || t === '金額' ? 'num' : '' }, t)))),
  h('tbody', {}, orders.map((o) => h('tr', {}, h('td', {}, md(o.date)), h('td', {}, h('a', { href: `#orders/${o.id}` }, o.buyer)), h('td', {}, o.product), h('td', { class: 'num' }, `${o.qty}${o.unit}`), h('td', { class: 'num' }, yen(o.amount)), h('td', {}, pill(o.status)), extra && h('td', {}, extra(o)))))));

function diff(v) { return v == null ? h('span', { class: 'mute' }, '—') : h('span', { class: v >= 0 ? 'up' : 'down' }, `${v >= 0 ? '+' : ''}${v}%`); }
function kpi(ic, label, value, sub) { return h('div', { class: 'card kpi' }, h('div', { class: 'ico' }, icon(ic)), h('div', {}, h('small', {}, label), h('strong', {}, value), h('small', {}, sub))); }
async function advance(o, btn, after) {
  btn.disabled = true;
  try { const r = await api(`/api/orders/${o.id}/advance`, { method: 'POST' }); Object.assign(o, r.order); toast(`「${r.order.status}」に更新しました`); after(); } catch (ex) { toast(ex.message); btn.disabled = false; }
}
const advanceLabel = (o) => (o.status === '注文確定' ? '出荷準備へ進める' : o.status === '出荷準備中' ? '出荷済みにする' : null);

const VIEWS = {
  async home(page) {
    const d = await api('/api/dashboard'); unread = d.unread;
    document.querySelector('.bell')?.replaceWith(h('a', { class: 'bell', href: '#notices', 'aria-label': `お知らせ${unread ? ` 未読${unread}件` : ''}` }, icon('bell'), unread ? h('b', {}, unread) : null));
    const max = Math.max(1, ...d.chart.map((c) => c.amount));
    page.append(
      h('div', { class: 'kpis' },
        kpi('file', '今月の受注件数', `${d.orders.count}件`, ['前月同日比 ', diff(d.orders.diff)]),
        kpi('truck', '出荷予定', `${d.shipments}件`, '今後7日間'),
        kpi('chart', '今月の売上', yen(d.sales.amount), ['前月同日比 ', diff(d.sales.diff)]),
        kpi('wallet', '振込予定額', yen(d.payout.amount), `${monthLabel(d.payout.month)}分・${ymdSlash(d.payout.transferDate)}`)),
      d.lowStock ? h('div', { class: 'card alert' }, icon('alert'), h('span', {}, `在庫が安全在庫以下の商品が${d.lowStock}件あります。`), h('a', { href: '#stock' }, '在庫管理へ')) : null,
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', {}, '売上推移', h('span', { class: 'hint' }, '月別')),
          h('div', { class: 'chart', role: 'img', 'aria-label': `月別売上の棒グラフ。${d.chart.map((c) => `${monthLabel(c.month)} ${yen(c.amount)}`).join('、')}` }, d.chart.map((c) => h('div', { class: 'col' }, h('span', { class: 'v' }, c.amount ? man(c.amount) : ''), h('div', { class: 'bar', style: `height:${(c.amount / max) * 85}%` })))),
          h('div', { class: 'xl' }, d.chart.map((c) => h('span', {}, `${Number(c.month.slice(5))}月`))), h('p', { class: 'hint' }, '単位：円（万＝1万円）。今月は本日までの合計です。')),
        h('div', { class: 'card' }, h('h2', {}, '直近の注文', h('a', { href: '#orders', class: 'more' }, 'すべて見る', icon('next'))), orderTable(d.recent))));
  },

  async orders(page, arg) {
    if (arg) return VIEWS.orderDetail(page, arg);
    const { orders } = await api('/api/orders');
    const PAGE = 20; let pageNo = 1;
    const q = h('input', { type: 'search', placeholder: '取引先・商品・注文番号で検索', 'aria-label': '検索', oninput: () => { pageNo = 1; draw(); } });
    const filter = h('select', { 'aria-label': '状態で絞り込み', onchange: () => { pageNo = 1; draw(); } }, h('option', { value: '' }, 'すべての状態'), ['注文確定', '出荷準備中', '出荷済み', '納品完了'].map((s) => h('option', {}, s)));
    const box = h('div', { class: 'card' }), count = h('h2', {});
    function draw() {
      clear(box);
      const kw = q.value.trim().toLowerCase();
      const list = orders.filter((o) => (!filter.value || o.status === filter.value) && (!kw || `${o.buyer} ${o.product} ${o.id}`.toLowerCase().includes(kw)));
      const pages = Math.max(1, Math.ceil(list.length / PAGE)); pageNo = Math.min(pageNo, pages);
      count.textContent = `注文一覧（${list.length}件）`;
      box.append(list.length ? orderTable(list.slice((pageNo - 1) * PAGE, pageNo * PAGE), (o) => advanceLabel(o) && h('button', { class: 'btn sm', type: 'button', onclick: (e) => advance(o, e.currentTarget, draw) }, advanceLabel(o))) : h('p', { class: 'empty' }, '該当する注文はありません。'),
        pages > 1 && h('div', { class: 'pager' }, h('button', { class: 'btn ghost sm', type: 'button', disabled: pageNo === 1, onclick: () => { pageNo--; draw(); } }, icon('back'), '前へ'), h('span', {}, `${pageNo} / ${pages}`), h('button', { class: 'btn ghost sm', type: 'button', disabled: pageNo === pages, onclick: () => { pageNo++; draw(); } }, '次へ', icon('next'))));
    }
    page.append(h('div', { class: 'toolbar' }, count, h('div', { class: 'row' }, q, filter)), box); draw();
  },

  async orderDetail(page, id) {
    const { order: o } = await api(`/api/orders/${encodeURIComponent(id)}`);
    document.title = `注文 ${o.id} | H-LINK 生産者ポータル`;
    const steps = ['注文確定', '出荷準備中', '出荷済み', '納品完了'], at = steps.indexOf(o.status);
    const row = (k, v) => h('div', { class: 'kv' }, h('dt', {}, k), h('dd', {}, v));
    const redraw = () => { clear(page); VIEWS.orderDetail(page, id); };
    page.append(h('div', { class: 'card' }, h('h2', {}, `注文 ${o.id}`, pill(o.status)),
      h('ol', { class: 'steps', 'aria-label': '進行状況' }, steps.map((s, i) => h('li', { class: i < at ? 'done' : i === at ? 'now' : '', 'aria-current': i === at ? 'step' : null }, h('span', {}, i < at ? icon('check') : String(i + 1)), s))),
      h('dl', { class: 'kvs' }, row('注文日', ymdSlash(o.date)), row('取引先', o.buyer), row('商品', o.product), row('数量', `${o.qty}${o.unit}`), row('金額', yen(o.amount)), row('出荷予定日', ymdSlash(o.shipDate))),
      h('div', { class: 'row', style: 'margin-top:16px' }, advanceLabel(o) && h('button', { class: 'btn', type: 'button', onclick: (e) => advance(o, e.currentTarget, redraw) }, advanceLabel(o)), h('button', { class: 'btn ghost', type: 'button', onclick: () => goBack('#orders') }, icon('back'), '注文一覧へ戻る'))));
  },

  async shipments(page) {
    const { orders } = await api('/api/orders');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0); const todayStr = today.toISOString().slice(0, 10);
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + i - 2); return d.toISOString().slice(0, 10); });
    const live = orders.filter((o) => o.status !== '納品完了');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '出荷スケジュール'), h('div', { class: 'row' }, btnIcon('download', '出荷リストをCSVで保存', { class: 'btn ghost sm', onclick: () => saveCsv('shipments.csv', [['出荷予定日', '注文番号', '取引先', '商品', '数量', '状態']].concat(live.map((o) => [o.shipDate, o.id, o.buyer, o.product, `${o.qty}${o.unit}`, o.status]))) }))),
      h('div', { class: 'cal' }, days.map((d) => h('div', { class: `day${d === todayStr ? ' today' : ''}` }, h('b', {}, md(d), d === todayStr ? '（今日）' : ''),
        live.filter((o) => o.shipDate === d).map((o) => h('a', { href: `#orders/${o.id}`, class: `ev${o.status === '出荷済み' ? ' s' : ''}`, title: `${o.buyer} ${o.product}` }, `${o.buyer} ${o.qty}${o.unit}`))))),
      h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, '出荷対象の注文'), live.length ? orderTable(live.sort((a, b) => a.shipDate.localeCompare(b.shipDate))) : h('p', { class: 'empty' }, '出荷待ちの注文はありません。')));
  },

  async products(page) {
    const { products } = await api('/api/products');
    const open = (p) => modal(p ? '商品を編集' : '商品を登録', (close) => {
      const v = p || { name: '', spec: '', price: 0, unit: '箱', safety: 0, stock: 0, category: 'other' };
      const f = { name: h('input', { id: 'f-name', value: v.name, maxlength: 60, required: true }), spec: h('input', { id: 'f-spec', value: v.spec, maxlength: 60 }), price: h('input', { id: 'f-price', type: 'number', min: 0, max: 10000000, step: 1, inputmode: 'numeric', value: v.price }), unit: h('input', { id: 'f-unit', value: v.unit, maxlength: 6, required: true }), stock: h('input', { id: 'f-stock', type: 'number', min: 0, step: 1, value: v.stock }), safety: h('input', { id: 'f-safety', type: 'number', min: 0, step: 1, value: v.safety }), cat: h('select', { id: 'f-cat' }, Object.entries(CATEGORY).map(([k, t]) => h('option', { value: k, selected: (v.category || 'other') === k }, t))) };
      const err = errBox();
      return h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true;
        try { await api(p ? `/api/products/${p.id}` : '/api/products', { method: p ? 'PUT' : 'POST', body: { name: f.name.value, spec: f.spec.value, price: +f.price.value, unit: f.unit.value, stock: +f.stock.value, safety: +f.safety.value, category: f.cat.value } }); close(); toast('保存しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('商品名', f.name, null, 'f-name')), h('div', { class: 'full' }, field('規格', f.spec, null, 'f-spec')), field('単価（円）', f.price, null, 'f-price'), field('単位', f.unit, null, 'f-unit'), field('在庫数', f.stock, null, 'f-stock'), field('安全在庫', f.safety, '在庫がこの数以下になるとお知らせします', 'f-safety'), field('分類', f.cat, null, 'f-cat')),
        err, h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'キャンセル'), h('button', { class: 'btn', type: 'submit' }, '保存')));
    });
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, `商品一覧（${products.length}件）`), btnIcon('plus', '商品を登録', { class: 'btn', onclick: () => open() })),
      products.length ? h('div', { class: 'prod' }, products.map((p) => h('div', { class: 'card' }, h('div', { class: 'pic' }, icon(CATEGORY[p.category] ? p.category : 'other')), h('h2', { style: 'margin-top:8px' }, p.name), h('div', { class: 'hint' }, `${CATEGORY[p.category] || 'その他'}・${p.spec || '規格なし'}`), h('p', {}, h('strong', {}, yen(p.price)), ` / ${p.unit}`),
        h('div', { class: 'row' }, btnIcon('edit', '編集', { class: 'btn ghost sm', onclick: () => open(p) }), btnIcon('trash', '削除', { class: 'btn ghost sm', onclick: () => confirmDialog('商品を削除', `「${p.name}」を削除しますか？この操作は元に戻せません。`, '削除する', async () => { try { await api(`/api/products/${p.id}`, { method: 'DELETE' }); toast('削除しました'); route(); } catch (ex) { toast(ex.message); } }, { danger: true }) }))))) : h('p', { class: 'empty' }, '商品が登録されていません。'));
  },

  async stock(page) {
    const { products } = await api('/api/products');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '在庫管理'), h('span', { class: 'hint' }, '出荷済みにすると在庫が自動で減ります。')),
      h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['商品', '規格', '在庫', '安全在庫', '在庫を更新'].map((t) => h('th', { class: t === '在庫' || t === '安全在庫' ? 'num' : '' }, t)))),
        h('tbody', {}, products.map((p) => { const inp = h('input', { type: 'number', min: 0, step: 1, value: p.stock, 'aria-label': `${p.name}の在庫数`, style: 'width:90px' }); const cell = h('td', { class: `num${p.stock <= p.safety ? ' low' : ''}` }, `${p.stock}${p.unit}`);
          return h('tr', {}, h('td', {}, h('span', { class: 'inl' }, icon(CATEGORY[p.category] ? p.category : 'other'), p.name)), h('td', {}, p.spec), cell, h('td', { class: 'num' }, `${p.safety}${p.unit}`),
            h('td', {}, h('div', { class: 'row' }, inp, h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { const r = await api(`/api/products/${p.id}/stock`, { method: 'POST', body: { stock: +inp.value } }); p.stock = r.product.stock; toast('在庫を更新しました'); cell.textContent = `${p.stock}${p.unit}`; cell.className = `num${p.stock <= p.safety ? ' low' : ''}`; } catch (ex) { toast(ex.message); } } }, '更新'))));
        })))));
  },

  async sales(page) {
    const s = await api('/api/sales');
    const total = s.months.reduce((a, m) => a + m.amount, 0);
    const max = Math.max(1, ...s.months.map((m) => m.amount)), pmax = Math.max(1, ...s.products.map((p) => p.amount));
    page.append(h('div', { class: 'card', style: 'margin-bottom:14px' }, h('small', { class: 'mute' }, '累計売上'), h('div', { class: 'big' }, yen(total))),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', {}, '月別売上'), h('div', { class: 'bars' }, s.months.map((m) => h('div', { class: 'hbar' }, h('span', {}, monthLabel(m.month)), h('i', { style: `width:${(m.amount / max) * 100}%` }), h('span', { class: 'num' }, yen(m.amount)))))),
        h('div', { class: 'card' }, h('h2', {}, '商品別売上（累計）'), h('div', { class: 'bars' }, s.products.map((p) => h('div', { class: 'hbar' }, h('span', {}, p.name), h('i', { style: `width:${(p.amount / pmax) * 100}%` }), h('span', { class: 'num' }, yen(p.amount))))))));
  },

  async settlement(page) {
    const { settlements } = await api('/api/settlements');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '月次精算・振込'), h('span', { class: 'hint' }, '手数料は売上の8%、振込は翌月末です。')),
      h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['対象月', '売上', '手数料(8%)', '振込額', '振込予定日', '状態', '明細'].map((t) => h('th', { class: ['売上', '手数料(8%)', '振込額'].includes(t) ? 'num' : '' }, t)))),
        h('tbody', {}, settlements.map((s) => h('tr', {}, h('td', {}, monthLabel(s.month)), h('td', { class: 'num' }, yen(s.sales)), h('td', { class: 'num' }, `−${yen(s.fee)}`), h('td', { class: 'num' }, h('strong', {}, yen(s.payout))), h('td', {}, ymdSlash(s.transferDate)), h('td', {}, pill(s.status)),
          h('td', {}, btnIcon('download', 'CSV', { class: 'btn ghost sm', onclick: async () => { try { const res = await api(`/api/settlements/${s.month}/csv`, { raw: true }); saveBlob(`settlement-${s.month}.csv`, await res.blob()); } catch (ex) { toast(ex.message); } } }))))))));
  },

  async lots(page) {
    const [{ lots }, { products }] = await Promise.all([api('/api/lots'), api('/api/products')]);
    const open = () => modal('ロットを登録', (close) => {
      const sel = h('select', { id: 'l-prod', required: true }, products.map((p) => h('option', { value: p.id }, p.name)));
      const f = { lot: h('input', { id: 'l-lot', maxlength: 30, required: true }), field: h('input', { id: 'l-field', maxlength: 40, required: true }), harvest: h('input', { id: 'l-h', type: 'date', required: true }), ship: h('input', { id: 'l-s', type: 'date' }), note: h('textarea', { id: 'l-n', rows: 2, maxlength: 200 }) };
      const err = errBox();
      return h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { await api('/api/lots', { method: 'POST', body: { productId: sel.value, lot: f.lot.value, field: f.field.value, harvestDate: f.harvest.value, shipDate: f.ship.value, note: f.note.value } }); close(); toast('登録しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        field('商品', sel, null, 'l-prod'), field('ロット番号', f.lot, null, 'l-lot'), field('圃場・産地', f.field, null, 'l-field'), field('収穫日', f.harvest, null, 'l-h'), field('出荷日', f.ship, null, 'l-s'), field('備考', f.note, null, 'l-n'), err,
        h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'キャンセル'), h('button', { class: 'btn', type: 'submit' }, '登録')));
    });
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, 'ロット管理（トレーサビリティ）'), btnIcon('plus', 'ロットを登録', { class: 'btn', onclick: open })),
      h('div', { class: 'card tw' }, lots.length ? h('table', {}, h('thead', {}, h('tr', {}, ['ロット', '商品', '圃場・産地', '収穫日', '出荷日', '備考'].map((t) => h('th', {}, t)))),
        h('tbody', {}, lots.map((l) => h('tr', {}, h('td', {}, l.lot), h('td', {}, l.product), h('td', {}, l.field), h('td', {}, ymdSlash(l.harvestDate)), h('td', {}, l.shipDate ? ymdSlash(l.shipDate) : '—'), h('td', {}, l.note))))) : h('p', { class: 'empty' }, 'ロットが登録されていません。')));
  },

  async notices(page) {
    const { notices } = await api('/api/notices');
    unread = notices.filter((n) => !n.read).length;
    page.append(h('div', { class: 'card' }, notices.map((n) => h('div', { class: `notice${n.read ? '' : ' unread'}` }, h('div', {}, h('strong', {}, n.title), ' ', h('time', {}, fmtTime(n.at)), h('p', {}, n.body), !n.read && h('button', { class: 'btn ghost sm', type: 'button', style: 'margin-top:6px', onclick: async () => { await api(`/api/notices/${n.id}/read`, { method: 'POST' }); route(); } }, '既読にする'))))));
  },

  async support(page) {
    const { tickets } = await api('/api/tickets');
    const subject = h('input', { id: 't-sub', maxlength: 80, required: true }), body = h('textarea', { id: 't-body', rows: 4, maxlength: 2000, required: true }), err = errBox();
    page.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, 'お問い合わせ'), h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { await api('/api/tickets', { method: 'POST', body: { subject: subject.value, body: body.value } }); toast('送信しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        field('件名', subject, null, 't-sub'), field('内容', body, null, 't-body'), err, h('button', { class: 'btn block', type: 'submit' }, '新規チケットを作成'))),
      h('div', { class: 'card' }, h('h2', {}, '問い合わせ履歴'), tickets.length ? tickets.map((t) => h('div', { class: 'notice', style: 'padding-left:0' }, h('div', {}, h('strong', {}, t.subject), ' ', pill(t.status), h('p', {}, t.body), h('time', {}, `${t.id}・${fmtTime(t.at)}`)))) : h('p', { class: 'empty' }, '履歴はありません。'))));
  },

  async account(page) {
    const a = await api('/api/account');
    const LABEL = { login: 'ログイン', login_failed: 'ログイン失敗', locked: 'アカウントをロック', logout: 'ログアウト', logout_all: '全端末からログアウト', password_changed: 'パスワード変更' };
    page.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, 'アカウント情報'),
        h('dl', { class: 'kvs' }, [['屋号', a.producer.name], ['代表者', a.producer.owner], ['生産者ID', a.producer.id], ['メール', a.producer.email]].map(([k, v]) => h('div', { class: 'kv' }, h('dt', {}, k), h('dd', {}, v)))),
        h('p', { class: 'hint' }, icon('clock', 'inline'), ` ${a.idleMinutes}分間操作がないと自動でログアウトします。`),
        h('div', { class: 'row', style: 'margin-top:12px' }, btnIcon('logout', 'ログアウト', { class: 'btn ghost', onclick: askLogout }),
          btnIcon('shield', 'すべての端末からログアウト', { class: 'btn ghost', onclick: () => confirmDialog('すべての端末からログアウト', '他の端末も含め、現在ログインしているすべての端末をログアウトします。', 'すべてログアウト', () => logout(null, true), { danger: true }) }))),
      h('div', { class: 'card' }, h('h2', {}, 'パスワードの変更'), passwordForm())),
      h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, 'ログイン履歴（直近15件）'), h('p', { class: 'hint' }, '心当たりのない操作があれば、すぐにパスワードを変更し、H-LINK担当者へご連絡ください。'),
        h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['日時', '操作', '接続元'].map((t) => h('th', {}, t)))), h('tbody', {}, a.history.map((x) => h('tr', {}, h('td', {}, fmtTime(x.at)), h('td', {}, h('span', { class: x.action === 'login_failed' || x.action === 'locked' ? 'low' : '' }, LABEL[x.action] || x.action)), h('td', {}, x.ip))))))));
  },
};

/* ---------- ファイル保存 ---------- */
function saveBlob(name, blob) { const url = URL.createObjectURL(blob); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function saveCsv(name, rows) {
  const esc = (v) => { let t = String(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; }; // CSVインジェクション対策
  saveBlob(name, new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- 起動 ---------- */
function start() { startIdle(); if (state.mustChange) return renderForcedChange(); route(); }
(async () => {
  try {
    const me = await fetch('/api/me', { credentials: 'same-origin' });
    if (me.ok) { applySession({ ...(await me.json()) }); return start(); }
  } catch { /* オフライン */ }
  renderLogin();
})();
