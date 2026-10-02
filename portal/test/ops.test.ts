import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AUTHORITY, routeFor, ruleFor } from "../src/lib/authority.ts";
import { bookValue, canSeeFile, canSeeMail, checkUpload, cutoffDate, ipAllowed, isLead, isValidNet, isMailUnread, maskMail, needsStepUp, nextAssetId, viewerOf, type FileRec, type Mail } from "../src/lib/ops.ts";
import { runRetention, archiveDue } from "../src/lib/archive.ts";
import { DEFAULT_RETENTION } from "../src/lib/ops.ts";
import type { Employee } from "../src/lib/data.ts";

const E = (id: string, over: Partial<Employee> = {}): Employee => ({ id, name: `名${id}`, employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", ...over });
const staff = [
  E("001", { job: "代表取締役", role: "admin", dept: "経営" }),
  E("002", { job: "取締役", role: "executive", dept: "経営", bossId: "001" }),
  E("003", { job: "経理・財務", role: "admin", dept: "管理部", bossId: "001" }),
  E("010", { job: "部長", dept: "営業部", bossId: "002" }),
  E("011", { job: "営業", dept: "営業部", bossId: "010" }),
  E("020", { job: "営業", dept: "製造部" }),
];

test("authority: amount thresholds pick the right rule (100万円以上は役員決裁)", () => {
  assert.deepEqual(ruleFor(DEFAULT_AUTHORITY, "稟議", 50_000)?.steps, ["所属長"]);
  assert.deepEqual(ruleFor(DEFAULT_AUTHORITY, "稟議", 100_000)?.steps, ["所属長", "管理部"]);
  assert.deepEqual(ruleFor(DEFAULT_AUTHORITY, "稟議", 1_000_000)?.steps, ["所属長", "管理部", "役員"]);
  assert.deepEqual(ruleFor(DEFAULT_AUTHORITY, "稟議", 5_000_000)?.steps, ["所属長", "管理部", "役員", "社長"]);
  assert.equal(ruleFor(DEFAULT_AUTHORITY, "経費精算", 29_999)?.steps.length, 1);
});

test("authority: route resolves people, skips the applicant and duplicates", () => {
  const r = routeFor(staff, DEFAULT_AUTHORITY, "稟議", 1_200_000, "011");
  assert.deepEqual(r.map((s) => [s.approverId, s.label, s.state]), [["010", "所属長", "承認待ち"], ["003", "管理部", "待機"], ["002", "役員決裁", "待機"]]);
  const big = routeFor(staff, DEFAULT_AUTHORITY, "稟議", 6_000_000, "011").map((s) => s.approverId);
  assert.deepEqual(big, ["010", "003", "002", "001"]);
  // 申請者が管理部の人なら、自分以外の管理者（社長）へ
  assert.equal(routeFor(staff, DEFAULT_AUTHORITY, "休暇申請", 0, "003")[0].approverId, "001"); // 所属長=社長 → 管理部は社長(重複)なので1段
  // 上司がいない人・誰もいない場合の救済
  assert.equal(routeFor(staff, DEFAULT_AUTHORITY, "経費精算", 1000, "020")[0].approverId, "001");
  assert.equal(routeFor([E("001", { role: "admin" })], DEFAULT_AUTHORITY, "稟議", 9_000_000, "001")[0].label, "代表者（自己決裁）");
  assert.equal(routeFor(staff, DEFAULT_AUTHORITY, "異動変更届", 0, "011")[0].approverId, "003");
});

test("files: visibility by scope (全社/事業部/役員・部長/本人/申請)", () => {
  const f = (over: Partial<FileRec>): FileRec => ({ id: "a".repeat(32), name: "x.pdf", size: 1, mime: "application/pdf", kind: "共有", scope: "全社", uploadedBy: "011", at: "t", ...over });
  const v = Object.fromEntries(staff.map((e) => [e.id, viewerOf(e)]));
  assert.ok(canSeeFile(f({}), v["020"]));
  assert.ok(canSeeFile(f({ scope: "事業部", dept: "営業部" }), v["010"]) && !canSeeFile(f({ scope: "事業部", dept: "営業部" }), v["020"]) && canSeeFile(f({ scope: "事業部", dept: "営業部" }), v["002"]));
  assert.ok(canSeeFile(f({ scope: "役員・部長" }), v["010"]) && !canSeeFile(f({ scope: "役員・部長" }), v["011"]));
  const pay = f({ kind: "給与明細", scope: "本人", ownerId: "011" });
  assert.ok(canSeeFile(pay, v["011"]) && canSeeFile(pay, v["003"]) && !canSeeFile(pay, v["002"]) && !canSeeFile(pay, v["010"]));
  assert.ok(needsStepUp(pay) && needsStepUp(f({ scope: "役員・部長" })) && !needsStepUp(f({})));
  const wf = { applicantId: "011", steps: [{ approverId: "010" }] };
  assert.ok(canSeeFile(f({ kind: "申請添付", scope: "申請", wfId: "w" }), v["010"], wf as never) && !canSeeFile(f({ kind: "申請添付", scope: "申請", wfId: "w" }), v["020"], wf as never));
  assert.ok(isLead(staff[3]) && !isLead(staff[4]));
});

test("upload check: extension, size, name", () => {
  assert.equal(checkUpload("規程.pdf", 1000), null);
  for (const [n, s] of [["a.exe", 10], ["a.pdf", 0], ["a.pdf", 11 * 1024 * 1024], ["../a.pdf", 10], ["a.html", 10], ["a.svg", 10]] as const) assert.notEqual(checkUpload(n, s), null, `${n} ${s}`);
});

test("mail: visibility, anonymity and unread", () => {
  const m = (over: Partial<Mail>): Mail => ({ id: "1", from: "011", toType: "窓口", toId: "人事", category: "ハラスメント相談", subject: "s", body: "b", at: "t", status: "未対応", thread: [], ...over });
  const v = Object.fromEntries(staff.map((e) => [e.id, viewerOf(e)]));
  assert.ok(canSeeMail(m({}), v["011"]) && canSeeMail(m({}), v["003"]) && !canSeeMail(m({}), v["010"]) && !canSeeMail(m({}), v["002"]));
  assert.ok(canSeeMail(m({ toType: "事業部", toId: "営業部" }), v["010"]) && !canSeeMail(m({ toType: "事業部", toId: "営業部" }), v["020"]) && canSeeMail(m({ toType: "事業部", toId: "営業部" }), v["002"]));
  assert.ok(canSeeMail(m({ toType: "個人", toId: "010" }), v["010"]) && !canSeeMail(m({ toType: "個人", toId: "010" }), v["003"]));
  const anon = m({ anon: true, thread: [{ by: "011", at: "t", body: "追記" }] });
  assert.equal(maskMail(anon, "003").from, "匿名"); assert.equal(maskMail(anon, "003").thread[0].by, "匿名"); assert.equal(maskMail(anon, "011").from, "011");
  assert.ok(isMailUnread(m({}), [], "003") && !isMailUnread(m({}), [], "011"));
});

test("assets: depreciation (定額法・少額資産・廃棄)", () => {
  const a = { id: "PC-0001", name: "PC", category: "PC" as const, purchaseDate: "2024-04-01", cost: 240_001, usefulLife: 4, status: "使用中" as const };
  const b0 = bookValue(a, "2024-04"); assert.equal(b0.monthly, 5000); assert.equal(b0.accumulated, 5000);
  assert.equal(bookValue(a, "2026-03").accumulated, 120000); // 24か月
  assert.equal(bookValue(a, "2028-03").value, 1); // 備忘価額1円
  assert.equal(bookValue({ ...a, cost: 90_000 }, "2024-04").expensed, true);
  assert.equal(bookValue({ ...a, status: "廃棄・売却", disposedAt: "2025-01-31" }, "2025-02").value, 0);
  assert.equal(nextAssetId([{ ...a, id: "PC-0007" }], "PC"), "PC-0008"); assert.equal(nextAssetId([], "スマートフォン"), "SP-0001");
});

test("ip allowlist (CIDR) and cutoff dates", () => {
  assert.ok(ipAllowed("1.2.3.4", [])); assert.ok(ipAllowed("192.168.1.55", ["192.168.1.0/24"])); assert.ok(!ipAllowed("192.168.2.55", ["192.168.1.0/24"]));
  assert.ok(ipAllowed("203.0.113.5", ["10.0.0.0/8", "203.0.113.5"])); assert.ok(!ipAllowed("unknown", ["10.0.0.0/8"])); assert.ok(ipAllowed("::ffff:10.1.2.3", ["10.0.0.0/8"]));
  assert.ok(isValidNet("10.0.0.0/8") && isValidNet("203.0.113.5") && !isValidNet("10.0.0.0/33") && !isValidNet("abc") && !isValidNet("300.1.1.1"));
  assert.equal(cutoffDate("2026-10-31", 36), "2023-10-31"); assert.equal(cutoffDate("2026-03-31", 1), "2026-02-28");
});

test("retention: exports CSV for old rows, removes them, keeps audit chain, runs once a day", () => {
  const s = {
    employees: staff, conditions: { holidays: [], breakMin: 60 }, news: [], read: {}, auditOutbox: [], journal: [], jApprovals: {}, closed: [], ipo: {}, docs: [], docAck: {}, events: [], kpis: [], remotes: [], files: [], clients: [], checks: [], extLinks: [], assets: [], authority: [], benefits: [], retention: DEFAULT_RETENTION, archiveMeta: { at: "", auditUpTo: "" },
    attendance: { "011": { "2020-01-06": { date: "2020-01-06", kind: "出勤", start: "08:30", end: "17:00", brk: 60 }, "2026-09-01": { date: "2026-09-01", kind: "出勤", start: "08:30", end: "17:00", brk: 60 } } },
    reports: { "011": { "2020-01-06": { date: "2020-01-06", done: "古い", plan: "", issues: "", status: "提出済", lines: [{ clientCode: "C001", clientName: "A社", task: "訪問", hours: 2 }] } } },
    mails: [{ id: "m1", from: "011", toType: "窓口", toId: "総務", category: "総務", subject: "古い件", body: "b", at: "2020-01-01T00:00:00Z", status: "完了", thread: [] }, { id: "m2", from: "011", toType: "窓口", toId: "総務", category: "総務", subject: "古いが未完了", body: "b", at: "2020-01-01T00:00:00Z", status: "対応中", thread: [] }],
    workflows: [{ id: "WF-2020-0001", type: "経費精算", title: "古い", applicantId: "011", detail: "d", createdAt: "2020-02-01", status: "承認済", steps: [], history: [{ at: "2020-02-02T01:00:00.000Z", by: "010", action: "承認", reason: "OK" }] }],
    audit: [{ seq: 1, prev: "0", hash: "h", at: "2020-01-01T00:00:00Z", actor: "x", action: "a" }],
  } as never;
  const r = runRetention(s, "2026-10-01", DEFAULT_RETENTION);
  const names = r.exports.map((e) => e.kind).sort();
  assert.deepEqual(names, ["勤怠", "問い合わせ", "日報", "申請承認", "監査ログ"].sort());
  const n = r.next as never as { attendance: Record<string, Record<string, unknown>>; reports: Record<string, Record<string, unknown>>; mails: { id: string }[]; workflows: unknown[]; audit: unknown[] };
  assert.deepEqual(Object.keys(n.attendance["011"]), ["2026-09-01"]); assert.deepEqual(Object.keys(n.reports["011"]), []);
  assert.deepEqual(n.mails.map((m) => m.id), ["m2"]); assert.equal(n.workflows.length, 0); assert.equal(n.audit.length, 1);
  assert.match(r.exports.find((e) => e.kind === "申請承認")!.content, /010.*承認：OK|名010 承認：OK/);
  assert.ok(!archiveDue(r.next, "2026-10-01") && archiveDue(r.next, "2026-10-02"));
  assert.equal(runRetention(r.next, "2026-10-01", DEFAULT_RETENTION).exports.length, 0); // 同じデータを二重に書き出さない
});

test("予定の並び順（時刻順・終日は下）・重なり判定・参加者の空き", async () => {
  const { schedOrder, overlaps, busyAttendees, roomConflict } = await import("../src/lib/ops.ts");
  const L = [{ title: "終日", start: undefined }, { title: "午後", start: "14:00" }, { title: "朝", start: "09:00" }, { title: "昼", start: "12:00" }];
  assert.deepEqual([...L].sort(schedOrder).map((x) => x.title), ["朝", "昼", "午後", "終日"]);
  assert.equal(overlaps({ start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" }), false);
  assert.equal(overlaps({ start: "10:00", end: "11:00" }, { start: "10:59", end: "12:00" }), true);
  assert.equal(overlaps({}, { start: "10:00", end: "11:00" }), true); // 終日は全時間帯と重なる
  const a = { id: "1", title: "t", date: "2026-10-05", start: "10:00", end: "11:00", ownerId: "A", attendees: ["B"], kind: "会議", vis: "全社", at: "", roomId: "r" } as never;
  assert.deepEqual(busyAttendees([a], { id: "2", date: "2026-10-05", start: "10:30", end: "11:30", ownerId: "C", attendees: ["B", "D"] }), ["B"]);
  assert.ok(roomConflict([a], { id: "2", date: "2026-10-05", start: "10:30", end: "11:30", roomId: "r" }));
  assert.equal(roomConflict([a], { id: "1", date: "2026-10-05", start: "10:30", end: "11:30", roomId: "r" }), undefined); // 自分自身は除く
});

test("ページ送りの番号: 少ないときは全部、多いときは省略記号でつなぐ", async () => {
  const { pageList } = await import("../src/lib/paging.ts");
  assert.deepEqual(pageList(1, 3), [1, 2, 3]);
  assert.deepEqual(pageList(1, 10), [1, 2, "…", 9, 10].slice(0, 2).concat(["…", 9, 10]));
  assert.deepEqual(pageList(5, 10), [1, 2, "…", 4, 5, 6, "…", 9, 10]);
  assert.deepEqual(pageList(10, 10), [1, 2, "…", 9, 10]);
});
