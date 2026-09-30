import test from "node:test";
import assert from "node:assert/strict";
import { append, verifyChain } from "../src/lib/chain.ts";
import { sha256 } from "../src/lib/sha256.ts";
import { toCsv, zip, crc32 } from "../src/lib/csv.ts";
import { buildSeedJournal, checkEntry, trialBalance, incomeStatement, balanceSheet, consumptionTax, postJournal, reversal, isInvoiceNo, fyStartOf, sgaByDept } from "../src/lib/accounting.ts";
import { computePay, monthlyIncomeTax, payrollLines, totals } from "../src/lib/payroll.ts";

test("sha256 vectors", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
});

test("hash chain detects tamper / delete / reorder", () => {
  let l: { seq: number; prev: string; hash: string; v: string }[] = [];
  for (const v of ["a", "b", "c", "d"]) l = append(l as never[], { v } as never) as never;
  assert.equal(verifyChain(l).ok, true);
  const t = structuredClone(l); t[1].v = "X"; assert.equal(verifyChain(t).brokenAt, 2);
  const d = [l[0], l[2], l[3]]; assert.equal(verifyChain(d).ok, false);
  const r = [l[0], l[2], l[1], l[3]]; assert.equal(verifyChain(r).ok, false);
});

test("csv: BOM, quoting, formula-injection guard", () => {
  const s = toCsv(["a", "b"], [["=1+1", 'x,"y"'], [-5, "-abc"]]);
  assert.ok(s.startsWith("﻿"));
  assert.ok(s.includes("'=1+1")); assert.ok(s.includes('"x,""y"""')); assert.ok(s.includes("\r\n-5,'-abc"));
});

test("zip is well-formed (crc32 check value)", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const z = zip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(z.buffer).getUint32(z.length - 22, true), 0x06054b50);
});

test("seed journal: every entry balanced, chain valid, BS balances", () => {
  const j = buildSeedJournal();
  assert.ok(j.length > 100);
  for (const e of j) assert.equal(checkEntry(e), null, e.id);
  assert.equal(verifyChain(j).ok, true);
  const bs = balanceSheet(j, {}, "2026-04-01", "2026-09-30");
  assert.equal(bs.balanced, true);
  const tb = trialBalance(j, {}, "2026-04-01", "2026-09-30");
  const pl = incomeStatement(tb);
  assert.equal(pl.grossProfit, pl.sales - pl.cogs);
  assert.equal(pl.netIncome, pl.operatingIncome + pl.nonOpIncome - pl.nonOpExpense - pl.tax);
  assert.ok(pl.sales > 0 && pl.sgaTotal > 0 && pl.operatingIncome > 0 && pl.netIncome > 0);
  const cash = tb.find((r) => r.code === "1120")!.closing; assert.ok(cash > 0);
  assert.equal(bs.currentProfit, pl.netIncome);
  const ct = consumptionTax(tb); assert.ok(ct.output > ct.input);
  assert.ok(sgaByDept(j, {}, "2026-04-01", "2026-09-30").length > 3);
});

test("entry validation & reversal & manual approval gating", () => {
  assert.match(checkEntry({ date: "2026-09-30", lines: [{ account: "1110", side: "D", amount: 100 }, { account: "4110", side: "C", amount: 99 }] })!, /貸借/);
  assert.match(checkEntry({ date: "2026-09-30", lines: [{ account: "9999", side: "D", amount: 100 }, { account: "4110", side: "C", amount: 100 }] })!, /未登録/);
  let j = buildSeedJournal();
  j = postJournal(j, { date: "2026-09-30", memo: "手動", source: "manual", createdBy: "E1013", lines: [{ account: "6250", side: "D", amount: 1000 }, { account: "1110", side: "C", amount: 1000 }] });
  const m = j[j.length - 1];
  const before = trialBalance(j, {}, "2026-04-01", "2026-09-30").find((r) => r.code === "6250")!.closing;
  const after = trialBalance(j, { [m.id]: { by: "E1004", at: "x" } }, "2026-04-01", "2026-09-30").find((r) => r.code === "6250")!.closing;
  assert.equal(after - before, 1000); // 承認前は集計に含まれない
  j = postJournal(j, reversal(m, "E1004", "2026-09-30"));
  assert.equal(j[j.length - 1].reverses, m.id);
  assert.equal(verifyChain(j).ok, true);
});

test("invoice number & fiscal year", () => {
  assert.equal(isInvoiceNo("T1234567890123"), true); assert.equal(isInvoiceNo("1234567890123"), false);
  assert.equal(fyStartOf("2026-09-30"), "2026-04-01"); assert.equal(fyStartOf("2027-02-01"), "2026-04-01");
});

test("payroll: OT premium, deductions, net, journal balance", () => {
  const r = computePay({ id: "E1", name: "t", dept: "d", base: 480_000, allowance: 20_000, commute: 15_000, dependents: 1, residentTax: 20_000, hours: { overtime: 30 * 60, night: 5 * 60, legalHoliday: 8 * 60 } });
  assert.equal(r.otPay, Math.round(3000 * 1.25 * 30)); // 480000/160=3000
  assert.equal(r.nightPay, Math.round(3000 * 0.25 * 5)); assert.equal(r.holidayPay, Math.round(3000 * 1.35 * 8));
  assert.equal(r.gross, 480000 + 20000 + 15000 + r.otPay + r.nightPay + r.holidayPay);
  assert.equal(r.net, r.gross - r.deductions);
  assert.ok(r.incomeTax > 0 && r.incomeTax < r.gross * 0.1);
  const p = payrollLines(totals([r]), "2026-09");
  const d = p.lines.filter((l) => l.side === "D").reduce((s, l) => s + l.amount, 0), c = p.lines.filter((l) => l.side === "C").reduce((s, l) => s + l.amount, 0);
  assert.equal(d, c);
  const over = computePay({ id: "E2", name: "t", dept: "d", base: 320_000, allowance: 0, commute: 0, dependents: 0, residentTax: 0, hours: { overtime: 70 * 60, night: 0, legalHoliday: 0 } });
  assert.equal(over.otPay, Math.round(2000 * (1.25 * 60 + 1.5 * 10))); // 60h超は1.5倍
});

test("income tax monotonic", () => {
  let prev = -1; for (const g of [150_000, 250_000, 350_000, 500_000, 800_000, 1_500_000]) { const t = monthlyIncomeTax(g, 0); assert.ok(t >= prev); prev = t; }
  assert.equal(monthlyIncomeTax(80_000, 0), 0);
});
