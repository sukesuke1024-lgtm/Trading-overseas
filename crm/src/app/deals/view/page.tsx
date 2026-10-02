"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, GitBranch, Plus, Receipt, Trash2 } from "lucide-react";
import { deleteDeal, openQuickLog, updateDeal, useMe, useStore, addTask, setDealLines } from "@/lib/store";
import { dealJPY, permsFor } from "@/lib/selectors";
import { OPEN_STAGES, PRODUCTS, STAGES, flag, segmentLabel, stageOf } from "@/lib/constants";
import { fmtDate, relativeDays } from "@/lib/dates";
import { money, yenShort } from "@/lib/format";
import { rateNow } from "@/lib/fx";
import type { Currency, Data, Deal, DealLine, Incoterm, PayTerm } from "@/lib/types";
import { Avatar, Empty, Field, PageHeader, StageChip, stageColor } from "@/components/ui";
import { NextActionBox, Timeline, useStageMove } from "@/components/forms";
import { TaskRow } from "@/components/TaskRow";
import { Suspended } from "@/components/Suspended";

export default function Page() { return <Suspended><DealView /></Suspended>; }

function DealView() {
  const id = useSearchParams().get("id");
  const d = useStore().data!;
  const me = useMe()!;
  const router = useRouter();
  const perms = permsFor(me);
  const { move, modal } = useStageMove();
  const [newTask, setNewTask] = useState("");
  const x = d.deals.find((y) => y.id === id);
  if (!x) return <div className="py-20 text-center text-ink-2">案件が見つかりません。<Link className="link ml-2" href="/deals/">案件一覧へ</Link></div>;

  const org = d.organizations.find((o) => o.id === x.orgId);
  const contacts = d.contacts.filter((c) => c.orgId === x.orgId);
  const editable = perms.canEdit(x.ownerId);
  const st = stageOf(x.stage);
  const acts = d.activities.filter((a) => a.dealId === x.id).sort((a, b) => b.at.localeCompare(a.at));
  const tasks = d.tasks.filter((t) => t.dealId === x.id && !t.isNextAction).sort((a, b) => (a.status === b.status ? (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9") : a.status === "done" ? 1 : -1));
  const idx = OPEN_STAGES.findIndex((s) => s.id === x.stage);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader back={{ href: "/deals/", label: "案件一覧" }}
        title={<span className="flex flex-wrap items-center gap-3">{x.name}<StageChip stage={x.stage} /></span>}
        sub={<Link href={`/customers/view/?id=${x.orgId}`} className="inline-flex items-center gap-1.5 hover:text-accent-2"><Building2 size={13} />{flag(org?.country ?? "")} {org?.name}</Link>}
        actions={<>
          <button className="btn btn-primary" onClick={() => openQuickLog({ orgId: x.orgId, dealId: x.id, contactId: x.contactId ?? undefined })}><Plus size={15} />活動を記録</button>
          {perms.canDelete && <button className="btn btn-danger" onClick={() => { if (confirm("この案件と関連Taskを削除します。よろしいですか？")) { deleteDeal(x.id); router.push("/deals/"); } }}><Trash2 size={14} /></button>}
        </>} />

      {/* ステージ：クリックで移動 */}
      <div className="card mb-5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {OPEN_STAGES.map((s, i) => {
              const on = s.id === x.stage, past = idx >= 0 && i < idx;
              return (
                <button key={s.id} disabled={!editable} onClick={() => move(x.id, s.id)} title={s.hint}
                  className={`relative flex h-9 min-w-[96px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold transition ${on ? "text-white" : past ? "text-ink-2" : "text-ink-3 hover:bg-surface-2"} disabled:cursor-default`}
                  style={on ? { background: stageColor(s.id) } : past ? { background: `color-mix(in srgb, ${stageColor(s.id)} 14%, transparent)` } : undefined}>
                  {past && <Check size={13} />}{s.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 border-l border-line pl-2">
            <button disabled={!editable} onClick={() => move(x.id, "won")} className={`btn btn-sm ${x.stage === "won" ? "!bg-good !text-white" : ""}`}>受注</button>
            <button disabled={!editable} onClick={() => move(x.id, "lost")} className={`btn btn-sm ${x.stage === "lost" ? "!bg-bad !text-white" : ""}`}>失注</button>
            <button disabled={!editable} onClick={() => move(x.id, "hold")} className={`btn btn-sm ${x.stage === "hold" ? "!bg-surface-3" : ""}`}>保留</button>
          </div>
        </div>
        {st.kind === "lost" && <p className="mt-2 px-1 text-[12.5px] text-bad">失注理由：{x.lostReason}</p>}
        {!editable && <p className="mt-2 px-1 text-[12px] text-ink-3">この案件の担当は {d.users.find((u) => u.id === x.ownerId)?.name} さんです。編集は担当者または Manager 以上のみ可能です。</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <NextActionBox key={x.id + x.stage} d={d} deal={x} editable={editable} />

          <LinesCard d={d} deal={x} editable={editable} />

          <section className="card">
            <div className="card-h"><h2 className="card-t">活動履歴<span className="ml-2 text-xs font-normal text-ink-3">{acts.length}件</span></h2></div>
            <div className="px-5 pb-4 pt-4">
              <Timeline d={d} items={acts} showDeal={false} />
            </div>
          </section>

          <section className="card">
            <div className="card-h"><h2 className="card-t">その他の Task</h2></div>
            <div className="mt-2 divide-y divide-line">
              {tasks.map((t) => <TaskRow key={t.id} d={d} t={t} editable={editable} />)}
              {tasks.length === 0 && <Empty title="Task はありません" />}
            </div>
            {editable && (
              <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (!newTask.trim()) return; addTask({ title: newTask.trim(), type: "other", orgId: x.orgId, dealId: x.id, contactId: null, assigneeId: x.ownerId, dueDate: null, isNextAction: false }); setNewTask(""); }}>
                <input className="input" placeholder="Task を追加（Enter）" value={newTask} onChange={(e) => setNewTask(e.target.value)} /><button className="btn" type="submit">追加</button>
              </form>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="card p-4">
            <h2 className="card-t mb-3">案件情報</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <Field label={x.lines.length ? "金額（明細の合計）" : "金額"}><input className="input num" inputMode="numeric" disabled={!editable || x.lines.length > 0} defaultValue={x.amount.toLocaleString()} key={x.amount} onBlur={(e) => { const n = Number(e.target.value.replace(/[^\d.]/g, "")); if (!Number.isNaN(n) && n !== x.amount) updateDeal(x.id, { amount: n }); }} /></Field>
                <Field label="通貨"><select className="select" disabled={!editable} value={x.currency} onChange={(e) => updateDeal(x.id, { currency: e.target.value as Currency })}>{["JPY", "USD", "SGD", "HKD", "EUR", "AUD", "THB"].map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <div className="text-xs text-ink-3">円換算：<span className="num font-semibold text-ink">{yenShort(dealJPY(x))}</span>（{money(x.amount, x.currency)}・デモ為替）</div>
              {st.kind === "open" && (
                <Field label={`確度：${x.probability}%`}><input type="range" min={0} max={100} step={5} disabled={!editable} value={x.probability} onChange={(e) => updateDeal(x.id, { probability: Number(e.target.value) })} className="w-full accent-[var(--accent-2)]" /></Field>
              )}
              <Field label="予定受注日"><input type="date" className="input" disabled={!editable} value={x.expectedCloseDate ?? ""} onChange={(e) => updateDeal(x.id, { expectedCloseDate: e.target.value || null })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="担当営業"><select className="select" disabled={!perms.isManager} value={x.ownerId} onChange={(e) => updateDeal(x.id, { ownerId: e.target.value })}>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
                <Field label="担当者"><select className="select" disabled={!editable} value={x.contactId ?? ""} onChange={(e) => updateDeal(x.id, { contactId: e.target.value || null })}><option value="">（未設定）</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="決済条件"><select className="select" disabled={!editable} value={x.payTerm} onChange={(e) => updateDeal(x.id, { payTerm: e.target.value as PayTerm })}>{PAY_TERMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="貿易条件"><select className="select" disabled={!editable} value={x.incoterm} onChange={(e) => updateDeal(x.id, { incoterm: e.target.value as Incoterm })}><option value="">（未設定）</option>{["EXW", "FOB", "CFR", "CIF", "DAP", "DDP"].map((v) => <option key={v}>{v}</option>)}</select></Field>
              </div>
              <Field label="商材"><select className="select" disabled={!editable} value={x.product} onChange={(e) => updateDeal(x.id, { product: e.target.value })}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="メモ（自動保存）"><textarea className="textarea" rows={4} disabled={!editable} defaultValue={x.memo} key={x.id} onBlur={(e) => { if (e.target.value !== x.memo) updateDeal(x.id, { memo: e.target.value }); }} /></Field>
              <p className="text-[11px] text-ink-3">作成 {fmtDate(x.createdAt, true)}／ステージ変更 {relativeDays(x.stageChangedAt)}</p>
            </div>
          </section>

          <DecisionCard deal={x} />
          <SaleCard d={d} deal={x} canSee={perms.isManager} />

          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="card-t">顧客</h2><Link href={`/customers/view/?id=${x.orgId}`} className="text-xs text-accent-2 hover:underline">Customer 360° →</Link></div>
            <div className="text-[13.5px] font-semibold">{flag(org?.country ?? "")} {org?.name}</div>
            <div className="text-xs text-ink-3">{org?.city}・{org ? segmentLabel(org.segment) : ""}</div>
            <ul className="mt-3 space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2">
                  <Avatar user={{ name: c.name, hue: (c.name.charCodeAt(0) * 7) % 360 }} size={26} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{c.name}{c.id === x.contactId && <span className="chip chip-accent ml-1.5">この案件の窓口</span>}</div><div className="truncate text-[11px] text-ink-3">{c.title}</div></div>
                  {c.isDecisionMaker && <span className="chip chip-warn">決裁者</span>}
                </li>
              ))}
            </ul>
          </section>
          <p className="px-1 text-[11px] text-ink-3">ステージ一覧：{STAGES.filter((s) => s.kind === "open").map((s) => s.label).join(" → ")} → 受注／失注／保留</p>
        </aside>
      </div>
      {modal}
    </div>
  );
}

const PAY_TERMS: [PayTerm, string][] = [["", "（未設定）"], ["advance", "前払い（T/T 全額）"], ["partial", "一部前払い"], ["lc", "L/C（信用状）"], ["dp", "D/P"], ["da", "D/A"], ["oa", "O/A（後払い）"]];

/** 明細：カタログの商品 × 数量 × 単価。案件金額は明細の合計になり、受注すると売上・仕訳に同額で引き継がれる */
function LinesCard({ d, deal, editable }: { d: Data; deal: Deal; editable: boolean }) {
  const [pid, setPid] = useState("");
  const set = (lines: DealLine[]) => setDealLines(deal.id, lines);
  const upd = (id: string, patch: Partial<DealLine>) => set(deal.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = () => {
    const p = d.products.find((y) => y.id === pid);
    if (!p) return;
    // 単価はカタログの標準価格（USD）を案件の通貨に換算（この時点の値が明細に固定される）
    const unitPrice = deal.currency === "JPY" ? Math.round(p.costJPY * 1.3) : Math.round(((p.priceUSD * rateNow("USD")) / rateNow(deal.currency)) * 100) / 100;
    set([...deal.lines, { id: `ln${Date.now().toString(36)}`, productId: p.id, name: p.name, qty: p.moq, unit: p.unit, unitPrice }]);
    setPid("");
  };
  return (
    <section className="card">
      <div className="card-h"><h2 className="card-t">明細（商品・数量・単価）<span className="ml-2 text-xs font-normal text-ink-3">案件金額は明細の合計です</span></h2></div>
      <div className="overflow-x-auto px-1 pb-1 pt-2">
        <table className="tbl min-w-[560px]"><thead><tr><th>商品</th><th className="text-right">数量</th><th className="text-right">単価（{deal.currency}）</th><th className="text-right">金額</th><th /></tr></thead>
          <tbody>
            {deal.lines.map((l) => (
              <tr key={l.id}><td className="min-w-[200px]">{l.name}<span className="ml-1.5 text-[11px] text-ink-3">／{l.unit}</span></td>
                <td className="w-[110px]"><input className="inline num text-right" inputMode="decimal" disabled={!editable} defaultValue={l.qty} key={`q${l.qty}`} onBlur={(e) => { const n = Number(e.target.value.replace(/,/g, "")); if (n > 0 && n !== l.qty) upd(l.id, { qty: n }); }} /></td>
                <td className="w-[120px]"><input className="inline num text-right" inputMode="decimal" disabled={!editable} defaultValue={l.unitPrice} key={`p${l.unitPrice}`} onBlur={(e) => { const n = Number(e.target.value.replace(/,/g, "")); if (n >= 0 && n !== l.unitPrice) upd(l.id, { unitPrice: n }); }} /></td>
                <td className="num text-right font-semibold">{money(Math.round(l.qty * l.unitPrice * 100) / 100, deal.currency)}</td>
                <td className="w-8 text-right">{editable && <button className="text-ink-3 hover:text-bad" aria-label="削除" onClick={() => set(deal.lines.filter((y) => y.id !== l.id))}><Trash2 size={13} /></button>}</td></tr>
            ))}
            {deal.lines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[12.5px] text-ink-3">明細がありません。商品を追加すると、金額が自動で計算され、受注時の売上・仕訳に同額で引き継がれます（現在の金額：{money(deal.amount, deal.currency)}）。</td></tr>}
            {deal.lines.length > 0 && <tr><td colSpan={3} className="text-right font-bold">合計（案件金額）</td><td className="num text-right text-[14px] font-bold">{money(deal.amount, deal.currency)}</td><td /></tr>}
          </tbody></table>
      </div>
      {editable && <div className="flex gap-2 border-t border-line p-3"><select className="select" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">カタログから商品を追加…</option>{d.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}（{p.unit}）</option>)}</select><button className="btn" disabled={!pid} onClick={add}>追加</button><Link href="/calculator/" className="btn btn-ghost">見積を計算 →</Link></div>}
    </section>
  );
}

const DECISION_STYLE = { go: "bg-good-soft text-good", conditional: "bg-warn-soft text-warn", stop: "bg-bad-soft text-bad", hold: "bg-surface-3 text-ink-2" } as const;
function DecisionCard({ deal }: { deal: Deal }) {
  const dc = deal.decision;
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between"><h2 className="card-t inline-flex items-center gap-1.5"><GitBranch size={14} />契約可否の判定</h2><Link href={`/decision/?deal=${deal.id}`} className="text-xs text-accent-2 hover:underline">{dc ? "やり直す" : "判定する"} →</Link></div>
      {dc ? (
        <div className="space-y-2"><div className={`rounded-lg px-3 py-2 text-[13px] font-bold ${DECISION_STYLE[dc.result]}`}>{dc.label}</div>
          {dc.conditions.length > 0 && <ul className="space-y-1 text-[12px] text-ink-2">{dc.conditions.map((c) => <li key={c}>・{c}</li>)}</ul>}
          <p className="text-[11px] text-ink-3">{fmtDate(dc.at, true)} 判定</p></div>
      ) : <p className="text-[12.5px] text-ink-3">契約前に、決済条件・保証・規制・粗利から「進む／撤退」を判定できます。</p>}
    </section>
  );
}

function SaleCard({ d, deal, canSee }: { d: Data; deal: Deal; canSee: boolean }) {
  const sale = d.sales.find((s) => s.dealId === deal.id);
  const fw = d.forwards.filter((f) => f.dealId === deal.id && f.status === "open");
  if (!sale && fw.length === 0) return null;
  return (
    <section className="card space-y-2 p-4 text-[12.5px]">
      {sale && <div><h2 className="card-t mb-1 inline-flex items-center gap-1.5"><Receipt size={14} />売上</h2><div className="num font-semibold">{sale.no}　{money(sale.amount, sale.currency)} ＝ {yenShort(sale.amountJPY)}</div><div className="text-ink-3">計上レート {sale.rate}／{sale.status === "入金済" ? `入金済 ${fmtDate(sale.paidDate)}` : "未入金"}{canSee && <> ・ <Link className="text-accent-2 hover:underline" href="/accounting/">仕訳を確認</Link></>}</div></div>}
      {fw.length > 0 && <div><h2 className="card-t mb-1">為替予約</h2>{fw.map((f) => <div key={f.id} className="num">{money(f.amount, f.currency)} @ {f.rate}（{fmtDate(f.settleDate)}）</div>)}<Link href="/fx/" className="text-accent-2 hover:underline">為替予約を見る →</Link></div>}
    </section>
  );
}
