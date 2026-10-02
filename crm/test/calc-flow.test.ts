import { test } from "node:test";
import assert from "node:assert/strict";
import { quote, marginLevel, type QuoteInput } from "../src/lib/calc.ts";
import { evaluate, FLOW, byId, currentNode, layout, START, type Answer } from "../src/lib/flow.ts";
import { parseRoster, roleFromPortal, toUser, diffRoster, PORTAL_DEMO_ROSTER } from "../src/lib/roster.ts";
import { forwardEstimate, bankRates } from "../src/lib/fx.ts";

const base: QuoteInput = { incoterm: "CIF", qty: 100, unitCostJPY: 1000, domesticJPY: 10000, exportJPY: 5000, freightJPY: 20000, insuranceRate: 0.3, importJPY: 0, payFeeRate: 0.5, insuranceTradeRate: 0, fxCostRate: 0, marginRate: 20, rate: 150 };

test("見積：目標粗利率どおりの粗利率になる（比率コスト込み）", () => {
  const r = quote(base);
  assert.ok(Math.abs(r.marginRate - 20) < 0.05, String(r.marginRate));
  assert.ok(Math.abs(r.priceTotalJPY - r.totalCost - r.profitJPY) < 0.01);
});
test("Incoterms：EXW は運賃・通関を含めず、DDP は関税も含める", () => {
  const exw = quote({ ...base, incoterm: "EXW", importJPY: 30000 });
  const ddp = quote({ ...base, incoterm: "DDP", importJPY: 30000 });
  assert.equal(exw.costFreight, 0); assert.equal(exw.costImport, 0);
  assert.ok(ddp.costImport === 30000 && ddp.priceTotalJPY > exw.priceTotalJPY);
});
test("損益分岐の単価では粗利0、指値の場合は粗利を計算", () => {
  const r = quote(base);
  const be = quote({ ...base, marginRate: 0 });
  assert.ok(Math.abs(be.priceUnitFx - r.breakEvenUnitFx) < 0.02);
  const fixed = quote({ ...base, fixedPriceJPY: 900 });
  assert.ok(fixed.profitJPY < 0 && marginLevel(fixed.marginRate) === "bad");
});

const run = (picks: number[], amount = 0) => {
  const answers: Answer[] = []; let id = START;
  for (const p of picks) { const n = byId(id); assert.equal(n.kind, "q"); answers.push({ node: id, option: p }); id = (n as { options: { next: string }[] }).options[p].next; }
  return evaluate(answers, amount);
};
test("フロー：前払い（全額・入金確認後）→規制OK→粗利OK→為替予約済み → GO", () => {
  const r = run([0, 0, 0, 0, 0]); // pay=前払い, adv=確認後, reg=満たせる, margin=確保, fx=予約済み
  assert.ok(r); assert.equal(r!.result, "go");
});
test("フロー：L/C 書類を提出できない＆アメンド不可は撤退", () => {
  const r = run([2, 0, 1, 1]); // lc, 大手銀行, 書類一部むずかしい, アメンド不可
  assert.equal(r!.result, "stop");
});
test("フロー：後払い・初回・保証なし・調査懸念は撤退、審査中は保留", () => {
  assert.equal(run([4, 2, 2, 2])!.result, "stop"); // O/A→初回→付保できない→調査レポート懸念あり
  assert.equal(run([4, 2, 1])!.result, "hold"); // 審査中
});
test("フロー：条件が付くと条件付きGO。5百万円以上は承認条件が付く", () => {
  const go = run([4, 0, 0, 0, 0, 0, 0]); // O/A, 実績良好, 付保OK, 限度内, 規制OK, 粗利OK, 為替予約済み
  assert.equal(go!.result, "go");
  const cond = run([4, 2, 0, 1, 0, 0, 2]); // 初回・付保OK・限度超過・為替手当なし → 条件が付く
  assert.equal(cond!.result, "conditional"); assert.ok(cond!.conditions.length >= 3);
  const big = run([0, 0, 0, 0, 0], 6_000_000);
  assert.equal(big!.result, "conditional"); assert.ok(big!.approval);
});
test("フロー：全ノードが到達可能で、全ての選択肢の遷移先が存在し、終端に着く", () => {
  const ids = new Set(FLOW.map((n) => n.id));
  const seen = new Set<string>([START]); const stack = [START];
  while (stack.length) { const n = byId(stack.pop()!); if (n.kind === "q") for (const o of n.options) { assert.ok(ids.has(o.next), o.next); if (!seen.has(o.next)) { seen.add(o.next); stack.push(o.next); } } }
  assert.equal(seen.size, FLOW.length);
  assert.equal(currentNode([])!.id, START);
  const l = layout(); assert.equal(l.placed.size, FLOW.length);
});

test("名簿：ポータルの書き出しを読み取り、権限を対応づける", () => {
  assert.equal(roleFromPortal("admin"), "admin"); assert.equal(roleFromPortal("executive"), "manager"); assert.equal(roleFromPortal("employee"), "sales");
  const parsed = parseRoster(JSON.stringify({ type: "hlink-roster", employees: [{ id: "010", name: "山田 太郎", dept: "営業部", job: "営業", role: "employee" }] }));
  assert.equal(parsed![0].name, "山田 太郎");
  assert.equal(toUser(parsed![0]).role, "sales");
  const csv = parseRoster("従業員番号,氏名,部署,職種,権限\n011,佐藤 花子,営業部,営業,管理者\n");
  assert.equal(toUser(csv![0]).role, "admin");
  assert.equal(parseRoster("not a roster"), null);
  const d = diffRoster(PORTAL_DEMO_ROSTER.map((e) => toUser(e)), [...PORTAL_DEMO_ROSTER.slice(0, 2), { id: "999", name: "新人 太郎" }]);
  assert.equal(d.added.length, 1); assert.equal(d.missing.length, 2);
});

test("為替：予約レートの目安（金利差）とTTS/TTB", () => {
  const f = forwardEstimate(150, 90, 0.5, 4.0);
  assert.ok(f.rate < 150 && f.points < 0);
  const b = bankRates(150, "USD"); assert.ok(b.tts > b.ttm && b.ttb < b.ttm);
});
