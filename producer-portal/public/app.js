// H-LINK 生産者ポータル フロントエンド。データは必ず textContent 経由で描画（XSS対策）。
const root = document.getElementById('root');
const state = { csrf: '', me: null, route: 'home', navOpen: false };

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
const md = (d) => d.slice(5).replace('-', '/');
const clear = (el) => { while (el.firstChild) el.firstChild.remove(); };
const STATUS_CLASS = { '注文確定': 'conf', '出荷準備中': 'prep', '出荷済み': 'sent', '納品完了': 'done', '集計中': 'warn', '振込予定': 'conf', '振込済み': 'sent', '受付中': 'warn' };
const pill = (s) => h('span', { class: `pill ${STATUS_CLASS[s] || 'done'}` }, s);

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(path, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': state.csrf }, body: body ? JSON.stringify(body) : undefined });
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.me) { state.me = null; renderLogin('ログインの有効期限が切れました。もう一度ログインしてください。'); }
    const e = new Error(data.error || '通信に失敗しました。'); e.status = res.status; e.code = data.code; throw e;
  }
  return data;
}
function toast(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2600); }
function modal(title, content) {
  const close = () => bg.remove();
  const bg = h('div', { class: 'modal-bg', onclick: (e) => e.target === bg && close() }, h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', {}, title), content(close)));
  document.body.append(bg);
  bg.querySelector('input,select,textarea,button')?.focus();
}
function field(label, input, hint) { return h('div', {}, h('label', {}, label), input, hint && h('div', { class: 'hint' }, hint)); }
function errBox() { return h('div', { class: 'err', role: 'alert', hidden: true }); }
const showErr = (box, msg) => { box.textContent = msg; box.hidden = false; };

/* ---------- ログイン ---------- */
function renderLogin(message) {
  clear(root);
  const err = errBox(); if (message) showErr(err, message);
  const id = h('input', { id: 'pid', name: 'id', autocomplete: 'username', required: true, placeholder: 'P000123', maxlength: 32, autocapitalize: 'characters' });
  const pw = h('input', { id: 'pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true, maxlength: 256 });
  const btn = h('button', { class: 'btn block', type: 'submit' }, 'ログイン');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true; btn.disabled = true;
    try {
      const r = await api('/api/login', { method: 'POST', body: { id: id.value, password: pw.value } });
      state.csrf = r.csrf; state.me = r.producer; state.mustChange = r.mustChange; start();
    } catch (ex) { showErr(err, ex.message); pw.value = ''; pw.focus(); } finally { btn.disabled = false; }
  } },
    h('label', { for: 'pid' }, '生産者ID'), id,
    h('label', { for: 'pw' }, 'パスワード'), pw,
    err, btn);
  root.append(h('div', { class: 'login' },
    h('header', { class: 'hero' },
      h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK' }),
      h('h1', { class: 'mincho' }, 'つくる人の想いを、', h('br'), '食の未来へつなぐ。'),
      h('p', {}, 'H-LINKは、生産者の皆さまと市場をつなぎ、安定した出荷・販売、そして持続可能な食の未来を共につくります。')),
    h('main', { class: 'login-body' }, h('div', { class: 'login-card' },
      h('h2', {}, '生産者ポータル'), h('p', { class: 'sub' }, '出荷・売上管理ダッシュボード  PRODUCER PORTAL'),
      form,
      h('p', { class: 'hint' }, 'IDまたはパスワードをお忘れの場合は、H-LINK担当者へご連絡ください。5回続けて間違えると15分間ロックされます。'),
      h('div', { class: 'pillars' }, h('span', {}, '🗻 地域の力をつなぐ'), h('span', {}, '👥 人と産地をつなぐ'), h('span', {}, '🌐 食の可能性をひらく'))))));
  id.focus();
}

