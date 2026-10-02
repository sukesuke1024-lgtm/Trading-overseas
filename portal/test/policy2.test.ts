import test from "node:test";
import assert from "node:assert/strict";
import { mergeWrite, sanitizeForRead } from "../src/server/policy.ts";
import { DEFAULT_AUTHORITY, routeFor } from "../src/lib/authority.ts";

const emps = [
  { id: "001", name: "長尾", employment: "役員", job: "代表取締役", scheduled: 7.5, role: "admin", dept: "経営" },
  { id: "002", name: "役員", employment: "役員", job: "取締役", scheduled: 7.5, role: "executive", dept: "経営", bossId: "001" },
  { id: "003", name: "管理", employment: "正社員", job: "総務", scheduled: 7.5, role: "admin", dept: "管理部", bossId: "001" },
  { id: "010", name: "部長", employment: "正社員", job: "部長", scheduled: 7.5, role: "employee", dept: "営業部", bossId: "002" },
  { id: "011", name: "社員", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", dept: "営業部", bossId: "010" },
  { id: "020", name: "他部", employment: "正社員", job: "営業", scheduled: 7.5, role: "employee", dept: "製造部", bossId: "002" },
];
const NOW = "2026-10-01T09:00:00.000Z";
const route = (type: string, amt: number, who: string) => routeFor(emps as never, DEFAULT_AUTHORITY, type as never, amt, who);
const newWf = (over: Record<string, unknown> = {}) => { const amt = (over.amount as number) ?? 1_500_000; return { id: "WF-2026-0001", type: "稟議", title: "設備投資", applicantId: "011", amount: amt, detail: "d", createdAt: "2026-10-01", status: "承認待ち", steps: route("稟議", amt, "011"), history: [{ at: "x", by: "011", action: "申請" }], ...over }; };
const base = (over = {}) => ({ employees: emps, authority: DEFAULT_AUTHORITY, workflows: [], journal: [], closed: [], files: [], mails: [], checks: [], clients: [{ code: "C001", name: "A社", dept: "営業部", active: true }, { code: "C900", name: "B社", dept: "製造部", active: true }], docs: [], assets: [], extLinks: [], audit: [], ...over });
const ctx = { now: NOW };

test("workflow: new application must follow the authority route; server stamps time and actor", () => {
  const ok = mergeWrite(base(), { workflows: [newWf()] }, "011", "employee", ctx);
  assert.equal(ok.denied.length, 0); assert.equal(ok.state.workflows[0].history[0].at, NOW);
  assert.deepEqual(ok.state.workflows[0].steps.map((s: { approverId: string }) => s.approverId), ["010", "003", "002"]); // 100万円以上は役員まで
  const weak = newWf({ steps: [{ approverId: "010", label: "所属長", state: "承認待ち" }] }); // 弱いルートを自分で選ぶ
  assert.ok(mergeWrite(base(), { workflows: [weak] }, "011", "employee", ctx).denied.includes("workflows"));
  assert.ok(mergeWrite(base(), { workflows: [newWf({ applicantId: "020" })] }, "011", "employee", ctx).denied.includes("workflows")); // なりすまし
});

test("workflow: approval needs the current approver, records who/when/reason (including executives); reject needs a reason", () => {
  let s = mergeWrite(base(), { workflows: [newWf()] }, "011", "employee", ctx).state;
  const w0 = s.workflows[0];
  const act = (by: string, idx: number, state: string, reason?: string) => ({ ...w0, ...{}, status: state === "承認" ? "承認待ち" : state, steps: w0.steps.map((st: Record<string, unknown>, i: number) => (i === idx ? { ...st, state, at: "fake", comment: reason } : i === idx + 1 && state === "承認" ? { ...st, state: "承認待ち" } : st)), history: [...w0.history, { at: "fake", by, action: state, ...(reason ? { reason } : {}) }] });
  assert.ok(mergeWrite(s, { workflows: [act("002", 0, "承認")] }, "002", "executive", ctx).denied.includes("workflows")); // 順番飛ばし
  const r1 = mergeWrite(s, { workflows: [act("010", 0, "承認", "確認済み")] }, "010", "employee", { now: "2026-10-01T10:00:00.000Z" });
  assert.equal(r1.denied.length, 0); const h = r1.state.workflows[0].history; assert.equal(h[h.length - 1].by, "010"); assert.equal(h[h.length - 1].at, "2026-10-01T10:00:00.000Z"); assert.equal(r1.state.workflows[0].steps[0].at, "2026-10-01T10:00:00.000Z");
  s = r1.state;
  // 差戻しは理由必須（役員でも同じ）
  const w1 = s.workflows[0];
  const rej = (reason?: string) => ({ ...w1, status: "差戻し", steps: w1.steps.map((st: Record<string, unknown>, i: number) => (i === 1 ? { ...st, state: "差戻し", comment: reason } : st)), history: [...w1.history, { at: "x", by: "003", action: "差戻し", ...(reason ? { reason } : {}) }] });
  assert.ok(mergeWrite(s, { workflows: [rej()] }, "003", "admin", ctx).denied.includes("workflows"));
  const r2 = mergeWrite(s, { workflows: [rej("金額の根拠が不足")] }, "003", "admin", { now: "2026-10-02T00:00:00.000Z" });
  assert.equal(r2.denied.length, 0); assert.equal(r2.state.workflows[0].status, "差戻し");
  // 履歴の改ざん（過去の記録の書換え・削除）は不可
  const tamper = { ...r2.state.workflows[0], history: r2.state.workflows[0].history.slice(1) };
  assert.ok(mergeWrite(r2.state, { workflows: [tamper] }, "011", "employee", ctx).denied.includes("workflows"));
  // 申請者の修正再申請：変更理由が必須、承認ルートは再計算、最初から承認をやり直す
  const w2 = r2.state.workflows[0];
  const resub = (reason?: string, amount = 400_000) => ({ ...w2, amount, title: "設備投資（減額）", status: "承認待ち", steps: route("稟議", amount, "011"), history: [...w2.history, { at: "x", by: "011", action: "修正再申請", ...(reason ? { reason } : {}) }] });
  assert.ok(mergeWrite(r2.state, { workflows: [resub()] }, "011", "employee", ctx).denied.includes("workflows"));
  assert.ok(mergeWrite(r2.state, { workflows: [resub("減額", 400_000)] }, "002", "executive", ctx).denied.includes("workflows")); // 他人は不可
  const r3 = mergeWrite(r2.state, { workflows: [resub("金額を見直し", 400_000)] }, "011", "employee", { now: "2026-10-03T00:00:00.000Z" });
  assert.equal(r3.denied.length, 0); assert.equal(r3.state.workflows[0].status, "承認待ち"); assert.deepEqual(r3.state.workflows[0].steps.map((x: { approverId: string }) => x.approverId), ["010", "003"]);
  assert.equal(r3.state.workflows[0].history.at(-1).reason, "金額を見直し");
  // ルートを偽った再申請は不可
  assert.ok(mergeWrite(r2.state, { workflows: [{ ...resub("x", 400_000), steps: [{ approverId: "010", label: "所属長", state: "承認待ち" }] }] }, "011", "employee", ctx).denied.includes("workflows"));
});

test("workflow: final approval of an expense creates the journal on the server", () => {
  const amt = 20_000;
  const s0 = mergeWrite(base(), { workflows: [newWf({ type: "経費精算", amount: amt, steps: route("経費精算", amt, "011"), category: "6210" })] }, "011", "employee", ctx).state;
  const w = s0.workflows[0];
  const done = { ...w, status: "承認済", steps: w.steps.map((st: Record<string, unknown>) => ({ ...st, state: "承認", at: "x" })), history: [...w.history, { at: "x", by: "010", action: "承認" }] };
  const r = mergeWrite(s0, { workflows: [done] }, "010", "employee", ctx);
  assert.equal(r.denied.length, 0); assert.equal(r.state.journal.length, 1); assert.equal(r.state.journal[0].source, "workflow");
});

test("files: register needs a stored blob owned by the uploader; scope rules; payslips admin-only; deletion rights", () => {
  const id = (n: number) => String(n).repeat(32).slice(0, 32);
  const blobs: Record<string, { owner: string; name: string; size: number; mime: string }> = { [id(1)]: { owner: "011", name: "見積.pdf", size: 10, mime: "application/pdf" }, [id(2)]: { owner: "003", name: "給与.pdf", size: 10, mime: "application/pdf" }, [id(3)]: { owner: "011", name: "x.pdf", size: 10, mime: "application/pdf" } };
  const c = { now: NOW, blob: (i: string) => blobs[i] };
  const rec = (over: Record<string, unknown> = {}) => ({ id: id(1), name: "見積.pdf", size: 10, mime: "application/pdf", kind: "共有", scope: "事業部", dept: "営業部", uploadedBy: "011", at: "x", ...over });
  const r = mergeWrite(base(), { files: [rec()] }, "011", "employee", c);
  assert.equal(r.denied.length, 0); assert.equal(r.state.files[0].at, NOW); assert.equal(r.state.files[0].uploadedBy, "011");
  assert.ok(mergeWrite(base(), { files: [rec({ dept: "製造部" })] }, "011", "employee", c).denied.includes("files")); // 他事業部を名乗れない
  assert.ok(mergeWrite(base(), { files: [rec({ id: id(9) })] }, "011", "employee", c).denied.includes("files")); // 本体が無い
  assert.ok(mergeWrite(base(), { files: [rec({ scope: "役員・部長" })] }, "011", "employee", c).denied.includes("files")); // 一般社員は役員・部長限定にできない
  assert.ok(mergeWrite(base(), { files: [rec({ kind: "給与明細", scope: "本人", ownerId: "011", period: "2026-09" })] }, "011", "employee", c).denied.includes("files"));
  const pay = { id: id(2), name: "給与.pdf", size: 10, mime: "application/pdf", kind: "給与明細", scope: "本人", ownerId: "011", period: "2026-09", uploadedBy: "003", at: "x" };
  const p = mergeWrite(base(), { files: [pay] }, "003", "admin", c); assert.equal(p.denied.length, 0);
  // 閲覧：本人と管理者のみ
  assert.equal(sanitizeForRead(p.state, "011", "employee")!.files.length, 1);
  assert.equal(sanitizeForRead(p.state, "020", "employee")!.files.length, 0);
  assert.equal(sanitizeForRead(p.state, "002", "executive")!.files.length, 0);
  // 削除：本人は給与明細を消せない／管理者は消せる
  assert.ok(mergeWrite(p.state, { filesDel: [id(2)] }, "011", "employee", c).denied.includes("files"));
  assert.equal(mergeWrite(p.state, { filesDel: [id(2)] }, "003", "admin", c).state.files.length, 0);
  assert.equal(mergeWrite(p.state, { files: [] }, "003", "admin", c).state.files.length, 1); // 省略は削除ではない（古い画面で消えない）
  // 事業部ファイルの削除は登録者本人のみ（同じ事業部の他人は不可）
  const shared = mergeWrite(base(), { files: [rec()] }, "011", "employee", c).state;
  assert.ok(mergeWrite(shared, { filesDel: [id(1)] }, "010", "employee", c).denied.includes("files"));
  assert.equal(mergeWrite(shared, { filesDel: [id(1)] }, "011", "employee", c).state.files.length, 0);
  const arch = { ...shared, files: [{ id: id(5), name: "a.csv", size: 1, mime: "text/csv", kind: "アーカイブ", scope: "管理者", uploadedBy: "system", at: "x" }] };
  assert.ok(mergeWrite(arch, { filesDel: [id(5)] }, "003", "admin", c).denied.includes("files")); // アーカイブCSVは消せない
});

test("mails: send, reply by recipient, anonymous masking, no peeking", () => {
  const m = (over: Record<string, unknown> = {}) => ({ id: "M1", from: "011", toType: "窓口", toId: "人事", category: "ハラスメント相談", subject: "相談", body: "内容", at: "x", status: "未対応", thread: [], anon: true, ...over });
  const s1 = mergeWrite(base(), { mails: [m()] }, "011", "employee", ctx).state;
  assert.equal(s1.mails[0].at, NOW);
  assert.equal(sanitizeForRead(s1, "003", "admin")!.mails[0].from, "匿名");
  assert.equal(sanitizeForRead(s1, "011", "employee")!.mails[0].from, "011");
  assert.equal(sanitizeForRead(s1, "010", "employee")!.mails.length, 0); assert.equal(sanitizeForRead(s1, "002", "executive")!.mails.length, 0);
  // 管理者の返信（匿名のまま）
  const adminView = sanitizeForRead(s1, "003", "admin")!.mails[0];
  const rep = mergeWrite(s1, { mails: [{ ...adminView, status: "対応中", thread: [{ by: "003", at: "x", body: "お話を伺います" }] }] }, "003", "admin", ctx);
  assert.equal(rep.denied.length, 0); assert.equal(rep.state.mails[0].from, "011"); assert.equal(rep.state.mails[0].thread[0].at, NOW); assert.equal(rep.state.mails[0].status, "対応中");
  // 他人宛ての個人メールに割り込めない・本文の改ざん不可
  const dm = mergeWrite(base(), { mails: [m({ toType: "個人", toId: "010", anon: false })] }, "011", "employee", ctx).state;
  assert.ok(mergeWrite(dm, { mails: [{ ...dm.mails[0], thread: [{ by: "020", at: "x", body: "割り込み" }] }] }, "020", "employee", ctx).denied.includes("mails"));
  assert.ok(mergeWrite(dm, { mails: [{ ...dm.mails[0], body: "改ざん" }] }, "010", "employee", ctx).denied.includes("mails"));
  assert.ok(mergeWrite(base(), { mails: [m({ from: "020" })] }, "011", "employee", ctx).denied.includes("mails")); // なりすまし送信
  assert.ok(mergeWrite(base(), { mails: [m({ toType: "個人", toId: "010", anon: true })] }, "011", "employee", ctx).denied.includes("mails")); // 匿名は窓口宛てのみ
});

test("checks (与信/反社): append-only, own dept clients, own name; clients visible by dept", () => {
  const chk = (over: Record<string, unknown> = {}) => ({ id: "K1", clientCode: "C001", kind: "反社", result: "問題なし", source: "法人番号公表サイト", checkedBy: "011", at: "x", ...over });
  const r = mergeWrite(base(), { checks: [chk()] }, "011", "employee", ctx);
  assert.equal(r.denied.length, 0); assert.equal(r.state.checks[0].at, NOW);
  assert.ok(mergeWrite(base(), { checks: [chk({ clientCode: "C900" })] }, "011", "employee", ctx).denied.includes("checks")); // 他事業部の関与先
  assert.ok(mergeWrite(base(), { checks: [chk({ checkedBy: "010" })] }, "011", "employee", ctx).denied.includes("checks"));
  assert.ok(mergeWrite(r.state, { checks: [{ ...chk(), result: "問題なし", note: "書換え" }] }, "011", "employee", ctx).denied.includes("checks"));
  assert.deepEqual(sanitizeForRead(r.state, "011", "employee")!.clients.map((c: { code: string }) => c.code), ["C001"]);
  assert.equal(sanitizeForRead(r.state, "003", "admin")!.clients.length, 2);
});

test("admin-only lists (clients/assets/benefits/authority/retention) and validation", () => {
  const asset = { id: "PC-0001", name: "PC", category: "PC", purchaseDate: "2026-04-01", cost: 150000, usefulLife: 4, status: "使用中", assigneeId: "011" };
  assert.ok(mergeWrite(base(), { assets: [asset] }, "011", "employee", ctx).denied.includes("assets"));
  const ok = mergeWrite(base(), { assets: [asset] }, "003", "admin", ctx); assert.equal(ok.denied.length, 0);
  assert.equal(sanitizeForRead(ok.state, "011", "employee")!.assets.length, 1); assert.equal(sanitizeForRead(ok.state, "020", "employee")!.assets.length, 0);
  assert.ok(mergeWrite(base(), { assets: [{ ...asset, cost: -1 }] }, "003", "admin", ctx).denied.includes("assets"));
  assert.ok(mergeWrite(base(), { clients: [{ code: "bad code!", name: "x", dept: "d", active: true }] }, "003", "admin", ctx).denied.includes("clients"));
  assert.ok(mergeWrite(base(), { extLinks: [{ id: "x", name: "n", url: "javascript:alert(1)", kind: "与信", dept: "" }] }, "003", "admin", ctx).denied.includes("extLinks"));
  assert.ok(mergeWrite(base(), { authority: [] }, "003", "admin", ctx).denied.includes("authority")); // 全種別に既定の行が必要
  assert.ok(mergeWrite(base(), { authority: DEFAULT_AUTHORITY.map((r) => (r.type === "稟議" ? { ...r, steps: [] } : r)) }, "003", "admin", ctx).denied.includes("authority"));
  assert.equal(mergeWrite(base(), { authority: [...DEFAULT_AUTHORITY, { type: "経費精算", min: 200000, steps: ["所属長", "役員"] }] }, "003", "admin", ctx).denied.length, 0);
  assert.ok(mergeWrite(base(), { retention: { attendance: 12, reports: 24, mails: 24, workflows: 36, audit: 60 } }, "003", "admin", ctx).denied.includes("retention")); // 勤怠は最低36か月
  assert.equal(mergeWrite(base(), { retention: { attendance: 60, reports: 24, mails: 24, workflows: 36, audit: 60 } }, "003", "admin", ctx).denied.length, 0);
  assert.ok(mergeWrite(base(), { retention: { attendance: 60, reports: 24, mails: 24, workflows: 36, audit: 60 } }, "002", "executive", ctx).denied.includes("retention"));
});

test("reports: submitted needs lines with an existing client code; names are filled from the master", () => {
  const rep = (over: Record<string, unknown> = {}) => ({ date: "2026-09-02", done: "", plan: "", issues: "", status: "提出済", lines: [{ clientCode: "C001", clientName: "偽の名前", task: "訪問", hours: 2 }], ...over });
  const ok = mergeWrite(base(), { reports: { "011": { "2026-09-02": rep() } } }, "011", "employee", ctx);
  assert.equal(ok.denied.length, 0); assert.equal(ok.state.reports["011"]["2026-09-02"].lines[0].clientName, "A社");
  for (const bad of [rep({ lines: [] }), rep({ lines: undefined }), rep({ lines: [{ clientCode: "ZZZ", clientName: "", task: "t", hours: 1 }] }), rep({ lines: [{ clientCode: "C001", clientName: "", task: " ", hours: 1 }] }), rep({ lines: [{ clientCode: "C001", clientName: "", task: "t", hours: 0 }] })]) assert.ok(mergeWrite(base(), { reports: { "011": { "2026-09-02": bad } } }, "011", "employee", ctx).denied.includes("reports"));
  assert.equal(mergeWrite(base(), { reports: { "011": { "2026-09-02": rep({ status: "下書き", lines: [] }) } } }, "011", "employee", ctx).denied.length, 0); // 下書きは未完成でもよい
});

test("与信: 決算書3期分（または受領できない理由）が必要。決算書は関与先の事業部に紐づく", () => {
  const hex = (n: number) => `${n}`.padStart(24, "a");
  const blobs: Record<string, { owner: string; name: string; size: number; mime: string }> = {};
  const stmt = (n: number, period: string, over: Record<string, unknown> = {}) => { blobs[hex(n)] = { owner: "011", name: `決算${n}.pdf`, size: 10, mime: "application/pdf" }; return { id: hex(n), name: `決算${n}.pdf`, size: 10, mime: "application/pdf", kind: "決算書", scope: "事業部", dept: "営業部", clientCode: "C001", period, uploadedBy: "011", at: "x", ...over }; };
  const c = { now: NOW, blob: (i: string) => blobs[i] };
  const chk = (over: Record<string, unknown> = {}) => ({ id: "K2", clientCode: "C001", kind: "与信", result: "問題なし", source: "帝国データバンク", checkedBy: "011", at: "x", ...over });
  assert.ok(mergeWrite(base(), { checks: [chk()] }, "011", "employee", c).denied.includes("checks")); // 決算書なし
  assert.equal(mergeWrite(base(), { checks: [chk({ stmtReason: "設立2期目のため第1期のみ" })] }, "011", "employee", c).denied.length, 0); // 理由あり
  assert.equal(mergeWrite(base(), { checks: [chk({ result: "確認中" })] }, "011", "employee", c).denied.length, 0); // 確認中は不要
  const three = [stmt(1, "2026-03"), stmt(2, "2025-03"), stmt(3, "2024-03")];
  const ok = mergeWrite(base(), { files: three, checks: [chk()] }, "011", "employee", c);
  assert.equal(ok.denied.length, 0); assert.deepEqual(ok.state.checks[0].periods, ["2026-03", "2025-03", "2024-03"]);
  const dup = mergeWrite(base(), { files: [stmt(4, "2026-03"), stmt(5, "2026-03"), stmt(6, "2025-03")], checks: [chk()] }, "011", "employee", c); // 同じ期は1期と数える
  assert.ok(dup.denied.includes("checks"));
  assert.ok(mergeWrite(base(), { files: [stmt(7, "2026-03", { clientCode: "C900", dept: "製造部" })] }, "011", "employee", c).denied.includes("files")); // 他事業部の関与先
  assert.ok(mergeWrite(base(), { files: [stmt(8, "令和7年")] }, "011", "employee", c).denied.includes("files")); // 決算期の形式
});

test("備品注文: 依頼は自分の名義・自事業部で。承認〜納品は管理者のみ、取消は依頼者（依頼中のみ）も可。番号と履歴はサーバーが付ける", () => {
  const ord = (over: Record<string, unknown> = {}) => ({ id: "o1", no: "", category: "名刺", vendor: "トータル企画", item: "名刺100枚", qty: 1, dept: "営業部", requesterId: "011", status: "依頼中", history: [], at: "x", ...over });
  const r = mergeWrite(base(), { orders: [ord()] }, "011", "employee", ctx);
  assert.equal(r.denied.length, 0); assert.equal(r.state.orders[0].no, "ORD-2026-0001"); assert.equal(r.state.orders[0].history[0].at, NOW);
  assert.ok(mergeWrite(base(), { orders: [ord({ requesterId: "010" })] }, "011", "employee", ctx).denied.includes("orders")); // なりすまし
  assert.ok(mergeWrite(base(), { orders: [ord({ dept: "製造部" })] }, "011", "employee", ctx).denied.includes("orders")); // 他事業部名義
  assert.ok(mergeWrite(base(), { orders: [ord({ status: "発注済" })] }, "011", "employee", ctx).denied.includes("orders")); // いきなり発注済
  assert.ok(mergeWrite(base(), { orders: [ord({ qty: 0 })] }, "011", "employee", ctx).denied.includes("orders"));
  const st = r.state;
  assert.ok(mergeWrite(st, { orders: [{ ...st.orders[0], status: "承認済" }] }, "011", "employee", ctx).denied.includes("orders")); // 依頼者は承認できない
  const ap = mergeWrite(st, { orders: [{ ...st.orders[0], status: "承認済" }] }, "003", "admin", ctx);
  assert.equal(ap.denied.length, 0); assert.equal(ap.state.orders[0].history.at(-1).by, "003");
  assert.ok(mergeWrite(ap.state, { orders: [{ ...ap.state.orders[0], status: "依頼中" }] }, "003", "admin", ctx).denied.includes("orders")); // 戻せない
  assert.equal(mergeWrite(st, { orders: [{ ...st.orders[0], status: "取消" }] }, "011", "employee", ctx).denied.length, 0); // 依頼者の取消
  assert.ok(mergeWrite(ap.state, { orders: [{ ...ap.state.orders[0], status: "取消" }] }, "011", "employee", ctx).denied.includes("orders")); // 承認後は依頼者は取消不可
  assert.ok(mergeWrite(st, { orders: [{ ...st.orders[0], item: "改ざん" }] }, "011", "employee", ctx).denied.includes("orders"));
  const seen = sanitizeForRead({ ...st, employees: emps }, "020", "employee");
  assert.equal(seen!.orders.length, 0); // 他事業部の注文は見えない
});

test("予定: 自分の名義で登録・鍵と事業部の公開範囲・会議室の重複予約を拒否・他人の予定は変更不可", () => {
  const rooms = [{ id: "room-a", name: "会議室A" }];
  const b = (over = {}) => base({ rooms, sched: [], ...over });
  const sc = (over: Record<string, unknown> = {}) => ({ id: "S1", title: "A社 商談", date: "2026-10-05", start: "10:00", end: "11:00", ownerId: "011", attendees: ["010"], kind: "商談", vis: "全社", note: "見積の件", at: "x", ...over });
  const r = mergeWrite(b(), { sched: [sc()] }, "011", "employee", ctx);
  assert.equal(r.denied.length, 0); assert.equal(r.state.sched[0].at, NOW);
  assert.ok(mergeWrite(b(), { sched: [sc({ ownerId: "010" })] }, "011", "employee", ctx).denied.includes("sched")); // なりすまし
  assert.ok(mergeWrite(b(), { sched: [sc({ start: "11:00", end: "10:00" })] }, "011", "employee", ctx).denied.includes("sched"));
  assert.ok(mergeWrite(b(), { sched: [sc({ attendees: ["999"] })] }, "011", "employee", ctx).denied.includes("sched"));
  // 公開範囲
  const lock = mergeWrite(b(), { sched: [sc({ vis: "鍵", attendees: ["010"] })] }, "011", "employee", ctx).state;
  const seen = (uid: string, role: string) => sanitizeForRead({ ...lock, employees: emps }, uid, role as never)!.sched[0];
  assert.equal(seen("011", "employee").title, "A社 商談"); // 本人
  assert.equal(seen("010", "employee").title, "A社 商談"); // 招待した参加者
  const other = seen("020", "employee"); // 他の人：時間帯だけ
  assert.equal(other.title, "予定あり"); assert.equal(other.note, undefined); assert.deepEqual(other.attendees, []); assert.equal(other.start, "10:00");
  assert.equal(seen("003", "admin").title, "予定あり"); // 管理者でも鍵は見えない
  assert.equal(seen("002", "executive").title, "予定あり");
  const dv = mergeWrite(b(), { sched: [sc({ vis: "事業部" })] }, "011", "employee", ctx).state;
  const sd = (uid: string, role: string) => sanitizeForRead({ ...dv, employees: emps }, uid, role as never)!.sched[0].title;
  assert.equal(sd("010", "employee"), "A社 商談"); assert.equal(sd("020", "employee"), "予定あり"); assert.equal(sd("002", "executive"), "A社 商談");
  // 他人の予定は変更・削除できない（見えていても）
  assert.ok(mergeWrite(lock, { sched: [{ ...lock.sched[0], title: "改ざん" }] }, "020", "employee", ctx).denied.includes("sched"));
  assert.ok(mergeWrite(lock, { schedDel: ["S1"] }, "020", "employee", ctx).denied.includes("sched"));
  assert.equal(mergeWrite(lock, { schedDel: ["S1"] }, "011", "employee", ctx).state.sched.length, 0);
  // 見えている形（予定あり）をそのまま送り返しても壊れない
  assert.equal(mergeWrite(lock, { sched: [other] }, "020", "employee", ctx).denied.length, 0);
  // 会議室の二重予約
  const room1 = mergeWrite(b(), { sched: [sc({ roomId: "room-a" })] }, "011", "employee", ctx).state;
  assert.ok(mergeWrite(room1, { sched: [sc({ id: "S2", ownerId: "020", attendees: [], roomId: "room-a", start: "10:30", end: "11:30" })] }, "020", "employee", ctx).denied.includes("sched"));
  assert.equal(mergeWrite(room1, { sched: [sc({ id: "S2", ownerId: "020", attendees: [], roomId: "room-a", start: "11:00", end: "12:00" })] }, "020", "employee", ctx).denied.length, 0); // 隣り合う時間はOK
  assert.ok(mergeWrite(b(), { sched: [sc({ roomId: "room-x" })] }, "011", "employee", ctx).denied.includes("sched")); // 存在しない会議室
});
