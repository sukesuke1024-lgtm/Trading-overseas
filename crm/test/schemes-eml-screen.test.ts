import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMES, cashCycle } from "../src/lib/schemes.ts";
import { buildEml, encodeWord, foldAddrs } from "../src/lib/eml.ts";
import { normalize, screen, lev, type SdnEntry } from "../src/lib/screening.ts";

test("スキーム：全スキームの流れが登場人物の中に収まり、リスク表が5行ある", () => {
  assert.ok(SCHEMES.length >= 10);
  for (const s of SCHEMES) {
    const ids = new Set(s.actors.map((a) => a.id));
    for (const f of s.flows) assert.ok(ids.has(f.from) && ids.has(f.to), `${s.id}: ${f.from}->${f.to}`);
    assert.equal(s.risks.length, 5, s.id);
    assert.ok(s.steps.length >= 3 && s.safeguards.length >= 1);
  }
  assert.equal(new Set(SCHEMES.map((s) => s.id)).size, SCHEMES.length);
});
test("資金繰り：買い手の入金が遅いほど立替日数・金利コストが増え、前払いなら買い手が資金を出す", () => {
  const base = { amountJPY: 10_000_000, marginRate: 20, financeRate: 3 };
  const oa = cashCycle({ ...base, producerTerm: 0, buyerTerm: 90 });
  assert.equal(oa.gapDays, 90); assert.equal(oa.financeCostJPY, Math.round(10_000_000 * 0.03 * 90 / 365)); assert.equal(oa.profitJPY, 2_500_000);
  const adv = cashCycle({ ...base, producerTerm: 0, buyerTerm: -14 });
  assert.equal(adv.financedByBuyer, true); assert.equal(adv.financeCostJPY, 0); assert.equal(adv.peakFundingJPY, 0);
});
test("eml：ヘッダー・本文・添付が正しく組み立てられ、日本語の件名とファイル名が符号化される", () => {
  const pdf = Buffer.from("%PDF-1.4 test").toString("base64");
  const eml = buildEml({ from: "me@example.com", to: "me@example.com", bcc: Array.from({ length: 40 }, (_, i) => `buyer${i}@example.com`), subject: "【H-LINK】日本産食品のご案内", text: "こんにちは", html: "<p>こんにちは</p>", attachments: [{ filename: "マイソク_和牛.pdf", contentType: "application/pdf", base64: pdf }], boundarySeed: "t" });
  assert.ok(eml.includes("X-Unsent: 1") && eml.includes("Subject: =?UTF-8?B?"));
  assert.ok(eml.split("\r\n").every((l) => l.length <= 998));
  assert.equal((eml.match(/----=_HLINK_Mixed_t/g) ?? []).length, 4); // ヘッダー宣言・開始・添付・終了
  assert.ok(eml.includes("filename*=UTF-8''%E3%83%9E"));
  assert.ok(eml.includes(pdf));
  const subj = /Subject: ((?:=\?UTF-8\?B\?[^?]+\?=\r\n ?)*=\?UTF-8\?B\?[^?]+\?=)/.exec(eml)![1].replace(/\r\n /g, "");
  const dec = [...subj.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((m) => Buffer.from(m[1], "base64").toString("utf8")).join("");
  assert.equal(dec, "【H-LINK】日本産食品のご案内");
  assert.ok(foldAddrs("Bcc", Array.from({ length: 40 }, (_, i) => `buyer${i}@example.com`)).split("\r\n").every((l) => l.length <= 78));
  assert.equal(encodeWord("abc"), "abc");
});

const SDN: SdnEntry[] = [
  { n: "PACIFIC TRADING CO., LTD", t: "entity", p: "TEST", id: "1" },
  { n: "AL NOOR GENERAL TRADING FZE", t: "entity", p: "TEST", id: "2" },
  { n: "IVAN PETROVICH SMIRNOV", t: "individual", p: "TEST", id: "3" },
  { n: "SOMETHING COMPLETELY DIFFERENT LLC", t: "entity", p: "TEST", id: "4" },
];
test("照合：社名の表記ゆれ（Co., Ltd・語順・綴り違い）を検出し、無関係な名前は出さない", () => {
  assert.equal(normalize("Pacific-Trading Company Limited"), "pacific");
  assert.equal(screen("Pacific Trading Co Ltd", SDN)[0]?.kind, "完全一致");
  assert.equal(screen("Smirnov Ivan Petrovich", SDN)[0]?.entry.id, "3");
  assert.ok(screen("Al Noor General Trading", SDN).some((m) => m.entry.id === "2"));
  assert.ok(screen("Ivan Petrovitch Smirnov", SDN).some((m) => m.entry.id === "3")); // 綴り違い
  assert.equal(screen("Lion City Fine Foods Pte. Ltd.", SDN).length, 0);
  assert.equal(screen("ab", SDN).length, 0); // 短すぎる入力は照会しない
  assert.equal(lev("kitten", "sitting"), 3);
});
