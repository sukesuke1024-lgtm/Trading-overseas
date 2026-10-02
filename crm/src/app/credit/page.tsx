"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Lock, Printer, ShieldAlert, XCircle } from "lucide-react";
import { decideCreditReview, deleteCreditReview, saveCreditReview, setCreditPolicy, useMe, useStore } from "@/lib/store";
import { COUNTRY_RANK_LABEL, DEFAULT_POLICY, EMPTY_INPUT, PAY_LABEL, evaluate, rankOf, termMatrix, usage, type CountryRank, type CreditInput, type PayKey, type Policy, type Rating } from "@/lib/credit";
import { creditUsage, exposureOf, permsFor, reviewOf } from "@/lib/selectors";
import { flag } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { yen, yenShort } from "@/lib/format";
import type { CreditReview, Data, Organization } from "@/lib/types";
import { Avatar, Field, PageHeader, Segmented } from "@/components/ui";
import { Suspended } from "@/components/Suspended";
import { RatingBadge } from "@/components/RatingBadge";

export default function Page() { return <Suspended><Credit /></Suspended>; }

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));
const man = (n: number | null) => (n === null ? "" : String(Math.round(n / 10000)));

type Tab = "list" | "review" | "matrix" | "policy" | "guide";

/** 与信管理：取引先の信用力を、誰が見ても同じ結論になる透明な方法で評価し、限度額・決済条件・必要な保全を決める */
function Credit() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(sp.get("org") ? "review" : "list");
  const [orgId, setOrgId] = useState(sp.get("org") ?? "");

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader title="与信管理" sub="取引先の信用力を、財務・信用情報・取引実績・コンプライアンスから点数化し、限度額・決済条件・必要な保全を決めます。どの項目が点数に効いたかが見えるので、結論の理由が説明できます。"
        actions={<Segmented value={tab} onChange={setTab} options={[{ id: "list", label: "審査一覧" }, { id: "review", label: "審査する" }, { id: "matrix", label: "条件マトリクス" }, { id: "policy", label: "方針" }, { id: "guide", label: "考え方・情報源" }]} />} />
      {tab === "list" && <List d={d} onOpen={(id) => { setOrgId(id); setTab("review"); }} />}
      {tab === "review" && <Review key={orgId} d={d} orgId={orgId} setOrgId={setOrgId} me={me} canApprove={perms.isManager} />}
      {tab === "matrix" && <Matrix />}
      {tab === "policy" && <PolicyTab d={d} canEdit={perms.isAdmin} />}
      {tab === "guide" && <Guide />}
    </div>
  );
}

