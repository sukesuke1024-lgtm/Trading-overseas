import test from "node:test";
import assert from "node:assert/strict";
import { buildEvents, notionCsv, markdown, tally, people } from "../src/lib/w5h.ts";

const name = (id: string) => ({ E1012: "山本 拓也", E1007: "渡辺 由美" }[id] ?? id);
const src = {
  meId: "E1012", name,
  punches: { "2026-09-29": { in: "09:00", out: "20:00", place: "在宅", what: "提案書作成", why: "契約更新", how: "資料→レビュー", who: "佐藤さん" }, "2026-08-01": { in: "09:00", out: "18:00" } },
  workflows: [{ id: "WF-1", type: "経費精算", title: "交通費", applicantId: "E1012", detail: "顧客訪問", createdAt: "2026-09-27", amount: 48620, w5h: { when: "9/25", where: "大阪", who: "A社 佐藤様", how: "新幹線・立替" }, steps: [{ approverId: "E1007", label: "所属長", state: "承認", at: "2026-09-28", comment: "OK" }] }],
  logs: [{ id: "l1", by: "E1012", start: "2026-09-29T14:00", end: "2026-09-29T15:30", where: "客先A社", who: "A社 佐藤様", what: "商談", why: "新規契約の提案", how: "対面", category: "会議" }, { id: "l2", by: "E1007", start: "2026-09-29T10:00", where: "x", who: "", what: "他人の記録", why: "", how: "", category: "作業" }],
};

test("normalizes punches, workflow apply/approve and manual logs into 5W1H", () => {
  const ev = buildEvents(src, "2026-09-01", "2026-09-30");
  assert.equal(ev.length, 3); // 打刻・申請・手入力。8月の打刻と他人の記録は除外
  const p = ev.find((e) => e.source === "punch")!;
  assert.equal(p.where, "在宅"); assert.equal(p.what, "提案書作成"); assert.equal(p.why, "契約更新"); assert.equal(p.how, "資料→レビュー"); assert.equal(p.who, "山本 拓也／佐藤さん"); assert.equal(p.minutes, 600);
  const a = ev.find((e) => e.what.startsWith("申請"))!; assert.match(a.who, /山本 拓也 → 渡辺 由美/); assert.equal(a.where, "大阪"); assert.equal(a.how, "新幹線・立替"); assert.match(a.who, /関係者：A社 佐藤様/);
  const m = ev.find((e) => e.source === "manual")!; assert.equal(m.minutes, 90); assert.equal(m.where, "客先A社");
  assert.deepEqual(ev.map((e) => e.when), [...ev.map((e) => e.when)].sort().reverse()); // 新しい順
});

test("approver sees own approval as event", () => {
  const ev = buildEvents({ ...src, meId: "E1007" }, "2026-09-01", "2026-09-30");
  const s = ev.find((e) => e.category === "承認")!; assert.match(s.what, /^承認：交通費/); assert.match(s.why, /コメント：OK/);
});

test("tally by where and who; exports", () => {
  const ev = buildEvents(src, "2026-09-01", "2026-09-30");
  const w = tally(ev, (e) => [e.where]); assert.equal(w[0].key, "在宅"); assert.equal(w[0].minutes, 600);
  assert.deepEqual(people("山本 拓也 → 渡辺 由美"), ["山本 拓也", "渡辺 由美"]);
  const csv = notionCsv(ev); assert.ok(csv.startsWith("﻿何を（件名）,いつ,終了,どこで")); assert.ok(csv.includes("2026-09-29 14:00"));
  const md = markdown(ev, "9月"); assert.ok(md.includes("| いつ | どこで | 誰が | 何を | なぜ | どのように |"));
});