/* ---------- パスワード変更 ---------- */
function passwordForm(onDone, forced) {
  const err = errBox(), ok = h('div', { class: 'okmsg', hidden: true });
  const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 10 });
  const cf = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  return h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true;
    if (nw.value !== cf.value) return showErr(err, '新しいパスワードが一致しません。');
    try { await api('/api/password', { method: 'POST', body: { current: cur.value, next: nw.value } }); state.mustChange = false; ok.textContent = 'パスワードを変更しました。他の端末はログアウトされました。'; ok.hidden = false; cur.value = nw.value = cf.value = ''; onDone?.(); }
    catch (ex) { showErr(err, ex.message); }
  } },
    forced && h('p', { class: 'hint' }, '初回ログインのため、パスワードの変更が必要です。'),
    field('現在のパスワード', cur), field('新しいパスワード', nw, '10文字以上・英字と数字を含める'), field('新しいパスワード（確認）', cf),
    err, ok, h('button', { class: 'btn block', type: 'submit' }, '変更する'));
}
function renderForcedChange() {
  clear(root);
  root.append(h('div', { class: 'login' }, h('header', { class: 'hero' }, h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK' }), h('h1', {}, 'パスワードの設定')),
    h('main', { class: 'login-body' }, h('div', { class: 'login-card' }, h('h2', {}, 'パスワードを変更してください'), passwordForm(() => start(), true),
      h('p', { class: 'hint' }, h('button', { class: 'btn ghost sm', onclick: logout }, 'ログアウト'))))));
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* 既に失効 */ }
  state.me = null; state.csrf = ''; renderLogin();
}

/* ---------- アプリ枠 ---------- */
const NAV = [
  ['home', '🏠', 'ホーム'], ['orders', '📄', '注文管理'], ['shipments', '🚚', '出荷管理'], ['products', '📦', '商品管理'], ['stock', '🧊', '在庫管理'],
  ['sales', '📊', '売上管理'], ['settlement', '💴', '精算・振込'], ['lots', '🔎', 'トレーサビリティ'], ['notices', '🔔', 'お知らせ'], ['support', '🎧', 'サポート'],
];
const TITLES = Object.fromEntries(NAV.map(([k, , t]) => [k, t]));
let unread = 0;

function shell() {
  clear(root);
  const side = h('nav', { class: `side${state.navOpen ? ' open' : ''}`, 'aria-label': 'メインメニュー' },
    h('a', { class: 'logo', href: '#home' }, h('img', { src: '/brand/logo-horizontal.png', alt: 'H-LINK' })),
    NAV.map(([k, ic, t]) => h('a', { class: `nav${state.route === k ? ' on' : ''}`, href: `#${k}`, 'aria-current': state.route === k ? 'page' : null }, h('span', { class: 'ic' }, ic), t)),
    h('div', { class: 'spacer' }),
    h('button', { class: 'nav', onclick: () => modal('パスワード変更', () => passwordForm()) }, h('span', { class: 'ic' }, '🔑'), 'パスワード変更'),
    h('button', { class: 'nav', onclick: logout }, h('span', { class: 'ic' }, '↩'), 'ログアウト'));
  const scrim = h('div', { class: `scrim${state.navOpen ? ' open' : ''}`, onclick: () => { state.navOpen = false; shell(); route(); } });
  const bell = h('button', { class: 'bell', 'aria-label': `お知らせ ${unread}件`, onclick: () => { location.hash = 'notices'; } }, '🔔', unread ? h('b', {}, unread) : null);
  const page = h('div', { class: 'page', id: 'page' });
  root.append(h('div', { class: 'app' }, side, scrim, h('div', { class: 'main' },
    h('header', { class: 'top' },
      h('button', { class: 'menu-btn', 'aria-label': 'メニュー', onclick: () => { state.navOpen = !state.navOpen; side.classList.toggle('open', state.navOpen); scrim.classList.toggle('open', state.navOpen); } }, '☰'),
      h('h1', {}, state.route === 'home' ? `${state.me.name}さん、こんにちは` : TITLES[state.route], h('small', {}, state.route === 'home' ? 'いつもH-LINKをご利用いただきありがとうございます。' : state.me.name)),
      bell,
      h('div', { class: 'who' }, h('span', { class: 'av' }, '👤'), h('div', { class: 't' }, state.me.name, h('small', {}, `生産者ID：${state.me.id}`)))),
    page)));
  return page;
}

