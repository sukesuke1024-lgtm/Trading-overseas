"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, Plus, Trash2 } from "lucide-react";
import { deleteDeal, openQuickLog, updateDeal, useMe, useStore, addTask } from "@/lib/store";
import { dealJPY, permsFor } from "@/lib/selectors";
import { OPEN_STAGES, PRODUCTS, STAGES, flag, segmentLabel, stageOf } from "@/lib/constants";
import { fmtDate, relativeDays } from "@/lib/dates";
import { money, yenShort } from "@/lib/format";
import type { Currency } from "@/lib/types";
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

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <NextActionBox key={x.id + x.stage} d={d} deal={x} editable={editable} />

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

        <aside className="space-y-5">
          <section className="card p-4">
            <h2 className="card-t mb-3">案件情報</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <Field label="金額"><input className="input num" inputMode="numeric" disabled={!editable} defaultValue={x.amount.toLocaleString()} key={x.amount} onBlur={(e) => { const n = Number(e.target.value.replace(/[^\d.]/g, "")); if (!Number.isNaN(n) && n !== x.amount) updateDeal(x.id, { amount: n }); }} /></Field>
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
              <Field label="商材"><select className="select" disabled={!editable} value={x.product} onChange={(e) => updateDeal(x.id, { product: e.target.value })}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="メモ（自動保存）"><textarea className="textarea" rows={4} disabled={!editable} defaultValue={x.memo} key={x.id} onBlur={(e) => { if (e.target.value !== x.memo) updateDeal(x.id, { memo: e.target.value }); }} /></Field>
              <p className="text-[11px] text-ink-3">作成 {fmtDate(x.createdAt, true)}／ステージ変更 {relativeDays(x.stageChangedAt)}</p>
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="card-t">顧客</h2><Link href={`/customers/view/?id=${x.orgId}`} className="text-xs text-accent-2 hover:underline">Customer 360° →</Link></div>
            <div className="text-[13.5px] font-semibold">{flag(org?.country ?? "")} {org?.name}</div>
            <div className="text-xs text-ink-3">{org?.city}・{org ? segmentLabel(org.segment) : ""}</div>
            <ul className="mt-3 space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2">
                  <Avatar user={{ id: c.id, name: c.name, email: "", role: "sales", teamId: "", title: "", hue: (c.name.charCodeAt(0) * 7) % 360 }} size={26} />
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
