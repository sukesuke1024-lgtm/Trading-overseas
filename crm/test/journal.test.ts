import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCT, creditTotal, debitTotal, isBalanced, linesTotal, paymentJournal, reconcile, salesJournal, saleAmounts, toYen } from "../src/lib/journal.ts";
import type { Journal, Sale } from "../src/lib/types.ts";

const mkSale = (rate: number, status: Sale["status"] = "計上済"): Sale => {
  const lines = [{ desc: "和牛", qty: 160, unit: "kg", unitPrice: 131.81 }, { desc: "切り落とし", qty: 40.5, unit: "kg", unitPrice: 60.5 }];
  const { amount, amountJPY } = saleAmounts(lines, rate);
  return { id: "s1", no: "INV-2026-0001", dealId: "d1", orgId: "o1", date: "2026-10-01", currency: "SGD", lines, amount, rate, amountJPY, status, paidDate: null, receivedJPY: null, bankFeeJPY: null };
};

test("明細合計は通貨の最小単位で丸め、円換算は 外貨額×レート の四捨五入", () => {
  assert.equal(linesTotal([{ qty: 3, unitPrice: 0.1 }]), 0.3);
  assert.equal(toYen(1000.5, 112.6), Math.round(1000.5 * 112.6));
});

test("売上の仕訳：借方＝貸方＝売上の円換算額（売上高と一致）", () => {
  const s = mkSale(112.6);
  const j = salesJournal(s, "Lion City", "J-000001");
  assert.equal(debitTotal(j), s.amountJPY);
  assert.equal(creditTotal(j), s.amountJPY);
  assert.equal(j.lines.find((l) => l.account === ACCT.売上高)!.amount, s.amountJPY);
  assert.ok(isBalanced(j));
});

test("入金の仕訳：為替差損・差益と銀行手数料を含めて常に貸借一致", () => {
  const s = mkSale(112.6);
  for (const received of [s.amountJPY - 20000, s.amountJPY, s.amountJPY + 15000]) {
    const j = paymentJournal(s, "x", "J-2", "2026-10-26", received - 4500, 4500);
    assert.ok(isBalanced(j), `received=${received}`);
    assert.equal(j.lines.find((l) => l.account === ACCT.売掛金 && l.side === "C")!.amount, s.amountJPY);
  }
  const loss = paymentJournal(s, "x", "J-3", "2026-10-26", s.amountJPY - 10000, 0);
  assert.equal(loss.lines.find((l) => l.account === ACCT.為替差損益)!.side, "D");
  const gain = paymentJournal(s, "x", "J-4", "2026-10-26", s.amountJPY + 10000, 0);
  assert.equal(gain.lines.find((l) => l.account === ACCT.為替差損益)!.side, "C");
});

test("照合：一致なら ok、売上を変えると不一致を検出する", () => {
  const s = mkSale(112.6);
  const js: Journal[] = [salesJournal(s, "x", "J-1")];
  assert.ok(reconcile([s], js)[0].ok);
  const changed = { ...s, lines: [{ ...s.lines[0], qty: s.lines[0].qty + 1 }, s.lines[1]] };
  const { amount, amountJPY } = saleAmounts(changed.lines, s.rate);
  const r = reconcile([{ ...changed, amount, amountJPY }], js)[0];
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes("売上高")));
  assert.equal(reconcile([s], [])[0].ok, false);
});

test("入金済みは売掛金の消込まで照合する", () => {
  const s = { ...mkSale(112.6), status: "入金済" as const };
  const js = [salesJournal(s, "x", "J-1")];
  assert.equal(reconcile([s], js)[0].ok, false);
  js.push(paymentJournal(s, "x", "J-2", "2026-10-26", s.amountJPY - 3000, 0));
  assert.ok(reconcile([s], js)[0].ok);
});
