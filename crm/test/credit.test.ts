import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY, EMPTY_INPUT, evaluate, termMatrix, usage, validUntil, type CreditInput } from "../src/lib/credit.ts";

const strong: CreditInput = { ...EMPTY_INPUT, equityRatio: 55, currentRatio: 220, ordinaryMargin: 9, revenueGrowth: 12, debtToSalesMonths: 0.8, netWorthJPY: 2_000_000_000, annualRevenueJPY: 12_000_000_000, paymentRecord: "excellent", externalScore: 85, yearsInBusiness: 25, history: "over3", management: 5, industryRisk: 1, registryVerified: true, ownerVerified: true, sanctions: "clear", antiSocial: "clear", adverseNews: "none", countryRank: "A" };

test("財務・信用・属性がすべて良好なら S、満点は100点", () => {
  const r = evaluate(strong);
  assert.equal(r.max, 100); assert.equal(r.rating, "S"); assert.ok(r.score >= 95); assert.equal(r.completeness, 100);
});
test("情報がほとんどない取引先は、高格付けにならない（情報充足度で B 止まり）", () => {
  const r = evaluate({ ...EMPTY_INPUT, registryVerified: true, sanctions: "clear", antiSocial: "clear" });
  assert.ok(r.completeness < DEFAULT_POLICY.minCompleteness);
  assert.ok(["B", "C", "D"].includes(r.rating));
  assert.ok(r.missing.length > 5 && r.notes.some((n) => n.includes("情報充足度")));
});
test("制裁リスト該当は NG・限度ゼロ、全決済条件が不可", () => {
  const r = evaluate({ ...strong, sanctions: "hit" });
  assert.equal(r.rating, "NG"); assert.equal(r.totalLimitJPY, 0);
  const m = termMatrix(r.rating, "A");
  assert.ok(Object.values(m).every((x) => x.status === "ng"));
});
test("登記未確認は C 止まり。国別リスクが高いと格付け上限と限度係数が効く", () => {
  assert.equal(evaluate({ ...strong, registryVerified: false }).rating, "C");
  const a = evaluate(strong), e = evaluate({ ...strong, countryRank: "E" });
  assert.equal(e.rating, "C"); assert.ok(e.limitJPY < a.limitJPY);
});
test("限度額：純資産基準と月商基準の小さいほう。保険・保全は上乗せ", () => {
  const r = evaluate({ ...strong, insuredJPY: 10_000_000, insuredRate: 90, securedJPY: 1_000_000 });
  assert.equal(r.limitJPY, Math.min(2_000_000_000 * 0.15, (12_000_000_000 / 12) * 3));
  assert.equal(r.coveredJPY, 9_000_000 + 1_000_000);
  assert.equal(r.totalLimitJPY, r.limitJPY + r.coveredJPY);
  const unknownFin = evaluate({ ...EMPTY_INPUT, registryVerified: true, sanctions: "clear", antiSocial: "clear", paymentRecord: "good", history: "over3", countryRank: "A" });
  assert.ok(unknownFin.limitBasis.includes("最低枠"));
});
test("決済条件：格付けが下がるほど後払いが不可になる。前払いは常に可", () => {
  const s = termMatrix("S", "A"), c = termMatrix("C", "A"), d = termMatrix("D", "A");
  assert.equal(s.oa.status, "ok"); assert.equal(c.oa.status, "ng"); assert.equal(c.da.status, "ng"); assert.equal(d.partial.status, "ng");
  assert.equal(d.advance.status, "ok");
  assert.equal(termMatrix("A", "A").oa.status === "cond", true);
  assert.equal(termMatrix("A", "E").oa.status, "ng"); // 国別リスクEは2段階厳しく
});
test("使用率：売掛金が限度を超えたら警告。期待損失率は格付けが悪いほど高い", () => {
  assert.equal(usage(10_000_000, { arJPY: 12_000_000, pipelineJPY: 0 }).level, "over");
  assert.equal(usage(10_000_000, { arJPY: 5_000_000, pipelineJPY: 6_000_000 }).level, "future-over");
  assert.equal(usage(10_000_000, { arJPY: 1_000_000, pipelineJPY: 0 }).level, "ok");
  const base = { ...EMPTY_INPUT, registryVerified: true, sanctions: "clear" as const, antiSocial: "clear" as const };
  assert.ok(evaluate({ ...base, paymentRecord: "delinquent" }).expectedLossRate >= evaluate({ ...base, paymentRecord: "excellent", equityRatio: 55 }).expectedLossRate);
});
test("再審査期限", () => { assert.equal(validUntil("2026-10-02", 12), "2027-10-02"); });