async function route() {
  if (!state.me) return;
  const r = (location.hash || '#home').slice(1);
  state.route = TITLES[r] ? r : 'home';
  const page = shell();
  page.append(h('p', { class: 'empty' }, '読み込み中…'));
  try { clear(page); await VIEWS[state.route](page); }
  catch (e) { if (e.code === 'password_change_required') return renderForcedChange(); clear(page); page.append(h('div', { class: 'err' }, e.message)); }
}
window.addEventListener('hashchange', () => { state.navOpen = false; route(); });

/* ---------- 画面 ---------- */
const orderTable = (orders, extra) => h('div', { class: 'tw' }, h('table', {},
  h('thead', {}, h('tr', {}, ['日付', '取引先', '商品', '数量', '金額', '状態', extra ? '' : null].map((t) => t != null && h('th', { class: t === '数量' || t === '金額' ? 'num' : '' }, t)))),
  h('tbody', {}, orders.map((o) => h('tr', {}, h('td', {}, md(o.date)), h('td', {}, o.buyer), h('td', {}, o.product), h('td', { class: 'num' }, `${o.qty}${o.unit}`), h('td', { class: 'num' }, yen(o.amount)), h('td', {}, pill(o.status)), extra && h('td', {}, extra(o)))))));

function diff(v) { return v == null ? '' : h('span', { class: v >= 0 ? 'up' : 'down' }, `${v >= 0 ? '+' : ''}${v}%`); }
function kpi(ico, label, value, sub) { return h('div', { class: 'card kpi' }, h('div', { class: 'ico' }, ico), h('div', {}, h('small', {}, label), h('strong', {}, value), h('small', {}, sub))); }

