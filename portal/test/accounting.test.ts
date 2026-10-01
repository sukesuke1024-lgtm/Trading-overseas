import test from "node:test";
import assert from "node:assert/strict";
import { append, verifyChain } from "../src/lib/chain.ts";
import { sha256 } from "../src/lib/sha256.ts";
import { toCsv, zip, crc32 } from "../src/lib/csv.ts";
import { checkEntry, trialBalance, incomeStatement, balanceSheet, postJournal, reversal, isInvoiceNo, fyStartOf } from "../src/lib/accounting.ts";

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

test("invoice number & fiscal year", () => {
  assert.equal(isInvoiceNo("T1234567890123"), true); assert.equal(isInvoiceNo("1234567890123"), false);
  assert.equal(fyStartOf("2026-09-30"), "2026-04-01"); assert.equal(fyStartOf("2027-02-01"), "2026-04-01");
});

test("journal: balanced check, reversal nets to zero, statements balance", () => {
  const line = (account: string, side: "D" | "C", amount: number) => ({ account, side, amount });
  assert.ok(checkEntry({ date: "2026-09-01", lines: [line("6250", "D", 100), line("1110", "C", 90)] }));
  assert.equal(checkEntry({ date: "2026-09-01", lines: [line("6250", "D", 100), line("1110", "C", 100)] }), null);
  let j = postJournal([], { date: "2026-09-01", memo: "売上", source: "manual", createdBy: "001", lines: [line("1110", "D", 1000), line("4110", "C", 1000)] });
  const appr = { [j[0].id]: { by: "002", at: "x" } };
  const tb = trialBalance(j, appr, "2026-04-01", "2026-09-30");
  assert.equal(incomeStatement(tb).ordinaryIncome, 1000);
  assert.equal(balanceSheet(j, appr, "2026-04-01", "2026-09-30").balanced, true);
  j = postJournal(j, reversal(j[0], "001", "2026-09-02"));
  const appr2 = { ...appr, [j[1].id]: { by: "002", at: "x" } };
  assert.equal(incomeStatement(trialBalance(j, appr2, "2026-04-01", "2026-09-30")).ordinaryIncome, 0);
});
