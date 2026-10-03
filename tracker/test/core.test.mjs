import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../core.js');

test('ISO 6346 check digit', () => {
  assert.equal(C.isValidContainerNo('CSQU3054383'), true); // 規格書の例
  assert.equal(C.isValidContainerNo('CSQU3054384'), false);
  assert.equal(C.isValidContainerNo('csqu 305438-3'), true);
  assert.equal(C.isValidContainerNo('ABC1234567'), false);
});

test('carrier lookup', () => {
  assert.equal(C.carrierOf('MSKU0000000'), 'Maersk');
  assert.equal(C.carrierOf('XXXU0000000'), '不明');
});

const ship = { containerNo: 'CSQU3054383', pol: 'JPYOK', pod: 'SGSIN', etd: '2026-10-01', eta: '2026-10-11', stage: 'sailing' };
const T = (d) => Date.parse(d);

test('progress and position', () => {
  assert.equal(C.voyageProgress(ship, T('2026-10-06')), 0.5);
  const p = C.estimatePosition(ship, T('2026-10-06'));
  assert.ok(Math.abs(p.lat - (35.45 + 1.26) / 2) < 1e-9);
  assert.equal(C.estimatePosition({ ...ship, stage: 'booked' }, T('2026-10-06')).p, 0);
  assert.equal(C.estimatePosition({ ...ship, stage: 'arrived' }, T('2026-10-06')).p, 1);
});

test('delay and alerts', () => {
  assert.equal(C.delayDays(ship, T('2026-10-14')), 3);
  assert.equal(C.delayDays({ ...ship, stage: 'arrived' }, T('2026-10-14')), 0);
  assert.ok(C.alertsFor(ship, T('2026-10-14')).some((a) => a.level === 'danger'));
  assert.ok(C.alertsFor(ship, T('2026-10-09')).some((a) => a.level === 'warn'));
  const ft = { ...ship, stage: 'customs', freeTimeEnd: '2026-10-12' };
  assert.ok(C.alertsFor(ft, T('2026-10-13')).some((a) => /デマレージ/.test(a.text)));
});

test('csv roundtrip', () => {
  const list = [{ ...ship, bookingNo: 'B1', note: 'a,"b"\nc', lot: 'L-1' }];
  const back = C.parseCsv(C.toCsv(list));
  assert.equal(back.length, 1);
  assert.equal(back[0].note, 'a,"b"\nc');
  assert.equal(back[0].containerNo, 'CSQU3054383');
  assert.equal(back[0].lot, 'L-1');
});
