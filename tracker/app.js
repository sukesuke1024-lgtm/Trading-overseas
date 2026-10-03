(function () {
  'use strict';
  var C = window.Core;
  var KEY = 'hlink-tracker-v1';
  var $ = function (id) { return document.getElementById(id); };
  var state = { list: [], sel: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    try { var t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* 保存不可でも動く */ }
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state.list)); } catch (e) { /* noop */ } }

  function sample() {
    var d = function (n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); };
    return [
      { containerNo: 'CSQU3054383', bookingNo: 'BK-0001', blNo: 'MAEU1234', vessel: 'EXAMPLE EXPRESS', voyage: '041E', pol: 'JPYOK', pod: 'SGSIN', etd: d(-5), eta: d(5), stage: 'sailing', lot: 'LOT-2610-A', producer: 'サンプル水産', buyer: 'Sample Trading Pte', note: '冷凍 -18℃' },
      { containerNo: 'MSKU0000000', bookingNo: 'BK-0002', blNo: '', vessel: 'DEMO STAR', voyage: '102W', pol: 'JPNGO', pod: 'HKHKG', etd: d(-12), eta: d(-2), stage: 'sailing', lot: 'LOT-2609-C', producer: 'サンプル農園', buyer: 'HK Demo Ltd', note: '' },
      { containerNo: 'ONEU1111111', bookingNo: 'BK-0003', blNo: '', vessel: '', voyage: '', pol: 'JPUKB', pod: 'USLAX', etd: d(4), eta: d(20), stage: 'booked', lot: '', producer: '', buyer: '', note: '' },
    ];
  }

  function matches(s, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return ['containerNo', 'bookingNo', 'blNo', 'lot', 'producer', 'buyer', 'vessel'].some(function (k) {
      return String(s[k] || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  function visible() {
    var q = $('q').value.trim(), st = $('f-stage').value;
    return state.list.filter(function (s) { return matches(s, q) && (!st || s.stage === st); });
  }
  function portName(c) { return (C.PORTS[c] || {}).name || c || '—'; }
  function stageLabel(k) { return C.STAGES[C.stageIndex(k)].label; }

  function renderSummary() {
    var late = 0, soon = 0, active = 0;
    state.list.forEach(function (s) {
      var a = C.alertsFor(s);
      if (C.stageIndex(s.stage) < 6) active++;
      if (a.some(function (x) { return x.level === 'danger'; })) late++;
      else if (a.some(function (x) { return x.level === 'warn'; })) soon++;
    });
    $('summary').innerHTML =
      '<div class="stat"><b>' + state.list.length + '</b><span>登録コンテナ</span></div>' +
      '<div class="stat"><b>' + active + '</b><span>輸送中</span></div>' +
      '<div class="stat warn"><b>' + soon + '</b><span>要注意</span></div>' +
      '<div class="stat danger"><b>' + late + '</b><span>遅延・超過</span></div>';
  }

  function renderList() {
    var items = visible();
    $('list').innerHTML = items.length ? items.map(function (s) {
      var a = C.alertsFor(s), b = '';
      if (a.some(function (x) { return x.level === 'danger'; })) b = '<span class="badge danger">遅延</span> ';
      else if (a.length) b = '<span class="badge warn">注意</span> ';
      return '<li class="item' + (s === state.sel ? ' sel' : '') + '" data-i="' + state.list.indexOf(s) + '">' +
        '<div class="no">' + esc(s.containerNo) + '</div>' +
        '<div class="sub">' + esc(portName(s.pol)) + ' → ' + esc(portName(s.pod)) + '　ETA ' + esc(s.eta || '—') + '</div>' +
        '<div>' + b + '<span class="badge">' + esc(stageLabel(s.stage)) + '</span></div></li>';
    }).join('') : '<li class="empty">該当するコンテナがありません</li>';
  }

  // 簡易世界地図（等距円筒）。港と現在位置の目安を描く
  function mapSvg(s) {
    var W = 800, H = 380;
    var x = function (lon) { return (lon + 180) / 360 * W; };
    var y = function (lat) { return (90 - lat) / 180 * H; };
    var a = C.PORTS[s.pol], b = C.PORTS[s.pod], pos = C.estimatePosition(s);
    if (!a || !b) return '<div class="empty">積港・揚港が未登録のため地図を表示できません</div>';
    var grid = '';
    for (var lon = -180; lon <= 180; lon += 30) grid += '<line x1="' + x(lon) + '" y1="0" x2="' + x(lon) + '" y2="' + H + '" stroke="currentColor" opacity=".08"/>';
    for (var lat = -60; lat <= 60; lat += 30) grid += '<line x1="0" y1="' + y(lat) + '" x2="' + W + '" y2="' + y(lat) + '" stroke="currentColor" opacity=".08"/>';
    var flip = Math.abs(a.lon - b.lon) > 180; // 太平洋横断は日付変更線をまたぐため直線で描画（目安）
    return '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="航路の目安">' + grid +
      '<line x1="' + x(a.lon) + '" y1="' + y(a.lat) + '" x2="' + x(b.lon) + '" y2="' + y(b.lat) + '" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 5"' + (flip ? ' opacity=".5"' : '') + '/>' +
      [a, b].map(function (p) {
        return '<circle cx="' + x(p.lon) + '" cy="' + y(p.lat) + '" r="5" fill="var(--ok)"/><text x="' + (x(p.lon) + 8) + '" y="' + (y(p.lat) - 8) + '" fill="currentColor" font-size="13">' + esc(p.name) + '</text>';
      }).join('') +
      (pos ? '<circle cx="' + x(pos.lon) + '" cy="' + y(pos.lat) + '" r="8" fill="var(--warn)" stroke="#fff" stroke-width="2"/>' : '') +
      '</svg><div class="sub" style="color:var(--mute);font-size:12px">※ 位置は出港日〜ETAからの推定（目安）です。実績位置は追跡API連携後に反映されます。</div>';
  }

  function renderDetail() {
    var s = state.sel;
    if (!s) { $('detail').innerHTML = '<div class="empty">左の一覧からコンテナを選択してください</div>'; return; }
    var idx = C.stageIndex(s.stage);
    var steps = C.STAGES.map(function (st, i) {
      return '<div class="step ' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + st.label + '</div>';
    }).join('');
    var al = C.alertsFor(s).map(function (a) { return '<div class="alert ' + a.level + '">' + esc(a.text) + '</div>'; }).join('');
    var left = C.daysToEta(s);
    var f = function (k, v) { return '<div><dt>' + k + '</dt><dd>' + (esc(v) || '—') + '</dd></div>'; };
    $('detail').innerHTML = '<h2>' + esc(s.containerNo) + '</h2>' +
      '<div class="sub" style="color:var(--mute)">' + esc(C.carrierOf(s.containerNo)) + '　' + esc(stageLabel(s.stage)) +
      (left != null && idx < 4 ? '　到着まで ' + left + ' 日' : '') + '</div>' + al + '<div class="steps">' + steps + '</div>' + mapSvg(s) +
      '<dl class="grid">' + f('積港', portName(s.pol)) + f('揚港', portName(s.pod)) + f('ETD', s.etd) + f('ETA', s.eta) +
      f('本船 / 航海', [s.vessel, s.voyage].filter(Boolean).join(' / ')) + f('ブッキング', s.bookingNo) + f('B/L', s.blNo) +
      f('フリータイム終了', s.freeTimeEnd) + f('ロット（トレーサビリティ）', s.lot) + f('生産者', s.producer) + f('取引先', s.buyer) + f('備考', s.note) + '</dl>' +
      '<div class="row" style="justify-content:flex-start"><button id="b-edit">編集</button><button id="b-next" class="ghost">次の工程へ</button><button id="b-del" class="danger">削除</button></div>';
    $('b-edit').onclick = function () { openForm(s); };
    $('b-next').onclick = function () { s.stage = C.STAGES[Math.min(idx + 1, C.STAGES.length - 1)].key; commit(); };
    $('b-del').onclick = function () {
      if (!confirm(s.containerNo + ' を削除しますか？')) return;
      state.list.splice(state.list.indexOf(s), 1); state.sel = null; commit();
    };
  }

  function commit() { save(); render(); }
  function render() { renderSummary(); renderList(); renderDetail(); }

  function openForm(s) {
    var isNew = !s; s = s || { stage: 'booked' };
    var inp = function (k, label, type, full) {
      return '<label class="' + (full ? 'full' : '') + '">' + label + '<input name="' + k + '" type="' + (type || 'text') + '" value="' + esc(s[k]) + '"></label>';
    };
    var ports = '<option value="">—</option>';
    var sel = function (k, label) {
      return '<label>' + label + '<select name="' + k + '">' + ports + Object.keys(C.PORTS).map(function (c) {
        return '<option value="' + c + '"' + (s[k] === c ? ' selected' : '') + '>' + C.PORTS[c].name + ' (' + c + ')</option>';
      }).join('') + '</select></label>';
    };
    $('form').innerHTML = '<h3>' + (isNew ? 'コンテナ登録' : '編集') + '</h3><div class="fgrid">' +
      inp('containerNo', 'コンテナ番号（例 CSQU3054383）', 'text', true) + inp('bookingNo', 'ブッキング番号') + inp('blNo', 'B/L番号') +
      inp('vessel', '本船名') + inp('voyage', '航海番号') + sel('pol', '積港') + sel('pod', '揚港') +
      inp('etd', 'ETD', 'date') + inp('eta', 'ETA', 'date') + inp('freeTimeEnd', 'フリータイム終了日', 'date') +
      '<label>状態<select name="stage">' + C.STAGES.map(function (st) { return '<option value="' + st.key + '"' + (s.stage === st.key ? ' selected' : '') + '>' + st.label + '</option>'; }).join('') + '</select></label>' +
      inp('lot', 'ロット番号') + inp('producer', '生産者') + inp('buyer', '取引先') + inp('note', '備考', 'text', true) +
      '</div><div class="row"><button type="button" class="ghost" id="f-cancel">キャンセル</button><button type="submit">保存</button></div>';
    $('f-cancel').onclick = function () { $('dlg').close(); };
    $('form').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData($('form')), o = {};
      fd.forEach(function (v, k) { o[k] = String(v).trim(); });
      o.containerNo = C.normalizeContainerNo(o.containerNo);
      if (!o.containerNo) { alert('コンテナ番号を入力してください'); return; }
      if (!C.isValidContainerNo(o.containerNo) && !confirm('チェックデジットが一致しません。このまま保存しますか？')) return;
      if (isNew) { state.list.unshift(o); state.sel = o; } else Object.assign(s, o);
      $('dlg').close(); commit();
    };
    $('dlg').showModal();
  }

  $('btn-add').onclick = function () { openForm(null); };
  $('list').onclick = function (e) {
    var li = e.target.closest('.item'); if (!li) return;
    state.sel = state.list[Number(li.getAttribute('data-i'))]; render();
  };
  $('q').oninput = renderList;
  $('f-stage').innerHTML += C.STAGES.map(function (s) { return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('');
  $('f-stage').onchange = renderList;
  $('btn-export').onclick = function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + C.toCsv(state.list)], { type: 'text/csv' }));
    a.download = 'containers-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
  $('btn-import').onclick = function () { $('file').click(); };
  $('file').onchange = function () {
    var f = $('file').files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var rows = C.parseCsv(String(r.result)), added = 0;
      rows.forEach(function (o) {
        var cur = state.list.filter(function (s) { return s.containerNo === o.containerNo; })[0];
        if (cur) Object.assign(cur, o); else { state.list.push(o); added++; }
      });
      alert(rows.length + ' 件を取り込みました（新規 ' + added + ' 件）'); $('file').value = ''; commit();
    };
    r.readAsText(f);
  };

  state.list = load() || sample();
  state.sel = state.list[0] || null;
  render();
})();