function List({ d, onOpen }: { d: Data; onOpen: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = d.organizations.map((o) => { const rv = reviewOf(d, o.id); const cu = creditUsage(d, o.id); const open = d.deals.filter((x) => x.orgId === o.id && x.stage !== "won" && x.stage !== "lost" && x.stage !== "hold").length; return { o, rv, cu, open }; })
    .sort((a, b) => Number(!!b.rv) - Number(!!a.rv) || b.open - a.open);
  const alerts = rows.filter((r) => (!r.rv && r.open > 0) || (r.rv && r.rv.status === "approved" && r.rv.validUntil < today) || r.cu.usage.level === "over");
  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <section className="rounded-xl bg-bad-soft p-4"><h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-bad"><ShieldAlert size={15} />要対応 {alerts.length}件</h2>
          <ul className="space-y-1.5 text-[12.5px]">{alerts.map(({ o, rv, cu, open }) => <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2"><button className="font-semibold hover:text-accent-2" onClick={() => onOpen(o.id)}>{flag(o.country)} {o.name}</button>
            {!rv && open > 0 && <span className="chip chip-bad">与信審査なしで進行中の案件 {open}件</span>}
            {rv && rv.status === "approved" && rv.validUntil < today && <span className="chip chip-bad">審査の期限切れ（{fmtDate(rv.validUntil, true)}）</span>}
            {cu.usage.level === "over" && <span className="chip chip-bad">限度額を超過（売掛金 {yenShort(cu.usage.confirmed)}／限度 {yenShort(cu.review?.result.totalLimitJPY ?? 0)}）</span>}</li>)}</ul></section>
      )}
      <section className="card overflow-x-auto">
        <table className="tbl min-w-[1000px]"><thead><tr><th>顧客</th><th>国リスク</th><th className="text-center">格付け</th><th className="text-right">点数</th><th className="text-right">限度額（保全込み）</th><th>使用状況（売掛金）</th><th>状態</th><th>再審査期限</th></tr></thead>
          <tbody>{rows.map(({ o, rv, cu }) => { const approved = rv?.status === "approved"; const exp = approved && rv!.validUntil < today; const u = cu.usage; return (
            <tr key={o.id} className="cursor-pointer" onClick={() => onOpen(o.id)}>
              <td className="max-w-[260px] truncate font-semibold">{flag(o.country)} {o.name}</td>
              <td className="text-ink-2">{rv ? rv.input.countryRank : rankOf(o.country)}</td>
              <td className="text-center"><RatingBadge r={rv?.result.rating ?? null} /></td>
              <td className="num text-right">{rv ? `${rv.result.score}` : "—"}{rv && <span className="ml-1 text-[11px] text-ink-3">／情報{rv.result.completeness}%</span>}</td>
              <td className="num text-right font-semibold">{rv ? yenShort(rv.result.totalLimitJPY) : "—"}</td>
              <td className="min-w-[180px]">{rv && approved && !exp ? <div><div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(u.rate * 100))}%`, background: u.level === "over" ? "#c0362c" : u.level === "warn" || u.level === "future-over" ? "#c47a1c" : "#17784a" }} /></div><div className="mt-0.5 text-[11px] text-ink-3 num">{yenShort(u.confirmed)}（{Math.round(u.rate * 100)}%）{u.level === "future-over" && <span className="ml-1 text-warn">見込み込みで超過</span>}</div></div> : <span className="text-ink-3">—</span>}</td>
              <td>{!rv ? <span className="chip chip-warn">未審査</span> : exp ? <span className="chip chip-bad">期限切れ</span> : rv.status === "approved" ? <span className="chip chip-good">承認済み</span> : rv.status === "submitted" ? <span className="chip chip-accent">承認待ち</span> : rv.status === "rejected" ? <span className="chip chip-bad">否認</span> : <span className="chip">下書き</span>}</td>
              <td className="num text-[12px] text-ink-2">{rv ? fmtDate(rv.validUntil, true) : "—"}</td></tr>); })}</tbody></table>
      </section>
      <p className="px-1 text-[11.5px] text-ink-3">格付けは S（最良）〜 D、重大な懸念（制裁・反社の該当など）は NG（取引不可）。承認済みで期限内の審査だけが、限度額・使用状況として有効です。</p>
    </div>
  );
}

function Review({ d, orgId, setOrgId, me, canApprove }: { d: Data; orgId: string; setOrgId: (id: string) => void; me: Data["users"][number]; canApprove: boolean }) {
  const org: Organization | undefined = d.organizations.find((o) => o.id === orgId);
  const existing = org ? reviewOf(d, org.id) : undefined;
  const [input, setInput] = useState<CreditInput>(() => existing?.input ?? { ...EMPTY_INPUT, countryRank: org ? rankOf(org.country) : "C" });
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [decideNote, setDecideNote] = useState("");
  const [saved, setSaved] = useState("");
  const policy = d.creditPolicy ?? DEFAULT_POLICY;
  const r = useMemo(() => evaluate(input, policy), [input, policy]);
  const expo = org ? exposureOf(d, org.id) : { arJPY: 0, pipelineJPY: 0 };
  const u = usage(r.totalLimitJPY, expo);
  const terms = termMatrix(r.rating, input.countryRank);
  const set = <K extends keyof CreditInput>(k: K, v: CreditInput[K]) => { setInput((x) => ({ ...x, [k]: v })); setSaved(""); };
  const sc = org?.screening;

  if (!org) return (
    <section className="card p-6"><h2 className="card-t mb-3">審査する顧客を選ぶ</h2>
      <select className="select !w-auto min-w-[320px]" value="" onChange={(e) => setOrgId(e.target.value)}><option value="">顧客を選択…</option>{d.organizations.map((o) => <option key={o.id} value={o.id}>{flag(o.country)} {o.name}</option>)}</select></section>
  );

  const numField = (k: keyof CreditInput, label: string, unit: string, hint?: string) => (
    <Field label={`${label}${unit ? `（${unit}）` : ""}`} hint={hint}><input className="input num" inputMode="decimal" placeholder="不明" defaultValue={(input[k] as number | null) ?? ""} onBlur={(e) => set(k, num(e.target.value) as never)} /></Field>
  );
  const manField = (k: "netWorthJPY" | "annualRevenueJPY", label: string) => (
    <Field label={`${label}（万円・円換算）`}><input className="input num" inputMode="decimal" placeholder="不明" defaultValue={man(input[k])} onBlur={(e) => { const n = num(e.target.value); set(k, n === null ? null : n * 10000); }} /></Field>
  );
  const sel = <K extends keyof CreditInput>(k: K, label: string, opts: [string, string][], hint?: string) => (
    <Field label={label} hint={hint}><select className="select" value={String(input[k] ?? "")} onChange={(e) => set(k, (e.target.value === "" ? null : isNaN(Number(e.target.value)) || ["notDone", "none"].includes(e.target.value) ? e.target.value : Number(e.target.value)) as never)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1"><div className="text-[11px] text-ink-3">審査する顧客</div><div className="truncate text-[16px] font-bold">{flag(org.country)} {org.name}</div></div>
          <select className="select !w-auto max-w-[240px]" value={org.id} onChange={(e) => setOrgId(e.target.value)} aria-label="顧客を変更">{d.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <Link href={`/customers/view/?id=${org.id}`} className="btn btn-sm">Customer 360° →</Link>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="card-t">1. 財務（決算書・信用調査レポートから。わかる範囲で）</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {numField("equityRatio", "自己資本比率", "%")}{numField("currentRatio", "流動比率", "%")}{numField("ordinaryMargin", "売上高経常利益率", "%")}
            {numField("revenueGrowth", "売上成長率", "%")}{numField("debtToSalesMonths", "有利子負債（月商倍率）", "か月", "有利子負債 ÷ 月商")}{manField("netWorthJPY", "純資産")}{manField("annualRevenueJPY", "年商")}
          </div>
          <p className="text-[11.5px] text-ink-3">空欄は「不明」として中立の点数になり、<b>情報充足度</b>が下がります（情報が足りないまま高い格付けにはなりません）。</p>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="card-t">2. 信用情報・取引実績</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {sel("paymentRecord", "他社への支払実績", [["unknown", "不明"], ["excellent", "非常に良好"], ["good", "良好"], ["slow", "遅れがち"], ["delinquent", "延滞あり"]], "調査会社のレポート等")}
            {numField("externalScore", "外部調査の評点", "0〜100", "調査会社の評点を100点満点に換算")}{numField("yearsInBusiness", "業歴", "年")}
            {sel("history", "当社との取引実績", [["none", "なし（初回）"], ["under1", "1年未満"], ["1to3", "1〜3年"], ["over3", "3年以上"]])}
            {sel("management", "経営者・体制（5が良い）", [["", "不明"], ["5", "5"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]])}
            {sel("industryRisk", "業種リスク（1が低い）", [["", "不明"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]])}
          </div>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="card-t">3. コンプライアンス・国</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="商業登記等で実在・代表者を確認"><select className="select" value={input.registryVerified ? "1" : "0"} onChange={(e) => set("registryVerified", e.target.value === "1")}><option value="0">未確認</option><option value="1">確認済み</option></select></Field>
            <Field label="実質的支配者（UBO）を確認"><select className="select" value={input.ownerVerified ? "1" : "0"} onChange={(e) => set("ownerVerified", e.target.value === "1")}><option value="0">未確認</option><option value="1">確認済み</option></select></Field>
            {sel("sanctions", "制裁リスト照会", [["notDone", "未実施"], ["clear", "該当なし"], ["hit", "該当あり"]])}
            {sel("antiSocial", "反社・不正関与の確認", [["notDone", "未実施"], ["clear", "該当なし"], ["hit", "該当あり"]])}
            {sel("adverseNews", "訴訟・不祥事の報道", [["notChecked", "未確認"], ["none", "なし"], ["minor", "軽微なものあり"], ["serious", "重大なものあり"]])}
            <Field label="国別リスク（社内ランク）"><select className="select" value={input.countryRank} onChange={(e) => set("countryRank", e.target.value as CountryRank)}>{(Object.keys(COUNTRY_RANK_LABEL) as CountryRank[]).map((k) => <option key={k} value={k}>{COUNTRY_RANK_LABEL[k]}</option>)}</select></Field>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-[12px]">
            <div className="flex flex-wrap items-center gap-2"><b>制裁リスト照会（最新）：</b>{sc ? <><span className={`chip ${sc.result === "clear" ? "chip-good" : "chip-bad"}`}>{sc.result === "clear" ? "該当なし" : sc.result === "hit" ? "該当の疑い" : "類似あり"}</span><span className="text-ink-3">{fmtDate(sc.at.slice(0, 10), true)}・データ {sc.dataDate ? fmtDate(sc.dataDate.slice(0, 10), true) : "—"}</span></> : <span className="text-ink-3">未実施</span>}<Link href={`/screening/?org=${org.id}`} className="ml-auto text-accent-2 hover:underline">制裁照会へ →</Link></div>
            <p className="mt-1.5 text-ink-3">国別リスクの初期値は社内の暫定ランクです。NEXI の国カテゴリー・OECD の国別リスク分類・外務省の海外安全情報で最新の状況を確認し、見直してください。</p>
          </div>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="card-t">4. 保全（保険・保証・前払い）</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="貿易保険の付保額（万円）"><input className="input num" inputMode="decimal" defaultValue={man(input.insuredJPY || null)} placeholder="0" onBlur={(e) => set("insuredJPY", (num(e.target.value) ?? 0) * 10000)} /></Field>
            <Field label="付保率（%）"><input className="input num" inputMode="decimal" defaultValue={input.insuredRate} onBlur={(e) => set("insuredRate", num(e.target.value) ?? 90)} /></Field>
            <Field label="その他の保全額（万円）" hint="前払い・確認付L/C・保証など"><input className="input num" inputMode="decimal" defaultValue={man(input.securedJPY || null)} placeholder="0" onBlur={(e) => set("securedJPY", (num(e.target.value) ?? 0) * 10000)} /></Field>
          </div>
          <Field label="審査のコメント（根拠・条件・確認した資料）"><textarea className="textarea" rows={3} value={comment} onChange={(e) => { setComment(e.target.value); setSaved(""); }} placeholder="例：決算書（直近2期）と信用調査レポートを確認。L/C を基本とし、実績に応じて見直す。" /></Field>
        </section>
      </div>

      <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start">
        <section className="card p-5">
          <div className="flex items-center gap-4">
            <RatingBadge r={r.rating} size="lg" />
            <div className="min-w-0 flex-1"><div className="text-[11px] text-ink-3">社内格付け</div><div className="num text-[22px] font-bold leading-tight">{r.score}<span className="text-[13px] font-normal text-ink-3"> / {r.max}点</span></div><div className="text-[12px] text-ink-2">情報充足度 <b className={r.completeness < policy.minCompleteness ? "text-warn" : ""}>{r.completeness}%</b>{r.rating !== r.ratingBeforeCap && <span className="ml-2 text-ink-3">（点数だけなら {r.ratingBeforeCap}）</span>}</div></div>
          </div>
          {r.stops.map((s) => <p key={s} className="mt-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] font-semibold text-bad"><XCircle size={15} className="mt-0.5 shrink-0" />{s}</p>)}
          {r.notes.map((s) => <p key={s} className="mt-2 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{s}</p>)}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">信用供与の限度（無保全）</div><div className="num text-[17px] font-bold">{yen(r.limitJPY)}</div></div>
            <div className="rounded-xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">保険・保全でカバーする額</div><div className="num text-[17px] font-bold">{yen(r.coveredJPY)}</div></div>
            <div className="col-span-2 rounded-xl bg-accent-soft p-3"><div className="text-[11px] text-ink-3">合計の限度額</div><div className="num text-[22px] font-bold">{yen(r.totalLimitJPY)}</div><div className="mt-0.5 text-[11.5px] text-ink-2">算出根拠：{r.limitBasis}（国別係数 ×{policy.countryFactor[input.countryRank]}）</div></div>
          </div>
          <div className="mt-3 text-[12px] text-ink-2">現在の使用：売掛金 <b className="num">{yen(expo.arJPY)}</b>＋見込み案件（確度50%以上・加重）<b className="num"> {yen(expo.pipelineJPY)}</b> → 限度に対し <b className={u.level === "over" ? "text-bad" : ""}>{Number.isFinite(u.rate) ? Math.round(u.rate * 100) : "—"}%</b>
            {u.level === "future-over" && <span className="ml-1 text-warn">（見込み案件を含めると超過）</span>}</div>
          <div className="mt-2 text-[12px] text-ink-2">想定デフォルト率（暫定）<b className="num"> {r.pd}%</b> → <b>期待損失率 {r.expectedLossRate}%</b>（価格に織り込む目安）</div>
          {r.needsApproval && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2">限度額が {yen(policy.approvalAboveJPY)} 以上のため、役員（Manager 以上）の承認が必要です。</p>}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3"><h2 className="card-t">点数の内訳（なぜこの格付けか）</h2></div>
          <table className="tbl"><tbody>{(["財務", "信用情報", "取引・属性", "コンプライアンス"] as const).map((g) => (<>
            <tr key={g}><td colSpan={3} className="bg-surface-2 !py-1.5 text-[11.5px] font-bold text-ink-2">{g}　{r.items.filter((x) => x.group === g).reduce((a, x) => a + x.points, 0).toFixed(1)} / {r.items.filter((x) => x.group === g).reduce((a, x) => a + x.max, 0)}</td></tr>
            {r.items.filter((x) => x.group === g).map((x) => <tr key={x.key}><td className="!py-1.5 text-[12.5px]">{x.label}{!x.known && <span className="chip chip-warn ml-1.5">不明</span>}</td><td className="!py-1.5 text-[11.5px] text-ink-3">{x.reason}</td><td className="num !py-1.5 text-right text-[12.5px]"><span className={x.points / x.max < 0.4 ? "font-semibold text-bad" : ""}>{x.points.toFixed(1)}</span><span className="text-ink-3">/{x.max}</span></td></tr>)}</>))}</tbody></table>
          {r.missing.length > 0 && <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3"><b>不足している情報：</b>{r.missing.join("、")}</p>}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3"><h2 className="card-t">この格付け・国で許容できる決済条件</h2></div>
          <ul className="divide-y divide-line">{(Object.keys(PAY_LABEL) as PayKey[]).map((k) => { const t = terms[k]; return <li key={k} className="flex items-start gap-3 px-4 py-2.5"><span className={`chip mt-0.5 w-[56px] justify-center ${t.status === "ok" ? "chip-good" : t.status === "cond" ? "chip-warn" : "chip-bad"}`}>{t.status === "ok" ? "可" : t.status === "cond" ? "条件付き" : "不可"}</span><div className="min-w-0"><div className="text-[13px] font-semibold">{PAY_LABEL[k]}</div><div className="text-[12px] text-ink-2">{t.need}</div></div></li>; })}</ul>
        </section>

        <section className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => { saveCreditReview(org.id, input, comment, false); setSaved("下書きを保存しました"); }}>下書き保存</button>
            <button className="btn btn-primary" onClick={() => { saveCreditReview(org.id, input, comment, true); setSaved("承認待ちとして申請しました"); }}>承認を申請</button>
            <button className="btn" onClick={() => window.print()}><Printer size={14} />審査書を印刷／PDF</button>
            {saved && <span role="status" className="text-xs text-good">{saved}</span>}
          </div>
          {existing && <div className="rounded-xl bg-surface-2 p-3 text-[12.5px]">
            <div className="mb-1 flex flex-wrap items-center gap-2"><b>現在の状態：</b>{existing.status === "approved" ? <span className="chip chip-good">承認済み</span> : existing.status === "submitted" ? <span className="chip chip-accent">承認待ち</span> : existing.status === "rejected" ? <span className="chip chip-bad">否認</span> : <span className="chip">下書き</span>}<span className="text-ink-3">再審査期限 {fmtDate(existing.validUntil, true)}</span></div>
            {existing.approverId && <div className="flex items-center gap-1.5 text-ink-2"><Avatar user={d.users.find((x) => x.id === existing.approverId)} size={16} />{d.users.find((x) => x.id === existing.approverId)?.name}（{existing.decidedAt ? fmtDate(existing.decidedAt.slice(0, 10), true) : ""}）</div>}
            {canApprove && existing.status === "submitted" && <div className="mt-2 space-y-2"><input className="input" placeholder="承認・否認のコメント" value={decideNote} onChange={(e) => setDecideNote(e.target.value)} /><div className="flex gap-2"><button className="btn btn-primary" onClick={() => decideCreditReview(existing.id, true, decideNote)}><CheckCircle2 size={14} />承認する</button><button className="btn btn-danger" onClick={() => decideCreditReview(existing.id, false, decideNote)}>否認する</button></div></div>}
            {!canApprove && existing.status === "submitted" && <p className="mt-1 text-ink-3">Manager 以上が承認します。</p>}
            {canApprove && <button className="mt-2 text-[11.5px] text-ink-3 hover:text-bad" onClick={() => { if (confirm("この審査を削除しますか？")) deleteCreditReview(existing.id); }}>この審査を削除</button>}
          </div>}
          <ShareSheet org={org} r={r} input={input} existing={existing} me={me.name} />
        </section>
      </div>
    </div>
  );
}

/** 生産者と共有する『取引リスクの説明書』（金額の詳細や社内の限度は載せない）。印刷／PDF保存で使う */
function ShareSheet({ org, r, input, existing, me }: { org: Organization; r: ReturnType<typeof evaluate>; input: CreditInput; existing?: CreditReview; me: string }) {
  const [open, setOpen] = useState(false);
  const terms = termMatrix(r.rating, input.countryRank);
  const ok = (Object.keys(PAY_LABEL) as PayKey[]).filter((k) => terms[k].status !== "ng");
  return (
    <div>
      <button className="text-[12px] font-medium text-accent-2 hover:underline" onClick={() => setOpen((v) => !v)}>{open ? "▾" : "▸"} 生産者に説明するための『取引リスクの説明書』を表示</button>
      {open && (
        <div className="mt-2 rounded-xl border border-line-strong bg-surface p-4 text-[12.5px] leading-relaxed" id="share-sheet">
          <div className="mb-2 flex items-center justify-between"><b className="text-[14px]">取引リスクの説明書（生産者向け）</b><button className="btn btn-sm no-print" onClick={() => window.print()}><Printer size={12} />印刷／PDF</button></div>
          <p className="text-ink-2">H-LINK は、海外のお取引先との契約前に、信用力・国のリスク・制裁などの確認を行い、代金回収のリスクを下げる条件で取引します。今回のお取引先の確認結果は次のとおりです。</p>
          <table className="tbl mt-2"><tbody>
            <tr><td className="w-[140px] font-semibold">お取引先</td><td>{org.name}（{org.country}）</td></tr>
            <tr><td className="font-semibold">社内の確認結果</td><td>{r.rating === "NG" ? "取引不可" : `格付け ${r.rating}（S〜Dの5段階。Sが最良）`}／{existing?.status === "approved" ? `承認済み（${fmtDate(existing.decidedAt?.slice(0, 10) ?? null, true)}）` : "審査中"}</td></tr>
            <tr><td className="font-semibold">確認した項目</td><td>実在の確認：{input.registryVerified ? "済" : "未"}／実質的支配者：{input.ownerVerified ? "済" : "未"}／制裁リスト：{input.sanctions === "clear" ? "該当なし" : input.sanctions === "hit" ? "該当あり" : "未実施"}／決算・支払実績：{r.completeness}%確認</td></tr>
            <tr><td className="font-semibold">代金の受け取り方</td><td>{ok.length ? ok.map((k) => `${PAY_LABEL[k]}${terms[k].status === "cond" ? "（条件付き）" : ""}`).join("、") : "取引しません"}</td></tr>
            <tr><td className="font-semibold">守りの手当て</td><td>{[input.insuredJPY > 0 ? "貿易保険の付保" : "", "出荷前の書類確認", terms.lc.status !== "ng" ? "L/C（確認付き）の活用" : "", terms.partial.status !== "ng" ? "前払いの一部受領" : ""].filter(Boolean).join("、")}</td></tr>
          </tbody></table>
          <p className="mt-2 text-[11.5px] text-ink-3">作成：{me}（{fmtDate(new Date().toISOString().slice(0, 10), true)}）。財務の詳細・社内の限度額は記載していません。この説明書は、お取引の安全性を共有するための参考情報で、代金の支払いを保証するものではありません。</p>
        </div>
      )}
    </div>
  );
}

function Matrix() {
  const [country, setCountry] = useState<CountryRank>("A");
  const ratings: Rating[] = ["S", "A", "B", "C", "D"];
  const keys = Object.keys(PAY_LABEL) as PayKey[];
  return (
    <section className="card overflow-x-auto">
      <div className="card-h flex-wrap"><h2 className="card-t">格付け × 決済条件マトリクス</h2><label className="flex items-center gap-2 text-[12.5px]">国別リスク<select className="select !h-8 !w-auto" value={country} onChange={(e) => setCountry(e.target.value as CountryRank)}>{(Object.keys(COUNTRY_RANK_LABEL) as CountryRank[]).map((k) => <option key={k} value={k}>{COUNTRY_RANK_LABEL[k]}</option>)}</select></label></div>
      <table className="tbl mt-2 min-w-[900px]"><thead><tr><th>決済条件</th>{ratings.map((r) => <th key={r} className="text-center"><RatingBadge r={r} /></th>)}</tr></thead>
        <tbody>{keys.map((k) => (<tr key={k}><td className="w-[170px] font-semibold">{PAY_LABEL[k]}</td>{ratings.map((r) => { const t = termMatrix(r, country)[k]; return <td key={r} className="align-top"><span className={`chip ${t.status === "ok" ? "chip-good" : t.status === "cond" ? "chip-warn" : "chip-bad"}`}>{t.status === "ok" ? "可" : t.status === "cond" ? "条件付き" : "不可"}</span><div className="mt-1 text-[11.5px] leading-snug text-ink-2">{t.need}</div></td>; })}</tr>))}</tbody></table>
      <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">国別リスクが D・E の場合は、後払い系の条件を 1〜2 段階厳しくしています（L/C は日本の銀行の確認付きが前提）。これは社内の暫定ルールです。実績と審査会での判断に基づいて見直してください。</p>
    </section>
  );
}

function PolicyTab({ d, canEdit }: { d: Data; canEdit: boolean }) {
  const p = d.creditPolicy ?? DEFAULT_POLICY;
  const [draft, setDraft] = useState<Policy>(p);
  const [msg, setMsg] = useState("");
  if (!canEdit) return <section className="card p-6 text-[13px] text-ink-2"><Lock className="mb-2 text-ink-3" />与信方針の変更は Admin が行います。現在の方針は次のとおりです。<PolicyView p={p} /></section>;
  const setN = (path: string, v: number) => { const x = JSON.parse(JSON.stringify(draft)) as Policy; const [a, b] = path.split("."); if (b) (x as unknown as Record<string, Record<string, number>>)[a][b] = v; else (x as unknown as Record<string, number>)[a] = v; setDraft(x); setMsg(""); };
  const f = (path: string, label: string, v: number, step = 1) => <Field key={path} label={label}><input className="input num" type="number" step={step} value={v} onChange={(e) => setN(path, Number(e.target.value))} /></Field>;
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="card-t mb-3">格付けの境界（100点満点の割合）</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{(["S", "A", "B", "C"] as const).map((r) => f(`ratingMin.${r}`, `${r} になる下限（点）`, draft.ratingMin[r]))}</div>
        <h2 className="card-t mb-3 mt-5">限度額の計算</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{(["S", "A", "B", "C", "D"] as const).map((r) => f(`netWorthRatio.${r}`, `純資産に対する割合：${r}`, draft.netWorthRatio[r], 0.01))}{(["S", "A", "B", "C", "D"] as const).map((r) => f(`revenueMonths.${r}`, `月商の何か月分：${r}`, draft.revenueMonths[r], 0.5))}{(["S", "A", "B", "C", "D"] as const).map((r) => f(`floorLimitJPY.${r}`, `財務不明時の最低枠（円）：${r}`, draft.floorLimitJPY[r], 100000))}</div>
        <h2 className="card-t mb-3 mt-5">国別係数・想定デフォルト率・運用</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{(["A", "B", "C", "D", "E"] as const).map((r) => f(`countryFactor.${r}`, `国別係数：${r}`, draft.countryFactor[r], 0.05))}{(["S", "A", "B", "C", "D"] as const).map((r) => f(`pd.${r}`, `想定デフォルト率（%）：${r}`, draft.pd[r], 0.1))}{f("approvalAboveJPY", "役員承認が必要な限度額（円）", draft.approvalAboveJPY, 1000000)}{f("reviewMonths", "再審査の期限（か月）", draft.reviewMonths)}{f("minCompleteness", "情報充足度の下限（%）", draft.minCompleteness)}</div>
        <div className="mt-4 flex items-center gap-3"><button className="btn btn-primary" onClick={() => { setCreditPolicy(draft); setMsg("方針を更新しました（以降の審査・再計算に反映）"); }}>方針を保存</button><button className="btn" onClick={() => { setDraft(DEFAULT_POLICY); setMsg(""); }}>初期値に戻す</button>{msg && <span role="status" className="text-xs text-good">{msg}</span>}</div>
      </section>
      <p className="px-1 text-[11.5px] text-ink-3">これらの数値は、公的な統計ではなく社内の暫定ルールです。自社の回収実績（延滞・貸倒れ）を蓄積し、四半期ごとに審査会で見直してください。変更は監査ログに残ります。</p>
    </div>
  );
}
function PolicyView({ p }: { p: Policy }) {
  return <table className="tbl mt-3"><tbody>{[["格付けの下限（点）", `S ${p.ratingMin.S} / A ${p.ratingMin.A} / B ${p.ratingMin.B} / C ${p.ratingMin.C}`], ["純資産に対する限度の割合", (["S", "A", "B", "C", "D"] as const).map((r) => `${r} ${p.netWorthRatio[r] * 100}%`).join(" / ")], ["月商の何か月分まで", (["S", "A", "B", "C", "D"] as const).map((r) => `${r} ${p.revenueMonths[r]}`).join(" / ")], ["国別係数", (["A", "B", "C", "D", "E"] as const).map((r) => `${r} ×${p.countryFactor[r]}`).join(" / ")], ["役員承認が必要な限度額", yen(p.approvalAboveJPY)], ["再審査の期限", `${p.reviewMonths}か月`]].map(([a, b]) => <tr key={a}><td className="w-[200px] font-semibold">{a}</td><td>{b}</td></tr>)}</tbody></table>;
}

const SOURCES: [string, string, string][] = [
  ["財務・支払実績", "信用調査会社（帝国データバンク・東京商工リサーチ・Dun & Bradstreet・Creditsafe など）のレポート", "有料。取引先の財務・支払状況・評点・代表者・沿革を確認する、最も基本の情報源"],
  ["実在・代表者・株主", "現地の商業登記（各国の登記所・企業登記のオンライン検索）／取引先から取り寄せる登記簿・定款", "実在と代表者の確認（原本または公的サイトの写し）。実質的支配者（UBO）の申告書も取る"],
  ["保険・保証", "日本貿易保険（NEXI）／民間の取引信用保険会社", "付保できるか・付保率・事故通知期限を確認。海外商社の信用情報サービスもある"],
  ["国の事情", "NEXI の国カテゴリー／OECD の国別リスク分類／外務省 海外安全情報／JETRO の国・地域別情報", "国別リスクの見直しと、送金・為替の制限の有無の確認"],
  ["制裁・規制", "OFAC（米国）・EU・国連・日本（外為法に基づく資産凍結等）の各リスト／経産省の該非判定（安全保障貿易管理）", "このシステムの『制裁照会』は OFAC のみ。他のリストは公式サイトで確認し、結果を記録する"],
  ["上場企業の財務", "EDINET（金融庁）の有価証券報告書・JPX の上場情報", "国内の商社・上場企業との取引では、公開された決算書を直接確認できる"],
];
function Guide() {
  return (
    <div className="space-y-5">
      <section className="card p-5 text-[13px] leading-relaxed">
        <h2 className="card-t mb-3">大手商社の与信管理の考え方（一般的な実務を、当社向けに整理）</h2>
        <p className="mb-3 text-ink-2">海外取引の信用リスクが「ブラックボックス」になる最大の理由は、<b>誰が・何を根拠に・いくらまで許したか</b>が見えないことです。大手商社や海外取引の多い企業では、次の流れで、判断を言葉と数字にして残しています。ここでは、その一般的な考え方を、当社の規模で運用できる形にしました（特定の企業の社内基準を再現するものではありません）。</p>
        <ol className="space-y-3">
          {[["入口（審査）", "取引を始める前に、取引先の財務・信用情報・実在・実質的支配者・制裁・反社を確認し、社内格付けを付ける。情報が足りないときは『足りない』と記録し、その分は高く評価しない。"], ["設定（限度と条件）", "格付けと国のリスクから、与信限度額・決済条件・必要な保全（前払い・L/C・貿易保険など）を決める。限度は『純資産の何%』『月商の何か月分』など、根拠のある基準で。"], ["実行中（モニタリング）", "売掛金が限度に対してどれだけ使われているかを常に見る。支払遅延・注文の急変・担当者の交代・報道・為替や国情の変化は、早期警戒のサイン。出荷前に限度を確認する。"], ["回収と事後", "遅延は早く督促し、追加出荷を止める。保険の事故通知期限を守る。結果（延滞・貸倒れ）を蓄積し、格付け・限度・条件の基準を定期的に見直す。"]].map(([t, b], i) => <li key={t} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">{i + 1}</span><div><b>{t}</b><div className="text-ink-2">{b}</div></div></li>)}
        </ol>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-5 text-[12.5px] leading-relaxed"><h3 className="card-t mb-2">与信の「5C」と、入力項目の対応</h3>
          <table className="tbl"><tbody>{[["Character（誠実さ）", "支払実績・報道・コンプライアンス・経営者"], ["Capacity（返済能力）", "利益率・流動比率・有利子負債"], ["Capital（資本）", "自己資本比率・純資産"], ["Collateral（保全）", "前払い・L/C・貿易保険・保証"], ["Conditions（環境）", "国別リスク・業種・景気・為替"]].map(([a, b]) => <tr key={a}><td className="w-[150px] font-semibold">{a}</td><td className="text-ink-2">{b}</td></tr>)}</tbody></table></div>
        <div className="card p-5 text-[12.5px] leading-relaxed"><h3 className="card-t mb-2">保全の優先順位（強い順）</h3>
          <ol className="list-decimal space-y-1 pl-5 text-ink-2"><li>前払い（出荷前に全額入金）</li><li>確認（コンファーム）付き L/C（日本の銀行が支払いを約束）</li><li>貿易保険・取引信用保険（付保率は一般に90%前後）</li><li>銀行保証（スタンドバイ L/C）・親会社保証</li><li>担保・売掛債権の買取（ノンリコース）</li><li>無保全（少額・実績のある相手に限る）</li></ol></div>
        <div className="card p-5 text-[12.5px] leading-relaxed"><h3 className="card-t mb-2">早期警戒サイン（出たら追加出荷を止めて確認）</h3>
          <ul className="list-disc space-y-1 pl-5 text-ink-2"><li>支払いが約束より遅れる／分割払いを求められる</li><li>注文が急に増える・減る・内容が変わる</li><li>担当者・代表者・銀行口座が突然変わる</li><li>悪い報道・訴訟・資金繰りのうわさ</li><li>国の外貨規制・為替の急変・政情不安</li></ul></div>
        <div className="card p-5 text-[12.5px] leading-relaxed"><h3 className="card-t mb-2">生産者にとっての与信</h3>
          <p className="text-ink-2">生産者は、商品を渡した後に代金が回収できないリスクを直接見ることができません。H-LINK が間に入るときは、①相手の審査結果と代金の受け取り方（前払い・L/C など）を『取引リスクの説明書』で共有し、②生産者への支払条件は、バイヤーからの入金に連動させ、③生産者側の信用（財務・供給能力・品質）も同じ方法で確認します。</p></div>
      </section>
      <section className="card overflow-x-auto"><div className="card-h"><h2 className="card-t">どこで、どの情報を取るか（情報源）</h2></div>
        <table className="tbl mt-2 min-w-[760px]"><thead><tr><th>確認すること</th><th>情報源</th><th>ポイント</th></tr></thead><tbody>{SOURCES.map(([a, b, c]) => <tr key={a}><td className="w-[130px] font-semibold">{a}</td><td className="text-[12.5px]">{b}</td><td className="text-[12px] text-ink-2">{c}</td></tr>)}</tbody></table>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 text-[12px]">{[["NEXI", "https://www.nexi.go.jp/"], ["JETRO", "https://www.jetro.go.jp/"], ["外務省 海外安全", "https://www.anzen.mofa.go.jp/"], ["経済産業省（安全保障貿易管理）", "https://www.meti.go.jp/policy/anpo/"], ["EDINET（金融庁）", "https://disclosure2.edinet-fsa.go.jp/"], ["OFAC 制裁リスト検索", "https://sanctionssearch.ofac.treas.gov/"]].map(([l, u]) => <a key={u} href={u} target="_blank" rel="noreferrer noopener" className="btn btn-sm">{l}<ExternalLink size={11} /></a>)}</div></section>
      <p className="flex items-start gap-2 px-1 text-[11.5px] text-ink-3"><Info size={13} className="mt-0.5 shrink-0" />この画面の点数・係数・想定デフォルト率は、社内の暫定ルールです（公的な統計・他社の社内基準ではありません）。実際の与信判断は、自社の回収実績と、必要に応じて取引銀行・保険会社・弁護士・税理士の助言を踏まえて行ってください。</p>
    </div>
  );
}
