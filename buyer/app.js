/* H-LINK バイヤーポータル — 卸受注ダッシュボード（デモ）
   静的ファイルのみ。データはブラウザの localStorage に保存します。 */
'use strict';

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => { d = new Date(d); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`; };
const fmtDT = d => { d = new Date(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d.toISOString(); };
const icon = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;

/* ---------- master data ---------- */
const CATS = [
  { id: '水産物', emoji: '🐟', bg: 'linear-gradient(135deg,#dff1fb,#bfe3f5)' },
  { id: '農産物', emoji: '🥬', bg: 'linear-gradient(135deg,#e4f5dc,#c6e8b5)' },
  { id: '畜産物', emoji: '🥩', bg: 'linear-gradient(135deg,#fde4e4,#f6bcbc)' },
  { id: '加工食品', emoji: '🍜', bg: 'linear-gradient(135deg,#fdf0d6,#f6dca1)' },
  { id: '飲料', emoji: '🍵', bg: 'linear-gradient(135deg,#e4f3e6,#c3e4c8)' },
  { id: '調味料', emoji: '🍶', bg: 'linear-gradient(135deg,#f6e8d8,#e8cba6)' },
  { id: '健康・機能性', emoji: '🌿', bg: 'linear-gradient(135deg,#e8f3e0,#cfe6b8)' },
  { id: 'その他', emoji: '📦', bg: 'linear-gradient(135deg,#ececf2,#d5d6e2)' },
];
const catOf = id => CATS.find(c => c.id === id) || CATS[7];
const COUNTRIES = ['シンガポール', '香港', '台湾', '韓国', 'タイ', 'ベトナム', 'マレーシア', '米国', 'アラブ首長国連邦', 'その他'];
const STAGES = ['受付', '製造準備中', '出荷準備', '出荷', '配送中', '配送完了'];
const STAGE_LABEL = ['受付済', '製造準備中', '出荷準備中', '出荷済み', '配送中', '配送完了'];
const STAGE_CHIP = ['gray', 'blue', 'blue', 'green', 'amber', 'green'];

const SUP = {
  hokkaido: '北海道フードパートナーズ株式会社',
  kyushu: '九州ミートファクトリー株式会社',
  doo: '道央フルーツ協同組合',
  tochigi: '栃木ベリーファーム',
  kita: '北のこめ工房',
  seto: '瀬戸内水産株式会社',
  tsugaru: '津軽アップルグロワーズ',
  hakata: '博多麺工房',
  shizuoka: '静岡茶業協同組合',
  shodo: '小豆島醸造所',
  satsuma: '薩摩黒酢本舗',
  pack: '関西パッケージ株式会社',
};

const P = (id, name, sup, cat, origin, temp, unit, tiers, stock, stockLabel, certs, img, emoji, desc, extra = {}) =>
  ({ id, name, sup, cat, origin, temp, unit, tiers, stock, stockLabel, certs, img, emoji, desc, ...extra });

const PRODUCTS = [
  P('scallop', '北海道産 ホタテ（冷凍）', SUP.hokkaido, '水産物', '北海道', '冷凍', 'kg', [[20, 2800], [100, 2650], [500, 2500]], 1200, 'ok', ['HACCP', '産地証明'], 'assets/p-scallop.jpg', '🦪', '北海道オホーツク海産の大粒ホタテ貝柱。急速冷凍で鮮度とうま味を保持。', { pack: '1kg×10袋', shelf: '冷凍 18か月', lead: '受注後 7〜10日で出荷' }),
  P('wagyu', '国産和牛 サーロイン', SUP.kyushu, '畜産物', '熊本県', '冷凍', 'kg', [[10, 8000], [50, 7500], [200, 7000]], 500, 'ok', ['輸出証明書', '産地証明', 'HACCP'], 'assets/p-wagyu.jpg', '🥩', 'きめ細かなサシと上品な甘みの A4/A5 国産和牛サーロイン。真空パックで輸出に対応。', { pack: '真空パック 約5kg/箱', shelf: '冷凍 12か月', lead: '受注後 10〜14日で出荷' }),
  P('melon', '北海道産 メロン', SUP.doo, '農産物', '北海道', '冷蔵', '箱', [[10, 3500], [50, 3300], [200, 3100]], 800, 'ok', ['GLOBALG.A.P.'], 'assets/p-melon.jpg', '🍈', '糖度 14 度以上を厳選した赤肉メロン。海外向けに空輸対応の専用箱で出荷。', { pack: '2玉/箱（約3kg）', shelf: '冷蔵 10日', lead: '受注後 5〜7日で出荷' }),
  P('salmon', '北海道産 トラウトサーモン フィレ（冷凍）', SUP.hokkaido, '水産物', '北海道', '冷凍', 'kg', [[20, 2400], [100, 2250]], 900, 'ok', ['HACCP', '産地証明'], 'assets/p-salmon.jpg', '🍣', '脂ののった養殖トラウトのフィレ。刺身・加熱どちらにも使える業務用規格。', { pack: '1kg×10袋', shelf: '冷凍 12か月', lead: '受注後 7日で出荷' }),
  P('strawberry', '冷凍いちご（とちおとめ）', SUP.tochigi, '農産物', '栃木県', '冷凍', 'kg', [[20, 850], [100, 790], [500, 720]], 3000, 'ok', ['HACCP'], 'assets/p-strawberry.jpg', '🍓', '完熟で収穫して急速凍結。スムージー・製菓・デザート用に。', { pack: '1kg×10袋', shelf: '冷凍 18か月', lead: '受注後 5日で出荷' }),
  P('rice', '北海道産 米（ゆめぴりか）', SUP.kita, '農産物', '北海道', '常温', 'kg', [[100, 400], [1000, 370]], 20000, 'ok', ['産地証明', '輸出証明書'], 'assets/p-rice.jpg', '🍚', 'もちもちとした粘りと甘みが特長。輸出用の 10kg/25kg 規格に対応。', { pack: '10kg/袋', shelf: '常温 12か月', lead: '受注後 7日で出荷' }),
  P('beef2', '黒毛和牛 肩ロース スライス', SUP.kyushu, '畜産物', '熊本県', '冷凍', 'kg', [[10, 5200], [50, 4900]], 60, 'low', ['輸出証明書', 'HACCP'], 'assets/p-beef2.jpg', '🥓', 'すき焼き・しゃぶしゃぶ用にスライスした肩ロース。', { pack: '真空 500g×10', shelf: '冷凍 12か月', lead: '受注後 10日で出荷' }),
  P('tai', '愛媛県産 真鯛 フィレ（冷蔵）', SUP.seto, '水産物', '愛媛県', '冷蔵', 'kg', [[30, 1900], [100, 1750]], 0, 'pre', ['HACCP'], null, '🐟', '瀬戸内で育った養殖真鯛。下処理済みフィレで飲食店向け。', { pack: '2kg/箱', shelf: '冷蔵 5日', lead: '予約受付：2週間後から出荷' }),
  P('apple', '青森県産 ふじりんご', SUP.tsugaru, '農産物', '青森県', '冷蔵', '箱', [[20, 3200], [100, 3000]], 1500, 'ok', ['GLOBALG.A.P.', '産地証明'], null, '🍎', '蜜入りの大玉ふじ。輸出向けに選果・ワックス処理済み。', { pack: '10kg/箱（28玉）', shelf: '冷蔵 2か月', lead: '受注後 5日で出荷' }),
  P('ramen', '無添加 冷凍ラーメン（醤油）', SUP.hakata, '加工食品', '福岡県', '冷凍', 'ケース', [[50, 4800], [200, 4500]], 600, 'ok', ['HACCP', 'ハラール'], null, '🍜', '化学調味料不使用のスープと細麺のセット。1ケース 30食。', { pack: '30食/ケース', shelf: '冷凍 9か月', lead: '受注後 10日で出荷' }),
  P('matcha', '静岡県産 抹茶パウダー（業務用）', SUP.shizuoka, '飲料', '静岡県', '常温', 'kg', [[5, 9800], [30, 9200]], 120, 'ok', ['有機JAS', 'HACCP'], null, '🍵', '石臼挽きの鮮やかな緑。ラテ・製菓・アイス向けの業務用 500g 缶入り。', { pack: '500g缶×4', shelf: '常温 12か月', lead: '受注後 5日で出荷' }),
  P('shoyu', '国産丸大豆 醤油（1L）', SUP.shodo, '調味料', '香川県', '常温', '本', [[100, 480], [500, 430]], 5000, 'ok', ['HACCP', 'ハラール'], null, '🍶', '木桶仕込みの丸大豆醤油。やわらかなコクと香り。', { pack: '1L×6本/箱', shelf: '常温 24か月', lead: '受注後 7日で出荷' }),
  P('kurozu', '薩摩 黒酢ドリンク（健康・機能性表示）', SUP.satsuma, '健康・機能性', '鹿児島県', '常温', '本', [[60, 690], [300, 620]], 900, 'low', ['HACCP', '有機JAS'], null, '🌿', '壺造り黒酢を飲みやすく仕立てた機能性ドリンク。', { pack: '720ml×12本', shelf: '常温 18か月', lead: '受注後 10日で出荷' }),
  P('vacbag', '食品用 真空包装資材（冷凍対応）', SUP.pack, 'その他', '大阪府', '常温', 'ロール', [[10, 3600], [50, 3300]], 400, 'ok', ['HACCP'], null, '📦', '輸出冷凍食品の梱包に適した耐寒・高バリアの真空袋ロール。', { pack: '10ロール/箱', shelf: '常温 24か月', lead: '受注後 5日で出荷' }),
];
const prod = id => PRODUCTS.find(p => p.id === id);
const minPrice = p => p.tiers[0][1];
const moq = p => p.tiers[0][0];
const priceFor = (p, q) => { let v = p.tiers[0][1]; for (const [m, pr] of p.tiers) if (q >= m) v = pr; return v; };
const stockHtml = p => `<span class="stock ${p.stockLabel === 'low' ? 'low' : p.stockLabel === 'pre' ? 'pre' : ''}">${p.stockLabel === 'low' ? '残りわずか' : p.stockLabel === 'pre' ? '予約受付' : '在庫あり'}</span>`;
const thumb = (p, cls = '') => p.img ? `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy">` : `<span class="${cls}" aria-hidden="true">${p.emoji}</span>`;
const thumbBox = p => p.img ? `<img src="${p.img}" alt="">` : `<span aria-hidden="true">${p.emoji}</span>`;
const tierLabel = (p, i) => { const t = p.tiers, a = t[i][0], b = t[i + 1]; return b ? `${a} – ${b[0] - 1} ${p.unit}` : `${a} ${p.unit} 以上`; };

/* ---------- state ---------- */
const KEY = 'hlink-buyer-v1';
const seed = () => {
  const mk = (daysBack, no, pid, qty, stage) => {
    const p = prod(pid), dates = [];
    for (let i = 0; i <= stage; i++) dates.push(daysAgo(Math.max(daysBack - i * 2, 0)));
    return { no, date: daysAgo(daysBack), pid, qty, amount: qty * priceFor(p, qty), stage, dates };
  };
  const ymd = n => fmtDate(daysAgo(n)).replace(/\//g, '');
  return {
    profile: { company: 'Sunrise Trading Pte. Ltd.', name: 'バイヤー', email: 'buyer@example.com', country: 'シンガポール', tel: '+65 6000 0000', addrs: ['Sunrise Trading Pte. Ltd. / 1 Harbour Road, Singapore 049213', 'Sunrise Trading 第2倉庫 / 22 Tuas South Ave, Singapore 637100'], notify: { order: true, quote: true, msg: true, news: false } },
    favs: ['scallop', 'wagyu', 'melon'],
    orders: [
      mk(3, `HL-${ymd(3)}-001`, 'scallop', 100, 1),
      mk(10, `HL-${ymd(10)}-003`, 'wagyu', 50, 3),
      mk(16, `HL-${ymd(16)}-007`, 'melon', 20, 4),
      mk(45, `HL-${ymd(45)}-002`, 'salmon', 40, 5),
      mk(70, `HL-${ymd(70)}-005`, 'rice', 500, 5),
    ],
    quotes: [{ no: `QT-${ymd(2)}-01`, date: daysAgo(2), pid: 'kurozu', qty: 300, country: 'シンガポール', msg: '年間契約を想定しています。', status: '回答待ち' }],
    samples: [{ no: `SP-${ymd(5)}-01`, date: daysAgo(5), pid: 'matcha', qty: 1, to: 'Sunrise Trading Pte. Ltd.', status: '発送済み' }],
    notifs: [
      { msg: '北海道フードパートナーズからメッセージが届きました', date: daysAgo(0), read: false, to: '#/messages' },
      { msg: `注文 HL-${ymd(10)}-003 が出荷されました`, date: daysAgo(1), read: false, to: '#/orders' },
      { msg: 'お気に入りの「国産和牛 サーロイン」の在庫が更新されました', date: daysAgo(3), read: true, to: '#/product/wagyu' },
    ],
    threads: [
      { id: 'hokkaido', sup: SUP.hokkaido, role: 'サプライヤー', unread: 1, msgs: [
        { me: true, t: 'この商品の輸出に必要な書類について教えていただけますか？', d: daysAgo(0) },
        { me: false, t: 'お問い合わせありがとうございます。\n輸出証明書・原産地証明書の発行が可能です。\n詳しい手続きについてご案内いたします。', d: daysAgo(0) },
        { me: false, t: '', file: { name: '輸出関連資料.pdf', size: '1.2MB' }, d: daysAgo(0) },
      ] },
      { id: 'kyushu', sup: SUP.kyushu, role: 'サプライヤー', unread: 0, msgs: [
        { me: false, t: 'サーロインの次回ロットは来週入荷予定です。ご希望数量をお知らせください。', d: daysAgo(4) },
      ] },
    ],
  };
};
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.profile ? v : null; } catch { return null; } };
let S = load() || seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } };
const isFav = id => S.favs.includes(id);
const ymdNow = () => fmtDate(new Date()).replace(/\//g, '');
const seq = arr => pad(arr.length + 1);

/* ---------- ui helpers ---------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}
let lastFocus = null;
function openModal(html, mount) {
  const root = $('#modalRoot');
  lastFocus = document.activeElement;
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  const close = () => { root.hidden = true; root.innerHTML = ''; lastFocus?.focus?.(); };
  root.onclick = e => { if (e.target === root) close(); };
  $$('[data-close]', root).forEach(b => b.onclick = close);
  mount?.(root, close);
  ($('input,select,textarea,button.btn', root))?.focus();
  return close;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#modalRoot').hidden) { $('#modalRoot').hidden = true; $('#modalRoot').innerHTML = ''; }
    closeMenu(); closeBell();
  }
});
const notify = (msg, to = '#/') => { S.notifs.unshift({ msg, date: new Date().toISOString(), read: false, to }); save(); refreshChrome(); };

function toggleFav(id) {
  const i = S.favs.indexOf(id);
  if (i >= 0) { S.favs.splice(i, 1); toast('お気に入りから削除しました'); } else { S.favs.push(id); toast('お気に入りに追加しました'); }
  save(); refreshChrome();
}
const heartBtn = id => `<button class="heart ${isFav(id) ? 'on' : ''}" data-fav="${id}" aria-label="お気に入り" aria-pressed="${isFav(id)}">${icon('heart')}</button>`;
function bindFavs(root) {
  $$('[data-fav]', root).forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    toggleFav(b.dataset.fav);
    const on = isFav(b.dataset.fav);
    $$(`[data-fav="${b.dataset.fav}"]`).forEach(x => { x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    if (route.name === 'favorites') render();
  });
}

function tracker(o) {
  return `<div class="tracker" role="list">${STAGES.map((s, i) => {
    const cls = i < o.stage ? 'done' : i === o.stage ? 'done now' : 'todo';
    const d = o.dates[i] ? fmtDate(o.dates[i]).slice(5) : '';
    return `<div class="tstep ${cls}" role="listitem"><i>${i <= o.stage ? icon('check') : ''}</i><b>${s}</b>${d}</div>`;
  }).join('')}</div>`;
}

function productCard(p) {
  return `<a class="pcard" href="#/product/${p.id}">
    <div class="pimg" style="${p.img ? '' : 'background:' + catOf(p.cat).bg}">${thumb(p)}${heartBtn(p.id)}</div>
    <div class="pbody">
      <div class="pname">${esc(p.name)}</div>
      <div class="pmeta">MOQ ${moq(p)}${p.unit} ・ ${esc(p.origin)}</div>
      <div class="pprice">${yen(minPrice(p))}<small> /${p.unit}〜</small></div>
      ${stockHtml(p)}
    </div></a>`;
}

/* ---------- order / request actions ---------- */
function createOrder(pid, qty) {
  const p = prod(pid);
  const o = { no: `HL-${ymdNow()}-${pad(S.orders.length + 1).padStart(3, '0')}`, date: new Date().toISOString(), pid, qty, amount: qty * priceFor(p, qty), stage: 0, dates: [new Date().toISOString()] };
  S.orders.unshift(o);
  notify(`注文 ${o.no} を受け付けました`, '#/orders');
  return o;
}
function orderModal(pid, defQty) {
  const p = prod(pid);
  openModal(`<button class="x" data-close aria-label="閉じる">${icon('close')}</button>
    <h3>注文内容の確認</h3><p class="pmeta">${esc(p.name)} ／ ${esc(p.sup)}</p>
    <label class="f" for="oq">数量（${p.unit}）　最小ロット ${moq(p)}${p.unit}</label>
    <input class="in" id="oq" type="number" min="${moq(p)}" step="1" value="${Math.max(defQty || moq(p), moq(p))}">
    <div class="calc"><div class="row"><span>単価 <b id="oup"></b></span><span class="total">合計（税抜）<br><b id="otot"></b></span></div></div>
    <label class="f" for="od">希望納品日</label><input class="in" id="od" type="date">
    <div class="foot"><button class="btn ghost" data-close>キャンセル</button><button class="btn" id="oGo">注文を確定する</button></div>`,
  (root, close) => {
    const q = $('#oq', root);
    const upd = () => { const n = +q.value || 0; $('#oup', root).textContent = yen(priceFor(p, n)) + '/' + p.unit; $('#otot', root).textContent = yen(n * priceFor(p, n)); };
    q.oninput = upd; upd();
    $('#oGo', root).onclick = () => {
      const n = +q.value;
      if (!(n >= moq(p))) { toast(`最小ロットは ${moq(p)}${p.unit} です`); q.focus(); return; }
      const o = createOrder(pid, n); close(); toast(`注文を受け付けました（${o.no}）`); location.hash = '#/orders';
    };
  });
}
function quoteModal(pid) {
  const p = prod(pid);
  openModal(`<button class="x" data-close aria-label="閉じる">${icon('close')}</button>
    <h3>見積依頼</h3><p class="pmeta">${esc(p.name)} ／ ${esc(p.sup)}</p>
    <div class="two"><div><label class="f" for="qq">希望数量（${p.unit}）</label><input class="in" id="qq" type="number" min="${moq(p)}" value="${moq(p)}"></div>
    <div><label class="f" for="qc">仕向国</label><select class="in" id="qc">${COUNTRIES.map(c => `<option ${c === S.profile.country ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
    <label class="f" for="qm">メッセージ（任意）</label><textarea class="in" id="qm" placeholder="希望納期、貿易条件（FOB/CIF など）、年間見込み数量など"></textarea>
    <div class="foot"><button class="btn ghost" data-close>キャンセル</button><button class="btn" id="qGo">見積を依頼する</button></div>`,
  (root, close) => {
    $('#qGo', root).onclick = () => {
      const n = +$('#qq', root).value;
      if (!(n >= 1)) { toast('数量を入力してください'); return; }
      const q = { no: `QT-${ymdNow()}-${seq(S.quotes)}`, date: new Date().toISOString(), pid, qty: n, country: $('#qc', root).value, msg: $('#qm', root).value.trim(), status: '回答待ち' };
      S.quotes.unshift(q); notify(`見積依頼 ${q.no} を送信しました`, '#/requests'); close(); toast('見積依頼を送信しました'); if (route.name === 'requests') render();
    };
  });
}

/* ---------- views ---------- */
const views = {};
const route = { name: 'home', args: [], q: new URLSearchParams() };

/* Dashboard (top page) */
const SLIDES = [
  { src: 'assets/hero-sunrise.webp', pos: '50% 18%', alt: 'H-LINK つなぐ、越える、食の可能性をひらく。' },
  { src: 'assets/hero-logo-left.webp', pos: '50% 12%', alt: 'H-LINK CONNECTING PEOPLE. REGIONS. THE WORLD' },
  { src: 'assets/hero-bridge.webp', pos: '50% 30%', alt: '食でつながる価値を、もっと大きく。 FOOD CONNECTS A BRIGHTER TOMORROW' },
];
let heroTimer = null;
views.home = () => {
  const inprog = S.orders.filter(o => o.stage < 5);
  const pend = S.quotes.filter(q => q.status === '回答待ち').length + S.samples.filter(s => s.status !== '完了').length;
  const unread = S.threads.reduce((a, t) => a + t.unread, 0);
  const reco = PRODUCTS.filter(p => p.img).slice(0, 5);
  return `<div class="page">
  <section class="hero" aria-roledescription="carousel" aria-label="H-LINK ブランドビジュアル">
    <div class="slides">${SLIDES.map((s, i) => `<div class="slide ${i === 0 ? 'on' : ''}" role="group" aria-label="${i + 1} / ${SLIDES.length}"><img src="${s.src}" alt="${esc(s.alt)}" style="object-position:${s.pos}" ${i ? 'loading="lazy"' : ''}></div>`).join('')}</div>
    <div class="hero-nav"><button id="hPrev" aria-label="前へ">${icon('chev')}</button><button id="hNext" aria-label="次へ">${icon('chev')}</button></div>
    <div class="dots">${SLIDES.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" data-dot="${i}" aria-label="スライド ${i + 1}"></button>`).join('')}</div>
  </section>
  <form class="hero-search" id="heroSearch">
    <h3>日本の食と、新たなビジネスの可能性を。</h3>
    <div class="hs-row">
      <input class="in main" id="hsQ" type="search" placeholder="商品名・キーワード・産地で検索" aria-label="キーワード">
      <select class="in" id="hsC" aria-label="カテゴリー"><option value="">すべてのカテゴリー</option>${CATS.map(c => `<option>${c.id}</option>`).join('')}</select>
      <select class="in" id="hsO" aria-label="産地"><option value="">産地</option>${[...new Set(PRODUCTS.map(p => p.origin))].map(o => `<option>${o}</option>`).join('')}</select>
      <button class="btn" type="submit">${icon('search')}検索</button>
    </div>
  </form>

  <div class="welcome"><div><h1>ようこそ、${esc(S.profile.name)}様</h1><p>${esc(S.profile.company)} ／ 本日の取引状況</p></div><a class="btn ghost" href="#/search">商品を探す ${icon('chev')}</a></div>
  <div class="kpis">
    <a class="kpi" href="#/orders"><span class="ico">${icon('clock')}</span><div><b>${inprog.length}</b><span>進行中の注文</span></div></a>
    <a class="kpi" href="#/requests"><span class="ico">${icon('doc')}</span><div><b>${pend}</b><span>見積・サンプル対応中</span></div></a>
    <a class="kpi" href="#/favorites"><span class="ico">${icon('heart')}</span><div><b>${S.favs.length}</b><span>お気に入り</span></div></a>
    <a class="kpi" href="#/messages"><span class="ico">${icon('chat')}</span><div><b>${unread}</b><span>未読メッセージ</span></div></a>
  </div>

  <section class="card" style="margin-bottom:18px"><h2>人気のカテゴリー <a href="#/categories">すべて見る ›</a></h2>
    <div class="cat-row">${CATS.map(c => `<a class="cat" href="#/search?cat=${encodeURIComponent(c.id)}"><span class="tile" style="background:${c.bg}">${c.emoji}</span>${c.id}</a>`).join('')}</div></section>

  <div class="cols-2" style="margin-bottom:18px">
    <section class="card"><h2>進行中の注文 <a href="#/orders">発注履歴へ ›</a></h2>
      ${inprog.length ? inprog.slice(0, 3).map(o => { const p = prod(o.pid); return `<div class="mini-order" style="grid-template-columns:auto 1fr"><div class="th">${thumbBox(p)}</div><div><b>${esc(p.name)} <span class="chip ${STAGE_CHIP[o.stage]}">${STAGE_LABEL[o.stage]}</span></b><small>${o.no} ・ ${o.qty}${p.unit} ・ ${yen(o.amount)}</small>${tracker(o)}</div></div>`; }).join('') : '<div class="empty">進行中の注文はありません</div>'}
    </section>
    <section class="card"><h2>お気に入りから再注文 <a href="#/favorites">お気に入りへ ›</a></h2>
      ${S.favs.length ? S.favs.slice(0, 4).map(id => { const p = prod(id); return p ? `<div class="mini-order"><div class="th">${thumbBox(p)}</div><div><b><a href="#/product/${p.id}">${esc(p.name)}</a></b><small>MOQ ${moq(p)}${p.unit} ・ ${yen(minPrice(p))}/${p.unit}〜</small></div><button class="btn sm" data-reorder="${p.id}">再注文</button></div>` : ''; }).join('') : '<div class="empty">お気に入りがまだありません</div>'}
    </section>
  </div>

  <section class="card" style="margin-bottom:18px"><h2>おすすめ商品 <a href="#/search">商品一覧へ ›</a></h2><div class="prod-grid">${reco.map(productCard).join('')}</div></section>

  <section class="brand-panel">
    <img src="assets/hero-bridge-portrait.webp" alt="H-LINK 食でつながる価値を、もっと大きく。" loading="lazy">
    <div class="txt"><span class="chip red" style="align-self:flex-start">BUYER PORTAL</span>
      <h2>食でつながる価値を、<br>もっと大きく。</h2>
      <p>H-LINK は、国内外のバイヤーと日本の食をつなぐ B2B マーケットプレイスです。商品探しから見積・サンプル・発注・配送までを、ひとつの画面で。</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#/search">商品を探す</a><a class="btn ghost" href="#/messages">サプライヤーに相談</a></div></div>
  </section>

  <section class="value-banner"><img src="assets/banner-landscape.jpg" alt=""><div>
    <div><h2>日本の食の価値を、世界の食卓へ。</h2><p>H-LINK は、国内外のバイヤーと日本の食をつなぎ、新たなビジネスと食の可能性を創造します。</p></div>
    <div class="vals">
      <div class="val"><i>${icon('handshake')}</i>多様な<br>サプライヤー</div>
      <div class="val"><i>${icon('globe')}</i>世界のバイヤーと<br>つながる</div>
      <div class="val"><i>${icon('chart')}</i>安定した<br>供給</div>
      <div class="val"><i>${icon('gem')}</i>高品質な<br>日本の食</div>
    </div></div></section>
  </div>`;
};
views.home.mount = root => {
  const slides = $$('.slide', root), dots = $$('[data-dot]', root);
  let cur = 0;
  const go = i => { cur = (i + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('on', k === cur)); dots.forEach((d, k) => d.classList.toggle('on', k === cur)); };
  const start = () => { stop(); if (!matchMedia('(prefers-reduced-motion:reduce)').matches) heroTimer = setInterval(() => go(cur + 1), 6000); };
  const stop = () => { clearInterval(heroTimer); heroTimer = null; };
  $('#hPrev', root).onclick = () => { go(cur - 1); start(); };
  $('#hNext', root).onclick = () => { go(cur + 1); start(); };
  dots.forEach(d => d.onclick = () => { go(+d.dataset.dot); start(); });
  const hero = $('.hero', root); hero.onmouseenter = stop; hero.onmouseleave = start; start();
  $('#heroSearch', root).onsubmit = e => {
    e.preventDefault();
    const p = new URLSearchParams();
    const q = $('#hsQ', root).value.trim(), c = $('#hsC', root).value, o = $('#hsO', root).value;
    if (q) p.set('q', q); if (c) p.set('cat', c); if (o) p.set('origin', o);
    location.hash = '#/search' + (p.toString() ? '?' + p : '');
  };
  $$('[data-reorder]', root).forEach(b => b.onclick = () => orderModal(b.dataset.reorder));
};

/* Categories */
views.categories = () => `<div class="page"><div class="page-head"><div><h1>カテゴリー</h1><p>カテゴリーから商品を探せます。</p></div></div>
  <div class="prod-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${CATS.map(c => {
    const n = PRODUCTS.filter(p => p.cat === c.id).length;
    return `<a class="pcard" href="#/search?cat=${encodeURIComponent(c.id)}"><div class="pimg" style="background:${c.bg};font-size:64px">${c.emoji}</div><div class="pbody"><div class="pname">${c.id}</div><div class="pmeta">${n} 商品</div></div></a>`;
  }).join('')}</div></div>`;

/* 01 Search */
const F = { q: '', cats: new Set(), origin: '', price: '', lot: '', cert: '', sort: 'new' };
const PRICE_BANDS = { a: [0, 1000], b: [1000, 3000], c: [3000, 1e9] };
const LOT_BANDS = { s: [0, 10], m: [11, 50], l: [51, 1e9] };
views.search = () => {
  const origins = [...new Set(PRODUCTS.map(p => p.origin))], certs = [...new Set(PRODUCTS.flatMap(p => p.certs))];
  return `<div class="page"><div class="page-head"><div><h1><span class="num">01</span>商品検索・カテゴリーフィルター</h1><p>豊富なカテゴリと詳細な条件で、目的の商品をすばやく検索。</p></div></div>
  <div class="search-layout">
    <aside class="card filters" id="filters"><h3>カテゴリー</h3>
      ${CATS.map(c => `<label class="chk"><input type="checkbox" data-cat="${c.id}"> ${c.id}<small>${PRODUCTS.filter(p => p.cat === c.id).length}</small></label>`).join('')}
      <button class="btn ghost sm block" id="fReset" style="margin-top:10px">条件をクリア</button></aside>
    <section>
      <div class="bar">
        <button class="btn ghost sm filter-toggle" id="fToggle">カテゴリーを絞り込む</button>
        <input class="in" id="fq" type="search" placeholder="商品名・キーワード・産地で検索" aria-label="キーワード" style="flex:2;min-width:200px">
        <select class="in" id="fo" aria-label="産地"><option value="">産地</option>${origins.map(o => `<option>${o}</option>`).join('')}</select>
        <select class="in" id="fp" aria-label="価格帯"><option value="">価格帯</option><option value="a">〜¥1,000</option><option value="b">¥1,000〜¥3,000</option><option value="c">¥3,000〜</option></select>
        <select class="in" id="fl" aria-label="最小ロット"><option value="">最小ロット</option><option value="s">〜10</option><option value="m">11〜50</option><option value="l">51〜</option></select>
        <select class="in" id="fc" aria-label="認証・規格"><option value="">認証・規格</option>${certs.map(o => `<option>${o}</option>`).join('')}</select>
      </div>
      <div class="bar"><span class="count" id="fCount" style="margin-left:0"></span>
        <select class="in" id="fs" aria-label="並び替え" style="flex:none;margin-left:auto"><option value="new">新着順</option><option value="price">価格が安い順</option><option value="moq">最小ロットが小さい順</option></select></div>
      <div class="prod-grid" id="results"></div>
    </section></div></div>`;
};
views.search.mount = root => {
  const q = route.q;
  F.q = q.get('q') || ''; F.origin = q.get('origin') || ''; F.cert = q.get('cert') || '';
  F.cats = new Set(q.get('cat') ? q.get('cat').split(',') : []);
  F.price = ''; F.lot = ''; F.sort = 'new';
  const set = (id, v) => { $(id, root).value = v; };
  set('#fq', F.q); set('#fo', F.origin); set('#fc', F.cert);
  $$('[data-cat]', root).forEach(c => { c.checked = F.cats.has(c.dataset.cat); c.onchange = () => { c.checked ? F.cats.add(c.dataset.cat) : F.cats.delete(c.dataset.cat); draw(); }; });
  const draw = () => {
    let r = PRODUCTS.filter(p => {
      const kw = F.q.toLowerCase();
      if (kw && !(p.name + p.origin + p.sup + p.cat + p.desc).toLowerCase().includes(kw)) return false;
      if (F.cats.size && !F.cats.has(p.cat)) return false;
      if (F.origin && p.origin !== F.origin) return false;
      if (F.cert && !p.certs.includes(F.cert)) return false;
      if (F.price) { const [a, b] = PRICE_BANDS[F.price], v = minPrice(p); if (!(v >= a && v < b)) return false; }
      if (F.lot) { const [a, b] = LOT_BANDS[F.lot], v = moq(p); if (!(v >= a && v <= b)) return false; }
      return true;
    });
    if (F.sort === 'price') r.sort((a, b) => minPrice(a) - minPrice(b));
    if (F.sort === 'moq') r.sort((a, b) => moq(a) - moq(b));
    $('#fCount', root).textContent = `検索結果 ${r.length.toLocaleString()} 件`;
    $('#results', root).innerHTML = r.length ? r.map(productCard).join('') : '<div class="empty card" style="grid-column:1/-1">条件に合う商品が見つかりませんでした。条件を変更してください。</div>';
    bindFavs($('#results', root));
  };
  $('#fq', root).oninput = e => { F.q = e.target.value.trim(); draw(); };
  $('#fo', root).onchange = e => { F.origin = e.target.value; draw(); };
  $('#fp', root).onchange = e => { F.price = e.target.value; draw(); };
  $('#fl', root).onchange = e => { F.lot = e.target.value; draw(); };
  $('#fc', root).onchange = e => { F.cert = e.target.value; draw(); };
  $('#fs', root).onchange = e => { F.sort = e.target.value; draw(); };
  $('#fReset', root).onclick = () => { F.q = ''; F.cats.clear(); F.origin = F.price = F.lot = F.cert = ''; F.sort = 'new'; ['#fq', '#fo', '#fp', '#fl', '#fc'].forEach(i => set(i, '')); $('#fs', root).value = 'new'; $$('[data-cat]', root).forEach(c => c.checked = false); draw(); };
  $('#fToggle', root).onclick = () => $('#filters', root).classList.toggle('open');
  draw();
};

/* 02 Product detail */
views.product = () => {
  const p = prod(route.args[0]);
  if (!p) return `<div class="page"><div class="empty card">商品が見つかりません。<br><a class="btn" style="margin-top:12px" href="#/search">商品一覧へ</a></div></div>`;
  const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  return `<div class="page"><div class="crumbs"><a href="#/">ダッシュボード</a> › <a href="#/search?cat=${encodeURIComponent(p.cat)}">${p.cat}</a> › ${esc(p.name)}</div>
  <div class="page-head"><div><h1><span class="num">02</span>商品詳細・卸価格・在庫・MOQ</h1><p>MOQ・卸価格・在庫状況をわかりやすく表示。安心して商談を進められます。</p></div></div>
  <div class="card"><div class="pd">
    <div class="pd-img" style="${p.img ? '' : 'background:' + catOf(p.cat).bg}">${p.img ? `<img src="${p.img}" alt="${esc(p.name)}">` : `<span aria-hidden="true">${p.emoji}</span>`}</div>
    <div>
      <div class="pmeta">${esc(p.sup)}</div>
      <h1>${esc(p.name)}</h1>
      <div class="tags"><span class="chip blue">${p.temp}</span>${p.certs.map(c => `<span class="chip green">${esc(c)}</span>`).join('')}</div>
      <p style="color:var(--muted);margin:6px 0">${esc(p.desc)}</p>
      <dl class="spec"><dt>産地</dt><dd>${esc(p.origin)}（日本）</dd><dt>最小ロット（MOQ）</dt><dd>${moq(p)}${p.unit}</dd><dt>在庫状況</dt><dd>${stockHtml(p)}${p.stock ? `（${p.stock.toLocaleString()}${p.unit}）` : ''}</dd><dt>荷姿</dt><dd>${esc(p.pack)}</dd><dt>賞味期限</dt><dd>${esc(p.shelf)}</dd><dt>納期目安</dt><dd>${esc(p.lead)}</dd></dl>
      <div class="tbl-wrap"><table class="t" id="tiers"><thead><tr><th>数量</th><th class="r">卸価格（税抜）</th></tr></thead><tbody>
        ${p.tiers.map((t, i) => `<tr data-i="${i}"><td>${tierLabel(p, i)}</td><td class="r">${yen(t[1])}/${p.unit}</td></tr>`).join('')}</tbody></table></div>
      <div class="calc"><div class="row"><label for="pq" style="font-weight:700">数量（${p.unit}）</label><input class="in" id="pq" type="number" min="1" value="${moq(p)}"><span class="total">概算合計（税抜）<br><b id="ptot"></b></span></div><small class="pmeta" id="pnote"></small></div>
      <div class="actions"><button class="btn" id="bQuote">見積依頼</button><button class="btn ghost" id="bSample">サンプル依頼</button><button class="btn ghost" id="bOrder">注文する</button>${heartBtn(p.id).replace('class="heart', 'style="width:44px;height:44px;flex:none;border:1px solid var(--line)" class="heart')}</div>
      <p style="margin:12px 0 0"><a href="#/messages?to=${esc(Object.keys(SUP).find(k => SUP[k] === p.sup) || '')}" style="color:var(--red);font-weight:700">サプライヤーに問い合わせる ›</a></p>
    </div></div></div>
  ${related.length ? `<section class="card" style="margin-top:18px"><h2>同じカテゴリーの商品</h2><div class="prod-grid">${related.map(productCard).join('')}</div></section>` : ''}</div>`;
};
views.product.mount = root => {
  const p = prod(route.args[0]); if (!p) return;
  const q = $('#pq', root);
  const upd = () => {
    const n = +q.value || 0, pr = priceFor(p, n);
    $('#ptot', root).textContent = yen(n * pr);
    const ok = n >= moq(p);
    $('#pnote', root).textContent = ok ? `適用単価 ${yen(pr)}/${p.unit}` : `最小ロットは ${moq(p)}${p.unit} です`;
    $('#pnote', root).style.color = ok ? '' : 'var(--red)';
    let hit = -1; p.tiers.forEach((t, i) => { if (n >= t[0]) hit = i; });
    $$('#tiers tbody tr', root).forEach((tr, i) => tr.classList.toggle('hit', i === hit));
  };
  q.oninput = upd; upd();
  const need = () => { if (+q.value >= moq(p)) return true; toast(`最小ロットは ${moq(p)}${p.unit} です`); q.focus(); return false; };
  $('#bQuote', root).onclick = () => quoteModal(p.id);
  $('#bSample', root).onclick = () => { location.hash = `#/sample/${p.id}`; };
  $('#bOrder', root).onclick = () => { if (need()) orderModal(p.id, +q.value); };
  bindFavs(root);
};

/* 03 Sample request flow */
let SF = null;
views.sample = () => {
  const p = prod(route.args[0]);
  if (!p) return views.product();
  if (!SF || SF.pid !== p.id) SF = { pid: p.id, step: 0, qty: 1, to: S.profile.addrs[0] || '', when: '最短で希望', msg: '', no: '' };
  const steps = ['入力', '確認', '完了'];
  const stepper = `<div class="stepper">${steps.map((s, i) => `<div class="s ${i < SF.step ? 'done' : i === SF.step ? 'on' : ''}"><i>${i < SF.step ? '✓' : i + 1}</i>${s}</div>`).join('')}</div>`;
  const prodBox = `<div class="sum-prod"><div class="th">${thumbBox(p)}</div><div><b>${esc(p.name)}</b><div class="pmeta">サンプル内容 ${esc(p.pack.split('×')[0])} ／ ${esc(p.sup)}</div></div></div>`;
  let body = '';
  if (SF.step === 0) body = `${prodBox}
    <label class="f" for="sq">サンプル希望数量</label><select class="in" id="sq">${[1, 2, 3, 5].map(n => `<option value="${n}" ${SF.qty === n ? 'selected' : ''}>${n}${p.unit === 'kg' ? 'kg' : '個（セット）'}</option>`).join('')}</select>
    <label class="f" for="st">送付先</label><select class="in" id="st">${S.profile.addrs.map(a => `<option ${a === SF.to ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
    <label class="f" for="sw">希望到着時期</label><select class="in" id="sw">${['最短で希望', '1週間以内', '2週間以内', '1か月以内'].map(a => `<option ${a === SF.when ? 'selected' : ''}>${a}</option>`).join('')}</select>
    <label class="f" for="sm">メッセージ（任意）</label><textarea class="in" id="sm" placeholder="品質確認のため、サンプルを希望します。">${esc(SF.msg)}</textarea>
    <div class="foot"><a class="btn ghost" href="#/product/${p.id}">戻る</a><button class="btn" id="sNext">確認画面へ</button></div>`;
  if (SF.step === 1) body = `${prodBox}<dl class="spec"><dt>希望数量</dt><dd>${SF.qty}${p.unit === 'kg' ? 'kg' : '個（セット）'}</dd><dt>送付先</dt><dd>${esc(SF.to)}</dd><dt>希望到着時期</dt><dd>${esc(SF.when)}</dd><dt>メッセージ</dt><dd>${esc(SF.msg) || '—'}</dd></dl>
    <p class="pmeta">※ サンプルの送料・輸出手続きの条件はサプライヤーより別途ご案内します。</p>
    <div class="foot"><button class="btn ghost" id="sBack">修正する</button><button class="btn" id="sSend">この内容で依頼する</button></div>`;
  if (SF.step === 2) body = `<div class="done-box"><div class="ok">${icon('check')}</div><h2 style="margin:0 0 6px">サンプル依頼を受け付けました</h2><p class="pmeta">依頼番号 <b>${SF.no}</b><br>サプライヤーからの連絡をお待ちください。</p>
    <div class="foot" style="justify-content:center"><a class="btn ghost" href="#/requests">依頼状況を見る</a><a class="btn" href="#/search">商品検索へ戻る</a></div></div>`;
  return `<div class="page"><div class="crumbs"><a href="#/">ダッシュボード</a> › <a href="#/product/${p.id}">${esc(p.name)}</a> › サンプル依頼</div>
    <div class="page-head"><div><h1><span class="num">03</span>サンプル依頼フロー</h1><p>簡単なステップでサンプルを依頼。商談の第一歩をスムーズに。</p></div></div>
    <div class="card form-card">${stepper}${body}</div></div>`;
};
views.sample.mount = root => {
  const p = prod(route.args[0]); if (!p || !SF) return;
  const rerender = () => render();
  $('#sNext', root)?.addEventListener('click', () => {
    SF.qty = +$('#sq', root).value; SF.to = $('#st', root).value; SF.when = $('#sw', root).value; SF.msg = $('#sm', root).value.trim();
    if (!SF.to) { toast('送付先を選択してください（アカウント設定で住所を追加できます）'); return; }
    SF.step = 1; rerender();
  });
  $('#sBack', root)?.addEventListener('click', () => { SF.step = 0; rerender(); });
  $('#sSend', root)?.addEventListener('click', () => {
    const s = { no: `SP-${ymdNow()}-${seq(S.samples)}`, date: new Date().toISOString(), pid: p.id, qty: SF.qty, to: SF.to, when: SF.when, msg: SF.msg, status: '受付済' };
    S.samples.unshift(s); SF.no = s.no; SF.step = 2; notify(`サンプル依頼 ${s.no} を受け付けました`, '#/requests'); rerender();
  });
};

/* Requests (quotes & samples) */
let reqTab = 'q';
views.requests = () => `<div class="page"><div class="page-head"><div><h1>見積・サンプル依頼</h1><p>依頼の状況を一覧で確認できます。</p></div></div>
  <div class="card"><div class="tabs" role="tablist"><button data-tab="q" class="${reqTab === 'q' ? 'on' : ''}">見積依頼（${S.quotes.length}）</button><button data-tab="s" class="${reqTab === 's' ? 'on' : ''}">サンプル依頼（${S.samples.length}）</button></div>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>依頼日</th><th>依頼番号</th><th>商品</th><th class="r">数量</th><th>${reqTab === 'q' ? '仕向国' : '送付先'}</th><th>ステータス</th></tr></thead><tbody>
  ${(reqTab === 'q' ? S.quotes : S.samples).map(r => { const p = prod(r.pid); return `<tr class="click" data-go="#/product/${r.pid}"><td>${fmtDate(r.date)}</td><td>${r.no}</td><td>${esc(p.name)}</td><td class="r">${r.qty}${p.unit}</td><td>${esc(reqTab === 'q' ? r.country : r.to)}</td><td><span class="chip ${/回答待ち|受付/.test(r.status) ? 'amber' : 'green'}">${r.status}</span></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">依頼はまだありません</td></tr>'}
  </tbody></table></div></div></div>`;
views.requests.mount = root => {
  $$('[data-tab]', root).forEach(b => b.onclick = () => { reqTab = b.dataset.tab; render(); });
  $$('[data-go]', root).forEach(tr => tr.onclick = () => { location.hash = tr.dataset.go; });
};

/* 04 Favorites & reorder */
let favTab = 'fav';
views.favorites = () => {
  const reorders = []; const seen = new Set();
  S.orders.forEach(o => { if (!seen.has(o.pid)) { seen.add(o.pid); reorders.push(o); } });
  const list = favTab === 'fav'
    ? (S.favs.length ? S.favs.map(prod).filter(Boolean).map(p => `<div class="fav-row"><div class="th">${thumbBox(p)}</div><div><a href="#/product/${p.id}"><b>${esc(p.name)}</b></a><div class="pmeta">MOQ ${moq(p)}${p.unit} ・ ${esc(p.sup)}</div><div class="pprice">${yen(minPrice(p))}<small> /${p.unit}〜</small></div>${stockHtml(p)}</div><div class="side-r">${heartBtn(p.id)}<button class="btn sm" data-reorder="${p.id}">再注文</button></div></div>`).join('') : '<div class="empty">お気に入りがまだありません。<br><a class="btn sm" style="margin-top:10px" href="#/search">商品を探す</a></div>')
    : (reorders.length ? reorders.map(o => { const p = prod(o.pid); return `<div class="fav-row"><div class="th">${thumbBox(p)}</div><div><a href="#/product/${p.id}"><b>${esc(p.name)}</b></a><div class="pmeta">前回 ${fmtDate(o.date)} ・ ${o.qty}${p.unit} ・ ${yen(o.amount)}</div><div class="pmeta">${o.no}</div></div><div class="side-r"><button class="btn sm" data-oneclick="${o.pid}:${o.qty}">ワンクリック再注文</button></div></div>`; }).join('') : '<div class="empty">注文履歴がありません</div>');
  return `<div class="page"><div class="page-head"><div><h1><span class="num">04</span>お気に入りリスト・再注文</h1><p>よく見る商品をお気に入りに保存。過去の注文からワンクリックで再注文。</p></div></div>
  <div class="card"><div class="tabs"><button data-tab="fav" class="${favTab === 'fav' ? 'on' : ''}">お気に入り (${S.favs.length})</button><button data-tab="re" class="${favTab === 're' ? 'on' : ''}">再注文</button></div>${list}</div></div>`;
};
views.favorites.mount = root => {
  $$('[data-tab]', root).forEach(b => b.onclick = () => { favTab = b.dataset.tab; render(); });
  $$('[data-reorder]', root).forEach(b => b.onclick = () => orderModal(b.dataset.reorder));
  $$('[data-oneclick]', root).forEach(b => b.onclick = () => {
    const [pid, qty] = b.dataset.oneclick.split(':'); const o = createOrder(pid, +qty);
    toast(`前回と同じ内容で再注文しました（${o.no}）`); location.hash = '#/orders';
  });
  bindFavs(root);
};

/* 05 Messages */
let activeThread = null, appliedHash = '';
const autoReply = t => {
  if (/書類|証明|輸出|手続/.test(t)) return '輸出に必要な書類（輸出証明書・原産地証明書・インボイス等）をご用意できます。仕向国をお知らせください。';
  if (/価格|値段|見積|単価/.test(t)) return 'ご数量に応じた卸価格をご案内します。希望数量と納期をお知らせいただければ、見積を作成します。';
  if (/サンプル/.test(t)) return 'サンプル対応可能です。商品ページの「サンプル依頼」からお申し込みください。';
  if (/在庫|納期|いつ/.test(t)) return '在庫状況と納期を確認して、本日中にご連絡いたします。';
  return 'お問い合わせありがとうございます。担当者が確認のうえ、改めてご連絡いたします。';
};
views.messages = () => {
  const to = route.q.get('to');
  if (to && appliedHash !== location.hash) {
    appliedHash = location.hash;
    let th = S.threads.find(t => t.id === to);
    if (!th && SUP[to]) { th = { id: to, sup: SUP[to], role: 'サプライヤー', unread: 0, msgs: [] }; S.threads.push(th); save(); }
    if (th) activeThread = th.id;
  }
  if (!activeThread && !to && matchMedia('(min-width:901px)').matches) activeThread = S.threads[0]?.id || null;
  const th = S.threads.find(t => t.id === activeThread);
  if (th && th.unread) { th.unread = 0; save(); }
  return `<div class="page"><div class="page-head"><div><h1><span class="num">05</span>問い合わせ・チャット</h1><p>サプライヤーに直接問い合わせ。商談や輸出に関する相談もスムーズに。</p></div></div>
  <div class="card chat ${th ? 'has-active' : ''}" id="chat">
    <div class="threads">${S.threads.map(t => { const last = t.msgs[t.msgs.length - 1]; return `<button class="thread ${t.id === activeThread ? 'on' : ''}" data-th="${t.id}"><span class="av">${esc(t.sup[0])}</span><span style="min-width:0"><b>${esc(t.sup)}</b><small>${last ? esc(last.file ? '📎 ' + last.file.name : last.t.split('\n')[0]) : '新しいチャット'}</small></span>${t.unread ? `<span class="badge red">${t.unread}</span>` : ''}</button>`; }).join('')}</div>
    <div class="conv">${th ? `<div class="conv-head"><button class="icon-btn back" id="cBack" aria-label="一覧へ戻る">${icon('chev').replace('<svg class="ic">', '<svg class="ic" style="transform:scaleX(-1)">')}</button><span class="avatar" style="background:#e9ecf1;color:var(--ink)">${esc(th.sup[0])}</span><div><b>${esc(th.sup)}</b><small>${th.role}</small></div></div>
      <div class="msgs" id="msgs">${th.msgs.length ? th.msgs.map(m => `<div class="m ${m.me ? 'me' : ''}">${m.t ? `<div class="bub">${esc(m.t)}</div>` : ''}${m.file ? `<div class="file"><span class="pdf">PDF</span><div><b>${esc(m.file.name)}</b><br><small>${esc(m.file.size)}</small></div></div>` : ''}<small>${fmtDT(m.d)}</small></div>`).join('') : '<div class="empty">サプライヤーへ最初のメッセージを送りましょう。</div>'}</div>
      <div class="typing" id="typing" hidden>入力中…</div>
      <form class="composer" id="composer"><input type="file" id="cFile" hidden><button type="button" class="attach" id="cAttach" aria-label="ファイルを添付">${icon('clip')}</button><input class="in" id="cText" placeholder="メッセージを入力…" aria-label="メッセージ" autocomplete="off"><button class="send" aria-label="送信">${icon('send')}</button></form>`
      : '<div class="empty" style="margin:auto">左の一覧からサプライヤーを選択してください。</div>'}</div></div></div>`;
};
views.messages.mount = root => {
  $$('[data-th]', root).forEach(b => b.onclick = () => { activeThread = b.dataset.th; const t = S.threads.find(x => x.id === activeThread); t.unread = 0; save(); refreshChrome(); render(); });
  const th = S.threads.find(t => t.id === activeThread); if (!th) return;
  refreshChrome();
  const box = $('#msgs', root); box.scrollTop = box.scrollHeight;
  $('#cBack', root).onclick = () => { activeThread = null; render(); };
  const push = (m, who) => { th.msgs.push({ ...m, d: new Date().toISOString() }); save(); if (route.name === 'messages' && activeThread === who) render(); };
  const send = (m) => {
    push({ me: true, ...m }, th.id);
    const reply = autoReply(m.t || '添付');
    setTimeout(() => { const el = $('#typing'); if (el && activeThread === th.id) el.hidden = false; }, 200);
    setTimeout(() => {
      th.msgs.push({ me: false, t: reply, d: new Date().toISOString() });
      if (!(route.name === 'messages' && activeThread === th.id)) { th.unread++; notify(`${th.sup}からメッセージが届きました`, '#/messages'); }
      save(); refreshChrome(); if (route.name === 'messages' && activeThread === th.id) render();
    }, 1400);
  };
  $('#composer', root).onsubmit = e => { e.preventDefault(); const v = $('#cText', root).value.trim(); if (v) send({ t: v }); };
  $('#cAttach', root).onclick = () => $('#cFile', root).click();
  $('#cFile', root).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(f.size / 1024)) + 'KB';
    send({ t: '', file: { name: f.name, size } });
  };
  $('#cText', root).focus({ preventScroll: true });
};

/* 06 Orders */
let ordTab = 'all', ordSel = null;
views.orders = () => {
  const list = S.orders.filter(o => ordTab === 'all' || (ordTab === 'prog' ? o.stage < 5 : o.stage === 5));
  const sel = S.orders.find(o => o.no === ordSel) || list[0];
  const prog = S.orders.filter(o => o.stage < 5).length;
  return `<div class="page"><div class="page-head"><div><h1><span class="num">06</span>注文・発注履歴・ステータス追跡</h1><p>注文状況をリアルタイムで確認。出荷から納品まで、安心のトラッキング。</p></div></div>
  <div class="card"><div class="tabs"><button data-tab="all" class="${ordTab === 'all' ? 'on' : ''}">すべて</button><button data-tab="prog" class="${ordTab === 'prog' ? 'on' : ''}">進行中 (${prog})</button><button data-tab="past" class="${ordTab === 'past' ? 'on' : ''}">過去の注文</button></div>
  <div class="tbl-wrap"><table class="t"><thead><tr><th>注文日</th><th>注文番号</th><th>商品</th><th class="r">数量</th><th class="r">金額（税抜）</th><th>ステータス</th></tr></thead><tbody>
  ${list.map(o => { const p = prod(o.pid); return `<tr class="click ${sel && sel.no === o.no ? 'hit' : ''}" data-o="${o.no}"><td>${fmtDate(o.date)}</td><td>${o.no}</td><td>${esc(p.name)}</td><td class="r">${o.qty}${p.unit}</td><td class="r">${yen(o.amount)}</td><td><span class="chip ${STAGE_CHIP[o.stage]}">${STAGE_LABEL[o.stage]}</span></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">該当する注文はありません</td></tr>'}
  </tbody></table></div></div>
  ${sel ? `<section class="card" style="margin-top:18px"><h2>配送ステータス — ${sel.no} <button class="btn sm ghost" data-reorder="${sel.pid}:${sel.qty}">同じ内容で再注文</button></h2>${tracker(sel)}<p class="pmeta" style="margin:8px 0 0">${esc(prod(sel.pid).name)} ／ ${esc(prod(sel.pid).sup)} ／ ${sel.qty}${prod(sel.pid).unit}</p></section>` : ''}</div>`;
};
views.orders.mount = root => {
  $$('[data-tab]', root).forEach(b => b.onclick = () => { ordTab = b.dataset.tab; ordSel = null; render(); });
  $$('[data-o]', root).forEach(tr => tr.onclick = () => { ordSel = tr.dataset.o; render(); });
  $$('[data-reorder]', root).forEach(b => b.onclick = () => { const [pid, q] = b.dataset.reorder.split(':'); orderModal(pid, +q); });
};

/* Account */
views.account = () => {
  const a = S.profile;
  return `<div class="page"><div class="page-head"><div><h1>アカウント設定</h1><p>会社情報・送付先・通知を管理します。</p></div></div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <form class="card" id="profileForm"><h2>会社・担当者情報</h2>
      <label class="f" for="a1">会社名</label><input class="in" id="a1" value="${esc(a.company)}" required>
      <div class="two"><div><label class="f" for="a2">担当者名</label><input class="in" id="a2" value="${esc(a.name)}" required></div><div><label class="f" for="a3">国・地域</label><select class="in" id="a3">${COUNTRIES.map(c => `<option ${c === a.country ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <label class="f" for="a4">メールアドレス</label><input class="in" id="a4" type="email" value="${esc(a.email)}" required>
      <label class="f" for="a5">電話番号</label><input class="in" id="a5" value="${esc(a.tel)}">
      <div class="foot" style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn">保存する</button></div></form>
    <div class="grid">
      <section class="card"><h2>送付先住所</h2><div id="addrs">${a.addrs.map((x, i) => `<div class="addr"><span>${esc(x)}</span><button class="btn sm ghost" data-del="${i}">削除</button></div>`).join('') || '<div class="empty">登録された住所はありません</div>'}</div>
        <div style="display:flex;gap:8px;margin-top:8px"><input class="in" id="newAddr" placeholder="会社名 / 住所" aria-label="新しい住所"><button class="btn" id="addAddr">追加</button></div></section>
      <section class="card"><h2>通知設定</h2>${[['order', '注文・配送ステータスの更新'], ['quote', '見積・サンプルの回答'], ['msg', 'メッセージの受信'], ['news', 'お知らせ・新着商品']].map(([k, l]) => `<label class="switch">${l}<input type="checkbox" data-n="${k}" ${a.notify[k] ? 'checked' : ''}></label>`).join('')}</section>
    </div></div></div>`;
};
views.account.mount = root => {
  $('#profileForm', root).onsubmit = e => {
    e.preventDefault();
    Object.assign(S.profile, { company: $('#a1', root).value.trim(), name: $('#a2', root).value.trim(), country: $('#a3', root).value, email: $('#a4', root).value.trim(), tel: $('#a5', root).value.trim() });
    save(); refreshChrome(); toast('アカウント情報を保存しました');
  };
  $$('[data-del]', root).forEach(b => b.onclick = () => { S.profile.addrs.splice(+b.dataset.del, 1); save(); render(); });
  $('#addAddr', root).onclick = () => { const v = $('#newAddr', root).value.trim(); if (!v) return; S.profile.addrs.push(v); save(); render(); toast('住所を追加しました'); };
  $$('[data-n]', root).forEach(c => c.onchange = () => { S.profile.notify[c.dataset.n] = c.checked; save(); });
};

/* ---------- chrome ---------- */
function refreshChrome() {
  const set = (id, n) => { const el = $(id); el.textContent = n > 0 ? n : ''; };
  set('#navFav', S.favs.length);
  set('#navReq', S.quotes.filter(q => q.status === '回答待ち').length + S.samples.filter(s => s.status === '受付済').length);
  set('#navOrd', S.orders.filter(o => o.stage < 5).length);
  set('#navMsg', S.threads.reduce((a, t) => a + t.unread, 0));
  $('#bellDot').hidden = !S.notifs.some(n => !n.read);
  $('#userName').textContent = S.profile.name + '様';
  $('#userAvatar').textContent = (S.profile.name || 'B')[0].toUpperCase();
}
const closeBell = () => { $('#bellPop').hidden = true; $('#bellBtn').setAttribute('aria-expanded', 'false'); };
$('#bellBtn').onclick = e => {
  e.stopPropagation();
  const pop = $('#bellPop');
  if (!pop.hidden) return closeBell();
  pop.innerHTML = `<h4>通知<button id="readAll">すべて既読にする</button></h4><ul>${S.notifs.length ? S.notifs.slice(0, 12).map((n, i) => `<li class="${n.read ? '' : 'unread'}" data-n="${i}" style="cursor:pointer"><div>${esc(n.msg)}<small>${fmtDate(n.date)} ${fmtDT(n.date)}</small></div></li>`).join('') : '<li>通知はありません</li>'}</ul>`;
  pop.hidden = false; $('#bellBtn').setAttribute('aria-expanded', 'true');
  $('#readAll', pop).onclick = () => { S.notifs.forEach(n => n.read = true); save(); refreshChrome(); closeBell(); };
  $$('[data-n]', pop).forEach(li => li.onclick = () => { const n = S.notifs[+li.dataset.n]; n.read = true; save(); refreshChrome(); closeBell(); if (n.to) location.hash = n.to; });
};
document.addEventListener('click', e => { if (!e.target.closest('.pop-wrap')) closeBell(); });

const side = $('#side'), scrim = $('#scrim');
function closeMenu() { side.classList.remove('open'); scrim.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
$('#menuBtn').onclick = () => { const o = side.classList.toggle('open'); scrim.hidden = !o; $('#menuBtn').setAttribute('aria-expanded', o); };
scrim.onclick = closeMenu;
$('#topSearch').onsubmit = e => { e.preventDefault(); const v = $('#topQ').value.trim(); location.hash = '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''); };
$('#resetDemo').onclick = () => {
  if (!confirm('お気に入り・注文・メッセージなどのデモデータを初期状態に戻します。よろしいですか？')) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  S = seed(); SF = null; activeThread = null; save(); refreshChrome(); toast('デモデータを初期化しました'); location.hash = '#/'; render();
};

/* ---------- router ---------- */
const TITLES = { home: 'ダッシュボード', categories: 'カテゴリー', search: '商品検索', product: '商品詳細', sample: 'サンプル依頼', requests: '見積・サンプル依頼', favorites: 'お気に入り・再注文', messages: 'メッセージ', orders: '発注履歴', account: 'アカウント設定' };
const NAV_OF = { home: 'home', categories: 'categories', search: 'search', product: 'search', sample: 'search', requests: 'requests', favorites: 'favorites', messages: 'messages', orders: 'orders', account: 'account' };
function parse() {
  const h = location.hash.replace(/^#\/?/, ''), [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  route.name = parts[0] && views[parts[0]] ? parts[0] : 'home';
  route.args = parts.slice(1); route.q = new URLSearchParams(qs || '');
}
function render(keepScroll) {
  clearInterval(heroTimer); heroTimer = null;
  const root = $('#view');
  root.innerHTML = views[route.name]();
  views[route.name].mount?.(root);
  if (['home', 'categories', 'product'].includes(route.name)) bindFavs(root);
  document.title = `${TITLES[route.name]} | H-LINK バイヤーポータル`;
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === NAV_OF[route.name]; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  if (!keepScroll) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { parse(); appliedHash = ''; if (route.name !== 'sample') SF = null; closeMenu(); closeBell(); render(); });
parse(); refreshChrome(); render();
