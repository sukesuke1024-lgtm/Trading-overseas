import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../src/lib/core.js';
const T = (d) => Date.parse(d);

test('ISO 6346 check digit', () => {
  assert.equal(C.isValidContainerNo('CSQU3054383'), true);
  assert.equal(C.isValidContainerNo('CSQU3054384'), false);
  assert.equal(C.isValidContainerNo('csqu 305438-3'), true);
  assert.equal(C.isValidContainerNo('ABC1234567'), false);
});

test('AWB / Yamato / S10 check digits', () => {
  assert.equal(C.isValidAwb('131-1234567-5'), true);
  assert.equal(C.isValidAwb('13112345676'), false);
  assert.equal(C.isValidYamato('100000000004'), true);
  assert.equal(C.isValidYamato('100000000005'), false);
  assert.equal(C.isValidS10('EE123456785JP'), true);
  assert.equal(C.isValidS10('EE123456786JP'), false);
});

test('detect mode from number', () => {
  assert.equal(C.detect('CSQU3054383')[0].mode, 'sea');
  const air = C.detect('131-1234567-5');
  assert.equal(air[0].mode, 'air');
  assert.equal(air[0].carrier, '日本航空');
  assert.equal(C.detect('100000000004')[0].carrier, 'ヤマト運輸');
  assert.equal(C.detect('100000000005')[0].carrier, '佐川急便'); // 検査数字が合わなければ佐川を先頭に
  assert.equal(C.detect('1Z999AA10123456784')[0].mode, 'intl');
  assert.deepEqual(C.detect('???'), []);
});

test('stage labels differ by mode, legacy keys migrate', () => {
  assert.equal(C.stageLabels('air')[3].label, '飛行中');
  assert.equal(C.stageLabels('hokkaido')[5].label, '配達中');
  assert.equal(C.stageLabels('mainland')[2].label, '発送（道外へ）');
  assert.equal(C.migrate({ containerNo: 'X', stage: 'sailing' }).stage, 'in_transit');
  assert.equal(C.migrate({ containerNo: 'X', stage: 'sailing' }).mode, 'sea');
});

const ship = { mode: 'sea', containerNo: 'CSQU3054383', pol: 'JPYOK', pod: 'SGSIN', etd: '2026-10-01', eta: '2026-10-11', stage: 'in_transit' };

test('progress and position', () => {
  assert.equal(C.voyageProgress(ship, T('2026-10-06')), 0.5);
  const p = C.estimatePosition(ship, T('2026-10-06'));
  assert.ok(Math.abs(p.lat - (35.45 + 1.26) / 2) < 1e-9);
  assert.equal(p.actual, false);
  assert.equal(C.estimatePosition({ ...ship, stage: 'booked' }, T('2026-10-06')).p, 0);
  const act = C.estimatePosition({ ...ship, position: { lat: 10, lon: 20 } }, T('2026-10-06'));
  assert.deepEqual([act.lat, act.lon, act.actual], [10, 20, true]);
  // 空港コードでも位置推定できる
  assert.ok(C.estimatePosition({ mode: 'air', pol: 'NRT', pod: 'LAX', etd: '2026-10-01', eta: '2026-10-02', stage: 'in_transit' }, T('2026-10-01T12:00')));
});

test('alerts: delay, free time, stale, exception, delivered', () => {
  assert.equal(C.delayDays(ship, T('2026-10-14')), 3);
  assert.ok(C.alertsFor(ship, T('2026-10-14')).some((a) => a.level === 'danger'));
  assert.ok(C.alertsFor(ship, T('2026-10-09')).some((a) => a.level === 'warn'));
  assert.ok(C.alertsFor({ ...ship, stage: 'customs', freeTimeEnd: '2026-10-12' }, T('2026-10-13')).some((a) => /デマレージ/.test(a.text)));
  assert.ok(C.alertsFor({ ...ship, lastEventAt: '2026-10-01T00:00:00Z' }, T('2026-10-08')).some((a) => /動きがありません/.test(a.text)));
  assert.ok(C.alertsFor({ ...ship, exception: true }, T('2026-10-05')).some((a) => /問題/.test(a.text)));
  assert.deepEqual(C.alertsFor({ ...ship, stage: 'delivered' }, T('2026-12-01')), []);
  assert.equal(C.severity({ ...ship, exception: true }, T('2026-10-05')), 2);
});

test('applyUpdate keeps old values when update is empty, reports change', () => {
  const r1 = C.applyUpdate(ship, { stage: 'arrived', eta: '', vessel: 'V1', now: T('2026-10-10') });
  assert.equal(r1.changed, true);
  assert.equal(r1.shipment.eta, '2026-10-11');
  assert.equal(r1.shipment.stage, 'arrived');
  assert.equal(C.applyUpdate(r1.shipment, { stage: 'arrived', vessel: 'V1' }).changed, false);
  assert.equal(C.applyUpdate({ ...ship, exception: true }, { stage: 'delivered' }).shipment.exception, false);
});

test('csv roundtrip and mode inference', () => {
  const list = [{ ...ship, bookingNo: 'B1', note: 'a,"b"\nc', lot: 'L-1' }];
  const back = C.parseCsv(C.toCsv(list));
  assert.equal(back[0].note, 'a,"b"\nc');
  assert.equal(back[0].lot, 'L-1');
  assert.equal(back[0].mode, 'sea');
  const inf = C.parseCsv('containerNo,stage\n131-1234567-5,sailing');
  assert.equal(inf[0].mode, 'air');
  assert.equal(inf[0].stage, 'in_transit');
});

test('国内宅配は道内/道外に分かれ、旧データ(domestic)は道内へ移行', () => {
  assert.deepEqual(Object.keys(C.MODES), ['sea', 'air', 'hokkaido', 'mainland', 'intl']);
  assert.equal(C.MODES.hokkaido.short, '道内');
  assert.equal(C.MODES.mainland.short, '道外');
  assert.equal(C.migrate({ containerNo: 'X', mode: 'domestic', stage: 'booked' }).mode, 'hokkaido');
  assert.equal(C.validFor('mainland', '100000000004'), true);
  assert.equal(C.parseCsv('mode,containerNo\ndomestic,100000000004')[0].mode, 'hokkaido');
  // 道外は長距離のため「動きなし」とみなすまでの日数が長い
  const base = { containerNo: '100000000004', stage: 'in_transit' as const, lastEventAt: '2026-10-01T00:00:00Z' };
  const t = Date.parse('2026-10-04T00:00:00Z');
  assert.ok(C.alertsFor({ ...base, mode: 'hokkaido' }, t).some((a) => /動きがありません/.test(a.text)));
  assert.ok(!C.alertsFor({ ...base, mode: 'mainland' }, t).some((a) => /動きがありません/.test(a.text)));
});
