(function () {
  'use strict';
  var C = window.Core;
  var KEY = 'hlink-tracker-v2', OLD = 'hlink-tracker-v1', CFG = 'hlink-tracker-cfg', BK = 'hlink-tracker-lastbackup';
  var $ = function (id) { return document.getElementById(id); };
  var state = { list: [], sel: null, cfg: { relay: '', token: '' } };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存不可でも動く */ } }
  function load() {
    var t = lsGet(KEY) || lsGet(OLD);
    if (!t) return null;
    try { return JSON.parse(t).map(C.migrate); } catch (e) { return null; }
  }
  function save() { lsSet(KEY, JSON.stringify(state.list)); }
  function today(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

  function sample() {
    return [
      { mode: 'sea', containerNo: 'CSQU3054383', bookingNo: 'BK-0001', pol: 'JPYOK', pod: 'SGSIN', etd: today(-5), eta: today(5), stage: 'in_transit', vessel: 'EXAMPLE EXPRESS', voyage: '041E', lot: 'LOT-2610-A', producer: 'サンプル水産', buyer: 'Sample Trading Pte', note: '冷凍 -18℃' },
      { mode: 'air', containerNo: '13112345675', pol: 'NRT', pod: 'LAX', etd: today(-1), eta: today(1), stage: 'in_transit', lot: 'LOT-2610-A', producer: 'サンプル水産', buyer: 'LA Demo Inc', note: '生鮮・空輸' },
      { mode: 'domestic', containerNo: '100000000004', carrier: 'ヤマト運輸', eta: today(1), stage: 'in_transit', lot: 'LOT-2609-C', buyer: '国内サンプル商店', note: '' },
      { mode: 'sea', containerNo: 'MSKU0000000', pol: 'JPNGO', pod: 'HKHKG', etd: today(-12), eta: today(-2), stage: 'in_transit', lot: 'LOT-2609-C', buyer: 'HK Demo Ltd', note: 'ETA超過の例（番号は架空）' },
    ];
  }

  function portName(c) { return (C.PORTS[c] || {}).name || c || '—'; }
  function labelOf(s) { return C.stageLabels(s.mode)[C.stageIndex(s.stage)].label; }
  function matches(s, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return ['containerNo', 'bookingNo', 'blNo', 'lot', 'producer', 'buyer', 'vessel', 'carrier'].some(function (k) { return String(s[k] || '').toLowerCase().indexOf(q) >= 0; });
  }
  function visible() {
    var q = $('q').value.trim(), m = $('f-mode').value, st = $('f-stage').value;
    return state.list.filter(function (s) {
      var done = C.stageIndex(s.stage) >= 6;
      return matches(s, q) && (!m || s.mode === m) && (!st || (st === 'open' ? !done : done));
    });
  }

  function renderNotice() {
    var last = Number(lsGet(BK) || 0), html = '';
    if (state.list.length && Date.now() - last > 7 * 86400000) html += '<div class="alert warn">バックアップが1週間以上ありません。「バックアップ」で保存してください（データはこのブラウザ内にあります）。</div>';
    if (!state.cfg.relay) html += '<div class="alert warn">追跡サービス未接続：状態は手入力です。接続は「設定」→ 中継サーバーのURL（README参照）。</div>';
    $('notice').innerHTML = html;
  }

  function renderSummary() {
    var active = 0, warn = 0, danger = 0;
    state.list.forEach(function (s) {
      if (C.stageIndex(s.stage) < 6) active++;
      var v = C.severity(s); if (v === 2) danger++; else if (v === 1) warn++;
    });
    $('summary').innerHTML = '<div class="stat"><b>' + state.list.length + '</b><span>登録</span></div>' +
      '<div class="stat"><b>' + active + '</b><span>輸送中</span></div>' +
      '<div class="stat warn"><b>' + warn + '</b><span>要注意</span></div>' +
      '<div class="stat danger"><b>' + danger + '</b><span>遅延・問題</span></div>';
  }

  function renderTodo() {
    var rows = state.list.filter(function (s) { return C.severity(s) > 0; }).sort(function (a, b) { return C.severity(b) - C.severity(a); });
    if (!rows.length) { $('todo').innerHTML = '<div class="todo"><h3>今日の要対応</h3><div class="sub">対応が必要な荷物はありません ✓</div></div>'; return; }
    $('todo').innerHTML = '<div class="todo"><h3>今日の要対応（' + rows.length + '件）</h3>' + rows.map(function (s) {
      var a = C.alertsFor(s)[0];
      return '<div class="t" data-i="' + state.list.indexOf(s) + '"><span class="mode">' + C.MODES[s.mode].short + '</span><b>' + esc(s.containerNo) + '</b><span class="badge ' + a.level + '">' + esc(a.text) + '</span><span class="sub">' + esc(s.buyer || s.lot || '') + '</span></div>';
    }).join('') + '</div>';
  }

  function renderList() {
    var items = visible();
    $('list').innerHTML = items.length ? items.map(function (s) {
      var v = C.severity(s), b = v === 2 ? '<span class="badge danger">要対応</span> ' : v === 1 ? '<span class="badge warn">注意</span> ' : '';
      var route = s.pol || s.pod ? esc(portName(s.pol)) + ' → ' + esc(portName(s.pod)) : esc(s.carrier || C.MODES[s.mode].name);
      return '<li class="item' + (s === state.sel ? ' sel' : '') + '" data-i="' + state.list.indexOf(s) + '">' +
        '<div><span class="mode">' + C.MODES[s.mode].short + '</span><span class="no">' + esc(s.containerNo) + '</span></div>' +
        '<div class="sub">' + route + '　ETA ' + esc(s.eta || '—') + '</div>' +
        '<div>' + b + '<span class="badge">' + esc(labelOf(s)) + '</span></div></li>';
    }).join('') : '<li class="empty">該当する荷物がありません</li>';
  }

  function mapSvg(s) {
    var W = 800, H = 380;
    var x = function (lon) { return (lon + 180) / 360 * W; }, y = function (lat) { return (90 - lat) / 180 * H; };
    var a = C.PORTS[s.pol], b = C.PORTS[s.pod], pos = C.estimatePosition(s);
    if (!a || !b) return '';
    var grid = '', i;
    for (i = -180; i <= 180; i += 30) grid += '<line x1="' + x(i) + '" y1="0" x2="' + x(i) + '" y2="' + H + '" stroke="currentColor" opacity=".08"/>';
    for (i = -60; i <= 60; i += 30) grid += '<line x1="0" y1="' + y(i) + '" x2="' + W + '" y2="' + y(i) + '" stroke="currentColor" opacity=".08"/>';
    return '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="経路">' + grid +
      '<line x1="' + x(a.lon) + '" y1="' + y(a.lat) + '" x2="' + x(b.lon) + '" y2="' + y(b.lat) + '" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 5"/>' +
      [a, b].map(function (p) { return '<circle cx="' + x(p.lon) + '" cy="' + y(p.lat) + '" r="5" fill="var(--ok)"/><text x="' + (x(p.lon) + 8) + '" y="' + (y(p.lat) - 8) + '" fill="currentColor" font-size="13">' + esc(p.name) + '</text>'; }).join('') +
      (pos ? '<circle cx="' + x(pos.lon) + '" cy="' + y(pos.lat) + '" r="8" fill="var(--warn)" stroke="#fff" stroke-width="2"/>' : '') + '</svg>' +
      '<div class="sub">' + (pos && pos.actual ? '位置は追跡サービスの実績値です。' : '※ 位置は出発日〜ETAからの推定（目安）です。') + '</div>';
  }

  function renderDetail() {
    var s = state.sel;
    if (!s) { $('detail').innerHTML = '<div class="empty">一覧から荷物を選択してください</div>'; return; }
    var idx = C.stageIndex(s.stage), labels = C.stageLabels(s.mode);
    var steps = labels.map(function (st, i) { return '<div class="step ' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + esc(st.label) + '</div>'; }).join('');
    var al = C.alertsFor(s).map(function (a) { return '<div class="alert ' + a.level + '">' + esc(a.text) + '</div>'; }).join('');
    var left = C.daysToEta(s);
    var f = function (k, v) { return '<div><dt>' + k + '</dt><dd>' + (esc(v) || '—') + '</dd></div>'; };
    var same = s.lot ? state.list.filter(function (o) { return o !== s && o.lot === s.lot; }) : [];
    var sameHtml = same.length ? '<div class="chips sub">同じロットの荷物：' + same.map(function (o) { return '<a data-i="' + state.list.indexOf(o) + '">' + esc(o.containerNo) + '（' + C.MODES[o.mode].short + '）</a>'; }).join('') + '</div>' : '';
    var ev = (s.events || []).length ? '<ul class="events">' + s.events.slice(0, 15).map(function (e) { return '<li><time>' + esc(String(e.at).replace('T', ' ').slice(0, 16)) + (e.place ? '　' + esc(e.place) : '') + '</time>' + esc(e.text) + '</li>'; }).join('') + '</ul>' : '';
    var carrier = s.carrier || (s.mode === 'sea' || s.mode === 'air' ? C.carrierOf(s.containerNo, s.mode) : '');
    $('detail').innerHTML = '<h2>' + esc(s.containerNo) + '</h2>' +
      '<div class="sub"><span class="mode">' + C.MODES[s.mode].short + '</span>' + esc(carrier) + '　' + esc(labelOf(s)) + (left != null && idx < 4 ? '　到着まで ' + left + ' 日' : '') + (s.checkedAt ? '　最終取得 ' + esc(s.checkedAt.slice(0, 16).replace('T', ' ')) : '') + '</div>' +
      al + '<div class="steps">' + steps + '</div>' + (s.mode === 'sea' || s.mode === 'air' ? mapSvg(s) : '') +
      '<dl class="grid">' + f('出発地', portName(s.pol)) + f('到着地', portName(s.pod)) + f('ETD', s.etd) + f('ETA', s.eta) +
      f('本船 / 便', [s.vessel, s.voyage].filter(Boolean).join(' / ')) + f('ブッキング', s.bookingNo) + f('B/L', s.blNo) +
      f('フリータイム終了', s.freeTimeEnd) + f('ロット', s.lot) + f('生産者', s.producer) + f('取引先', s.buyer) + f('備考', s.note) + '</dl>' + sameHtml + ev +
      '<div class="row" style="justify-content:flex-start"><button id="b-edit">編集</button><button id="b-next" class="ghost">次の工程へ</button><button id="b-del" class="danger">削除</button></div>';
    $('b-edit').onclick = function () { openForm(s); };
    $('b-next').onclick = function () { s.stage = C.STAGE_KEYS[Math.min(idx + 1, 6)]; s.lastEventAt = new Date().toISOString(); commit(); };
    $('b-del').onclick = function () { if (!confirm(s.containerNo + ' を削除しますか？')) return; state.list.splice(state.list.indexOf(s), 1); state.sel = null; commit(); };
  }

  function commit() { save(); render(); }
  function render() { renderNotice(); renderSummary(); renderTodo(); renderList(); renderDetail(); }

  function openForm(s, preset) {
    var isNew = !s; s = s || Object.assign({ stage: 'booked', mode: 'sea' }, preset);
    var inp = function (k, label, type, full) { return '<label class="' + (full ? 'full' : '') + '">' + label + '<input name="' + k + '" type="' + (type || 'text') + '" value="' + esc(s[k]) + '"></label>'; };
    var sel = function (k, label) {
      return '<label>' + label + '<select name="' + k + '"><option value="">—</option>' + Object.keys(C.PORTS).map(function (c) { return '<option value="' + c + '"' + (s[k] === c ? ' selected' : '') + '>' + C.PORTS[c].name + ' (' + c + ')</option>'; }).join('') + '</select></label>';
    };
    $('form').innerHTML = '<h3>' + (isNew ? '荷物を登録' : '編集') + '</h3><div class="fgrid">' +
      '<label>輸送手段<select name="mode">' + Object.keys(C.MODES).map(function (m) { return '<option value="' + m + '"' + (s.mode === m ? ' selected' : '') + '>' + C.MODES[m].name + '</option>'; }).join('') + '</select></label>' +
      inp('containerNo', '追跡番号（コンテナ／AWB／伝票）') + inp('carrier', '運送会社（任意）') + inp('bookingNo', 'ブッキング番号') + inp('blNo', 'B/L・HAWB') +
      inp('vessel', '本船・便名') + inp('voyage', '航海・便番号') + sel('pol', '出発港・空港') + sel('pod', '到着港・空港') +
      inp('etd', 'ETD', 'date') + inp('eta', 'ETA（配達予定）', 'date') + inp('freeTimeEnd', 'フリータイム終了日', 'date') +
      '<label>状態<select name="stage">' + C.STAGE_KEYS.map(function (k, i) { return '<option value="' + k + '"' + (C.stageIndex(s.stage) === i ? ' selected' : '') + '>' + (i + 1) + '. ' + C.stageLabels(s.mode)[i].label + '</option>'; }).join('') + '</select></label>' +
      inp('lot', 'ロット番号') + inp('producer', '生産者') + inp('buyer', '取引先') + inp('note', '備考', 'text', true) +
      '</div><div class="row"><button type="button" class="ghost" id="f-cancel">キャンセル</button><button type="submit">保存</button></div>';
    $('f-cancel').onclick = function () { $('dlg').close(); };
    $('form').onsubmit = function (e) {
      e.preventDefault();
      var o = {}; new FormData($('form')).forEach(function (v, k) { o[k] = String(v).trim(); });
      o.containerNo = C.normalizeNo(o.containerNo);
      if (!o.containerNo) { alert('追跡番号を入力してください'); return; }
      if (!C.validFor(o.mode, o.containerNo) && !confirm('この輸送手段の番号形式（検査数字）と一致しません。このまま保存しますか？')) return;
      if (isNew) { o.lastEventAt = new Date().toISOString(); state.list.unshift(o); state.sel = o; } else Object.assign(s, o);
      $('dlg').close(); commit();
    };
    $('dlg').showModal();
  }

  function openSettings() {
    $('form').innerHTML = '<h3>設定</h3><div class="fgrid">' +
      '<label class="full">中継サーバーURL（空欄＝手入力のみ）<input name="relay" placeholder="http://localhost:8080" value="' + esc(state.cfg.relay) + '"></label>' +
      '<label class="full">アクセストークン（サーバーに TRACKER_TOKEN を設定した場合）<input name="token" type="password" value="' + esc(state.cfg.token) + '"></label></div>' +
      '<p class="sub">追跡サービスのAPIキーはサーバー側にだけ置きます。ここには入れません。</p>' +
      '<div class="row"><button type="button" class="ghost" id="f-cancel">キャンセル</button><button type="submit">保存</button></div>';
    $('f-cancel').onclick = function () { $('dlg').close(); };
    $('form').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData($('form'));
      state.cfg = { relay: String(fd.get('relay') || '').trim().replace(/\/+$/, ''), token: String(fd.get('token') || '').trim() };
      lsSet(CFG, JSON.stringify(state.cfg)); $('dlg').close(); render();
    };
    $('dlg').showModal();
  }

  // ---- 追跡サービスからの更新（中継サーバー経由） ----
  var busy = false;
  function refreshAll(manual) {
    if (!state.cfg.relay) { if (manual) alert('「設定」で中継サーバーのURLを指定してください。'); return Promise.resolve(); }
    if (busy) return Promise.resolve();
    busy = true; $('btn-refresh').textContent = '… 更新中';
    var targets = state.list.filter(function (s) { return C.stageIndex(s.stage) < 6; });
    var changed = 0, failed = 0, unsupported = 0;
    return targets.reduce(function (p, s) {
      return p.then(function () {
        var h = state.cfg.token ? { Authorization: 'Bearer ' + state.cfg.token } : {};
        return fetch(state.cfg.relay + '/api/track?mode=' + encodeURIComponent(s.mode) + '&no=' + encodeURIComponent(s.containerNo), { headers: h })
          .then(function (r) { if (r.status === 501) { unsupported++; return null; } if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (up) {
            if (!up || up.pending) return;
            var r = C.applyUpdate(s, up);
            if (r.changed) { Object.assign(s, r.shipment); changed++; } else s.checkedAt = r.shipment.checkedAt;
          })
          .catch(function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      busy = false; $('btn-refresh').textContent = '↻ 更新'; commit();
      if (manual) alert('更新：' + changed + ' 件に変化 / 失敗 ' + failed + ' 件' + (unsupported ? ' / 追跡未設定の手段 ' + unsupported + ' 件（手入力のまま）' : ''));
    });
  }

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  $('quick').onsubmit = function (e) {
    e.preventDefault();
    var n = C.normalizeNo($('quick-no').value); if (!n) return;
    var dup = state.list.filter(function (s) { return s.containerNo === n; })[0];
    if (dup) { state.sel = dup; $('quick-no').value = ''; render(); return; }
    var d = C.detect(n)[0];
    $('quick-no').value = '';
    openForm(null, { containerNo: n, mode: d ? d.mode : 'sea', carrier: d && d.mode !== 'sea' && d.mode !== 'air' ? d.carrier : '' });
  };
  $('list').onclick = function (e) { var li = e.target.closest('.item'); if (li) { state.sel = state.list[Number(li.getAttribute('data-i'))]; render(); } };
  $('todo').onclick = function (e) { var t = e.target.closest('.t'); if (t) { state.sel = state.list[Number(t.getAttribute('data-i'))]; render(); } };
  $('detail').onclick = function (e) { var a = e.target.closest('.chips a'); if (a) { state.sel = state.list[Number(a.getAttribute('data-i'))]; render(); } };
  ['q', 'f-mode', 'f-stage'].forEach(function (id) { $(id).oninput = renderList; });
  $('f-mode').innerHTML += Object.keys(C.MODES).map(function (m) { return '<option value="' + m + '">' + C.MODES[m].name + '</option>'; }).join('');
  $('btn-settings').onclick = openSettings;
  $('btn-refresh').onclick = function () { refreshAll(true); };
  $('btn-export').onclick = function () { download('shipments-' + today(0) + '.csv', '﻿' + C.toCsv(state.list), 'text/csv'); };
  $('btn-backup').onclick = function () { download('tracker-backup-' + today(0) + '.json', JSON.stringify({ version: 2, list: state.list }, null, 1), 'application/json'); lsSet(BK, String(Date.now())); renderNotice(); };
  $('btn-import').onclick = function () { $('file').click(); };
  $('file').onchange = function () {
    var f = $('file').files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result), rows;
      try { rows = f.name.slice(-5) === '.json' ? JSON.parse(text).list.map(C.migrate) : C.parseCsv(text); } catch (err) { alert('読み込めませんでした'); return; }
      var added = 0;
      rows.forEach(function (o) {
        var cur = state.list.filter(function (s) { return s.containerNo === o.containerNo; })[0];
        if (cur) Object.assign(cur, o); else { state.list.push(o); added++; }
      });
      alert(rows.length + ' 件を取り込みました（新規 ' + added + ' 件）'); $('file').value = ''; commit();
    };
    r.readAsText(f);
  };
  $('file').accept = '.csv,.json,text/csv,application/json';

  try { state.cfg = Object.assign(state.cfg, JSON.parse(lsGet(CFG) || '{}')); } catch (e) { /* 既定値 */ }
  state.list = load() || sample();
  state.sel = state.list[0] || null;
  render();
  setInterval(function () { refreshAll(false); }, 30 * 60 * 1000); // 接続時のみ30分ごとに自動更新
})();