const VIEWS = {
  async home(page) {
    const d = await api('/api/dashboard'); unread = d.unread;
    const max = Math.max(1, ...d.chart.map((c) => c.amount));
    page.append(
      h('div', { class: 'kpis' },
        kpi('📄', '今月の受注件数', `${d.orders.count}件`, ['前月比 ', diff(d.orders.diff)]),
        kpi('🚚', '出荷予定', `${d.shipments}件`, '今週'),
        kpi('📊', '今月の売上', yen(d.sales.amount), ['前月比 ', diff(d.sales.diff)]),
        kpi('💴', '振込予定額', yen(d.payout.amount), `${d.payout.month.replace('-', '年')}月分`)),
      d.lowStock ? h('div', { class: 'card', style: 'margin-top:14px' }, h('span', { class: 'low' }, `⚠ 在庫が安全在庫以下の商品が${d.lowStock}件あります。`), ' ', h('a', { href: '#stock' }, '在庫管理へ')) : null,
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', {}, '売上推移', h('span', { class: 'hint' }, '月別')),
          h('div', { class: 'chart', role: 'img', 'aria-label': '月別売上の棒グラフ' }, d.chart.map((c) => h('div', { class: 'col' }, h('span', { class: 'v' }, c.amount ? `${Math.round(c.amount / 1000)}k` : ''), h('div', { class: 'bar', style: `height:${(c.amount / max) * 85}%` })))),
          h('div', { class: 'xl' }, d.chart.map((c) => h('span', {}, `${Number(c.month.slice(5))}月`)))),
        h('div', { class: 'card' }, h('h2', {}, '直近の注文', h('a', { href: '#orders', style: 'font-size:12px' }, 'すべて見る ›')), orderTable(d.recent))));
  },

  async orders(page) {
    const { orders } = await api('/api/orders');
    const filter = h('select', { 'aria-label': '状態で絞り込み', onchange: draw }, h('option', { value: '' }, 'すべての状態'), ['注文確定', '出荷準備中', '出荷済み', '納品完了'].map((s) => h('option', {}, s)));
    const box = h('div', { class: 'card' });
    function draw() {
      clear(box);
      const list = orders.filter((o) => !filter.value || o.status === filter.value);
      box.append(list.length ? orderTable(list, (o) => (o.status === '注文確定' || o.status === '出荷準備中') && h('button', { class: 'btn sm', onclick: async (e) => {
        e.target.disabled = true;
        try { const r = await api(`/api/orders/${o.id}/advance`, { method: 'POST' }); Object.assign(o, r.order); toast(`「${r.order.status}」に更新しました`); draw(); } catch (ex) { toast(ex.message); e.target.disabled = false; }
      } }, o.status === '注文確定' ? '出荷準備へ' : '出荷済みにする')) : h('p', { class: 'empty' }, '該当する注文はありません。'));
    }
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, `注文一覧（${orders.length}件）`), filter), box); draw();
  },

  async shipments(page) {
    const { orders } = await api('/api/orders');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + i - 2); return d.toISOString().slice(0, 10); });
    const live = orders.filter((o) => o.status !== '納品完了');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '出荷スケジュール'), h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: () => window.print() }, '🖨 出荷リストを印刷'))),
      h('div', { class: 'cal' }, days.map((d) => h('div', { class: `day${d === today.toISOString().slice(0, 10) ? ' today' : ''}` }, h('b', {}, md(d)),
        live.filter((o) => o.shipDate === d).map((o) => h('div', { class: `ev${o.status === '出荷済み' ? ' s' : ''}`, title: `${o.buyer} ${o.product}` }, `${o.buyer} ${o.qty}${o.unit}`))))),
      h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, '出荷対象の注文'), live.length ? orderTable(live.sort((a, b) => a.shipDate.localeCompare(b.shipDate))) : h('p', { class: 'empty' }, '出荷待ちの注文はありません。')));
  },

  async products(page) {
    const { products } = await api('/api/products');
    const open = (p) => modal(p ? '商品を編集' : '商品を登録', (close) => {
      const v = p || { name: '', spec: '', price: 0, unit: '箱', safety: 0, stock: 0, emoji: '🌱' };
      const f = { name: h('input', { value: v.name, maxlength: 60, required: true }), spec: h('input', { value: v.spec, maxlength: 60 }), price: h('input', { type: 'number', min: 0, value: v.price }), unit: h('input', { value: v.unit, maxlength: 6, required: true }), stock: h('input', { type: 'number', min: 0, value: v.stock }), safety: h('input', { type: 'number', min: 0, value: v.safety }), emoji: h('input', { value: v.emoji, maxlength: 4 }) };
      const err = errBox();
      return h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true;
        try { await api(p ? `/api/products/${p.id}` : '/api/products', { method: p ? 'PUT' : 'POST', body: { name: f.name.value, spec: f.spec.value, price: +f.price.value, unit: f.unit.value, stock: +f.stock.value, safety: +f.safety.value, emoji: f.emoji.value } }); close(); toast('保存しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        h('div', { class: 'form-grid' }, h('div', { class: 'full' }, field('商品名', f.name)), h('div', { class: 'full' }, field('規格', f.spec)), field('単価（円）', f.price), field('単位', f.unit), field('在庫数', f.stock), field('安全在庫', f.safety), field('アイコン（絵文字）', f.emoji)),
        err, h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'キャンセル'), h('button', { class: 'btn', type: 'submit' }, '保存')));
    });
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, `商品一覧（${products.length}件）`), h('button', { class: 'btn', onclick: () => open() }, '＋ 商品を登録')),
      products.length ? h('div', { class: 'prod' }, products.map((p) => h('div', { class: 'card' }, h('div', { class: 'em' }, p.emoji), h('h2', { style: 'margin-top:6px' }, p.name), h('div', { class: 'hint' }, p.spec || '—'), h('p', {}, h('strong', {}, yen(p.price)), ` / ${p.unit}`),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: () => open(p) }, '編集'), h('button', { class: 'btn ghost sm', onclick: async () => { if (!confirm(`「${p.name}」を削除しますか？`)) return; try { await api(`/api/products/${p.id}`, { method: 'DELETE' }); toast('削除しました'); route(); } catch (ex) { toast(ex.message); } } }, '削除'))))) : h('p', { class: 'empty' }, '商品が登録されていません。'));
  },

  async stock(page) {
    const { products } = await api('/api/products');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '在庫管理'), h('span', { class: 'hint' }, '出荷済みにすると在庫が自動で減ります。')),
      h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['商品', '規格', '在庫', '安全在庫', '在庫を更新'].map((t) => h('th', { class: t === '在庫' || t === '安全在庫' ? 'num' : '' }, t)))),
        h('tbody', {}, products.map((p) => { const inp = h('input', { type: 'number', min: 0, value: p.stock, 'aria-label': `${p.name}の在庫数`, style: 'width:90px' }); const cell = h('td', { class: `num${p.stock <= p.safety ? ' low' : ''}` }, `${p.stock}${p.unit}`);
          return h('tr', {}, h('td', {}, `${p.emoji} ${p.name}`), h('td', {}, p.spec), cell, h('td', { class: 'num' }, `${p.safety}${p.unit}`),
            h('td', {}, h('div', { class: 'row' }, inp, h('button', { class: 'btn sm', onclick: async () => { try { const r = await api(`/api/products/${p.id}/stock`, { method: 'POST', body: { stock: +inp.value } }); toast('在庫を更新しました'); cell.textContent = `${r.product.stock}${p.unit}`; cell.className = `num${r.product.stock <= p.safety ? ' low' : ''}`; } catch (ex) { toast(ex.message); } } }, '更新'))));
        })))));
  },

  async sales(page) {
    const s = await api('/api/sales');
    const max = Math.max(1, ...s.months.map((m) => m.amount)), pmax = Math.max(1, ...s.products.map((p) => p.amount));
    page.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, '月別売上'), h('div', { class: 'bars' }, s.months.map((m) => h('div', { class: 'hbar' }, h('span', {}, m.month), h('i', { style: `width:${(m.amount / max) * 100}%` }), h('span', { class: 'num' }, yen(m.amount)))))),
      h('div', { class: 'card' }, h('h2', {}, '商品別売上（累計）'), h('div', { class: 'bars' }, s.products.map((p) => h('div', { class: 'hbar' }, h('span', {}, p.name), h('i', { style: `width:${(p.amount / pmax) * 100}%` }), h('span', { class: 'num' }, yen(p.amount))))))));
  },

  async settlement(page) {
    const { settlements } = await api('/api/settlements');
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, '月次精算・振込')),
      h('div', { class: 'card tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['対象月', '売上', '手数料(8%)', '振込額', '振込予定日', '状態', '明細'].map((t) => h('th', { class: ['売上', '手数料(8%)', '振込額'].includes(t) ? 'num' : '' }, t)))),
        h('tbody', {}, settlements.map((s) => h('tr', {}, h('td', {}, s.month), h('td', { class: 'num' }, yen(s.sales)), h('td', { class: 'num' }, yen(-s.fee)), h('td', { class: 'num' }, h('strong', {}, yen(s.payout))), h('td', {}, s.transferDate), h('td', {}, pill(s.status)),
          h('td', {}, h('button', { class: 'btn ghost sm', onclick: async () => { try { const res = await api(`/api/settlements/${s.month}/csv`, { raw: true }); const url = URL.createObjectURL(await res.blob()); const a = h('a', { href: url, download: `settlement-${s.month}.csv` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); } catch (ex) { toast(ex.message); } } }, '⬇ CSV'))))))));
  },

  async lots(page) {
    const [{ lots }, { products }] = await Promise.all([api('/api/lots'), api('/api/products')]);
    const open = () => modal('ロットを登録', (close) => {
      const sel = h('select', { required: true }, products.map((p) => h('option', { value: p.id }, p.name)));
      const f = { lot: h('input', { maxlength: 30, required: true }), field: h('input', { maxlength: 40, required: true }), harvest: h('input', { type: 'date', required: true }), ship: h('input', { type: 'date' }), note: h('textarea', { rows: 2, maxlength: 200 }) };
      const err = errBox();
      return h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { await api('/api/lots', { method: 'POST', body: { productId: sel.value, lot: f.lot.value, field: f.field.value, harvestDate: f.harvest.value, shipDate: f.ship.value, note: f.note.value } }); close(); toast('登録しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        field('商品', sel), field('ロット番号', f.lot), field('圃場・産地', f.field), field('収穫日', f.harvest), field('出荷日', f.ship), field('備考', f.note), err,
        h('div', { class: 'row end', style: 'margin-top:16px' }, h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'キャンセル'), h('button', { class: 'btn', type: 'submit' }, '登録')));
    });
    page.append(h('div', { class: 'toolbar' }, h('h2', {}, 'ロット管理（トレーサビリティ）'), h('button', { class: 'btn', onclick: open }, '＋ ロットを登録')),
      h('div', { class: 'card tw' }, lots.length ? h('table', {}, h('thead', {}, h('tr', {}, ['ロット', '商品', '圃場・産地', '収穫日', '出荷日', '備考'].map((t) => h('th', {}, t)))),
        h('tbody', {}, lots.map((l) => h('tr', {}, h('td', {}, l.lot), h('td', {}, l.product), h('td', {}, l.field), h('td', {}, l.harvestDate), h('td', {}, l.shipDate || '—'), h('td', {}, l.note))))) : h('p', { class: 'empty' }, 'ロットが登録されていません。')));
  },

  async notices(page) {
    const { notices } = await api('/api/notices');
    unread = notices.filter((n) => !n.read).length;
    page.append(h('div', { class: 'card' }, notices.map((n) => h('div', { class: `notice${n.read ? '' : ' unread'}` }, h('div', {}, h('strong', {}, n.title), ' ', h('time', {}, n.at.slice(0, 10)), h('p', {}, n.body), !n.read && h('button', { class: 'btn ghost sm', style: 'margin-top:6px', onclick: async () => { await api(`/api/notices/${n.id}/read`, { method: 'POST' }); route(); } }, '既読にする'))))));
  },

  async support(page) {
    const { tickets } = await api('/api/tickets');
    const subject = h('input', { maxlength: 80, required: true }), body = h('textarea', { rows: 4, maxlength: 2000, required: true }), err = errBox();
    page.append(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, 'お問い合わせ'), h('form', { onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { await api('/api/tickets', { method: 'POST', body: { subject: subject.value, body: body.value } }); toast('送信しました'); route(); } catch (ex) { showErr(err, ex.message); } } },
        field('件名', subject), field('内容', body), err, h('button', { class: 'btn block', type: 'submit' }, '新規チケットを作成'))),
      h('div', { class: 'card' }, h('h2', {}, '問い合わせ履歴'), tickets.length ? tickets.map((t) => h('div', { class: 'notice', style: 'padding-left:0' }, h('div', {}, h('strong', {}, t.subject), ' ', pill(t.status), h('p', {}, t.body), h('time', {}, `${t.id}・${t.at.slice(0, 10)}`)))) : h('p', { class: 'empty' }, '履歴はありません。'))));
  },
};

/* ---------- 起動 ---------- */
function start() { if (state.mustChange) return renderForcedChange(); route(); }
(async () => {
  try {
    const me = await fetch('/api/me', { credentials: 'same-origin' });
    if (me.ok) { const j = await me.json(); state.csrf = j.csrf; state.me = j.producer; state.mustChange = j.mustChange; return start(); }
  } catch { /* オフライン */ }
  renderLogin();
})();
