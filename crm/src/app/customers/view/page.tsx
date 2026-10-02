"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Crown, ExternalLink, Mail, MapPin, Phone, Plus, Star, Trash2 } from "lucide-react";
import { deleteOrg, openQuickLog, updateContact, updateOrg, useMe, useStore } from "@/lib/store";
import { dealJPY, lastContactOf, nextActionOf, nextScheduledOf, permsFor, daysSince } from "@/lib/selectors";
import { COUNTRIES, SEGMENTS, SOURCES, ACTIVITY_TYPES, flag, isOpen, segmentLabel } from "@/lib/constants";
import { relativeDays } from "@/lib/dates";
import { money, yenShort } from "@/lib/format";
import { Avatar, DueChip, Empty, Field, PageHeader, StageChip } from "@/components/ui";
import { NewContactDrawer, NewDealDrawer, Timeline } from "@/components/forms";
import { TaskRow } from "@/components/TaskRow";
import { Suspended } from "@/components/Suspended";
import type { ActivityType } from "@/lib/types";

export default function Page() { return <Suspended><C360 /></Suspended>; }

/** Customer 360°：会社・担当者・進行案件・過去案件・Next Action・Task・Activity timeline・Memo を1画面に集約 */
function C360() {
  const id = useSearchParams().get("id");
  const d = useStore().data!;
  const me = useMe()!;
  const router = useRouter();
  const perms = permsFor(me);
  const [tab, setTab] = useState<ActivityType | "all">("all");
  const [addDeal, setAddDeal] = useState(false);
  const [addContact, setAddContact] = useState(false);
  const org = d.organizations.find((o) => o.id === id);
  if (!org) return <div className="py-20 text-center text-ink-2">顧客が見つかりません。<Link className="link ml-2" href="/customers/">顧客一覧へ</Link></div>;

  const editable = perms.canEdit(org.ownerId);
  const contacts = d.contacts.filter((c) => c.orgId === org.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const deals = d.deals.filter((x) => x.orgId === org.id);
  const open = deals.filter((x) => isOpen(x.stage) || x.stage === "hold");
  const past = deals.filter((x) => !isOpen(x.stage) && x.stage !== "hold");
  const acts = d.activities.filter((a) => a.orgId === org.id && (tab === "all" || a.type === tab)).sort((a, b) => b.at.localeCompare(a.at));
  const tasks = d.tasks.filter((t) => t.orgId === org.id && t.status === "open").sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const last = lastContactOf(d, org.id);
  const next = nextScheduledOf(d, org.id);
  const owner = d.users.find((u) => u.id === org.ownerId);
  const openJPY = open.reduce((a, x) => a + dealJPY(x), 0);
  const wonJPY = past.filter((x) => x.stage === "won").reduce((a, x) => a + dealJPY(x), 0);
  const ds = daysSince(last);
  const set = (patch: Partial<typeof org>) => updateOrg(org.id, patch);

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader back={{ href: "/customers/", label: "顧客一覧" }}
        title={<span className="flex flex-wrap items-center gap-3"><span>{flag(org.country)} {org.name}</span><span className="chip chip-accent">{segmentLabel(org.segment)}</span></span>}
        sub={<span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><MapPin size={13} />{org.city}、{org.country}</span>{org.url && <a href={org.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-accent-2"><ExternalLink size={12} />Web</a>}<span className="inline-flex items-center gap-1.5"><Avatar user={owner} size={16} />担当：{owner?.name}</span></span>}
        actions={<>
          <button className="btn" onClick={() => setAddDeal(true)}><Plus size={14} />案件</button>
          <button className="btn btn-primary" onClick={() => openQuickLog({ orgId: org.id })}><Plus size={15} />活動を記録</button>
          {perms.canDelete && <button className="btn btn-danger" aria-label="削除" onClick={() => { if (confirm(`${org.name} と関連する担当者・案件・活動・Task をすべて削除します。よろしいですか？`)) { deleteOrg(org.id); router.push("/customers/"); } }}><Trash2 size={14} /></button>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="進行中の案件" value={yenShort(openJPY)} sub={`${open.length}件`} />
        <Stat label="受注実績（累計）" value={yenShort(wonJPY)} sub={`${past.filter((x) => x.stage === "won").length}件`} />
        <Stat label="最終接触" value={last ? relativeDays(last) : "なし"} tone={ds !== null && ds >= 30 ? "warn" : undefined} sub={ds !== null && ds >= 30 ? "30日以上あいています" : undefined} />
        <Stat label="次回予定" value={next ? <DueChip due={next.dueDate} /> : <span className="text-bad">未設定</span>} sub={next?.title} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr_330px]">
        {/* 左：進行案件・Task */}
        <div className="space-y-5 xl:order-1">
          <section className="card">
            <div className="card-h"><h2 className="card-t">進行中の案件</h2></div>
            <ul className="mt-2 space-y-2 p-3 pt-1">
              {open.map((x) => { const na = nextActionOf(d, x.id); return (
                <li key={x.id}><Link href={`/deals/view/?id=${x.id}`} className="block rounded-xl bg-surface-2 p-3 transition hover:bg-surface-3">
                  <div className="flex items-start justify-between gap-2"><span className="text-[13px] font-semibold leading-snug">{x.name}</span><StageChip stage={x.stage} /></div>
                  <div className="num mt-1 text-[13px] font-bold">{money(x.amount, x.currency)}<span className="ml-1.5 text-[11px] font-normal text-ink-3">{x.probability}%</span></div>
                  <div className={`mt-2 flex items-center gap-2 text-[11.5px] ${na ? "text-ink-2" : "font-semibold text-bad"}`}>{na ? <><DueChip due={na.dueDate} /><span className="line-clamp-1">{na.title}</span></> : "Next Action 未設定"}</div>
                </Link></li>); })}
              {open.length === 0 && <Empty title="進行中の案件はありません" action={<button className="btn btn-sm" onClick={() => setAddDeal(true)}><Plus size={13} />案件を追加</button>} />}
            </ul>
          </section>
          <section className="card">
            <div className="card-h"><h2 className="card-t">Task<span className="ml-2 text-xs font-normal text-ink-3">{tasks.length}件</span></h2></div>
            <div className="mt-1 divide-y divide-line pb-1">
              {tasks.map((t) => <TaskRow key={t.id} d={d} t={t} editable={perms.canEdit(t.assigneeId)} />)}
              {tasks.length === 0 && <Empty title="未完了の Task はありません" />}
            </div>
          </section>
          <section className="card">
            <div className="card-h"><h2 className="card-t">過去の案件</h2></div>
            <ul className="mt-1 divide-y divide-line pb-1">
              {past.map((x) => <li key={x.id}><Link href={`/deals/view/?id=${x.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-2/60"><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{x.name}</span>{x.stage === "lost" && <span className="block text-[11px] text-bad">{x.lostReason}</span>}</span><span className="num text-[12px] text-ink-2">{yenShort(dealJPY(x))}</span><StageChip stage={x.stage} /></Link></li>)}
              {past.length === 0 && <li className="px-4 py-6 text-center text-xs text-ink-3">過去の案件はありません</li>}
            </ul>
          </section>
        </div>

        {/* 中央：Activity timeline */}
        <section className="card xl:order-2">
          <div className="card-h flex-wrap"><h2 className="card-t">活動履歴<span className="ml-2 text-xs font-normal text-ink-3">{acts.length}件</span></h2>
            <select className="select !h-7 !w-auto !text-xs" value={tab} onChange={(e) => setTab(e.target.value as ActivityType | "all")}><option value="all">すべての種別</option>{ACTIVITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div className="p-5 pt-5"><Timeline d={d} items={acts} /></div>
        </section>

        {/* 右：担当者・会社情報・メモ */}
        <div className="space-y-5 xl:order-3">
          <section className="card">
            <div className="card-h"><h2 className="card-t">担当者</h2><button className="btn btn-sm btn-ghost" onClick={() => setAddContact(true)}><Plus size={13} />追加</button></div>
            <ul className="mt-2 space-y-2 p-3 pt-1">
              {contacts.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar user={{ id: c.id, name: c.name, email: "", role: "sales", teamId: "", title: "", hue: (c.name.charCodeAt(0) * 7) % 360 }} size={30} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{c.name}</div><div className="truncate text-[11.5px] text-ink-3">{[c.department, c.title].filter(Boolean).join("・")}</div></div>
                    <div className="flex gap-0.5">
                      <button title="主要連絡先" disabled={!editable} onClick={() => updateContact(c.id, { isPrimary: !c.isPrimary })} className={`grid h-6 w-6 place-items-center rounded-md ${c.isPrimary ? "text-accent-2" : "text-ink-3/50 hover:text-ink-2"}`}><Star size={14} fill={c.isPrimary ? "currentColor" : "none"} /></button>
                      <button title="意思決定者" disabled={!editable} onClick={() => updateContact(c.id, { isDecisionMaker: !c.isDecisionMaker })} className={`grid h-6 w-6 place-items-center rounded-md ${c.isDecisionMaker ? "text-warn" : "text-ink-3/50 hover:text-ink-2"}`}><Crown size={14} fill={c.isDecisionMaker ? "currentColor" : "none"} /></button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[12px] text-ink-2">
                    {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-accent-2"><Mail size={12} />{c.email}</a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-accent-2"><Phone size={12} />{c.phone}</a>}
                  </div>
                  {c.note && <p className="mt-1.5 text-[11.5px] text-ink-3">{c.note}</p>}
                  <button className="mt-2 text-[11.5px] font-medium text-accent-2 hover:underline" onClick={() => openQuickLog({ orgId: org.id, contactId: c.id })}>この担当者との活動を記録</button>
                </li>
              ))}
              {contacts.length === 0 && <Empty title="担当者が未登録です" />}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="card-t mb-3">会社情報</h2>
            <div className="space-y-3">
              <Field label="会社名"><input className="input" disabled={!editable} defaultValue={org.name} key={org.name} onBlur={(e) => e.target.value.trim() && e.target.value !== org.name && set({ name: e.target.value.trim() })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="国"><select className="select" disabled={!editable} value={org.country} onChange={(e) => set({ country: e.target.value })}>{COUNTRIES.map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}</select></Field>
                <Field label="都市"><input className="input" disabled={!editable} defaultValue={org.city} key={org.city} onBlur={(e) => e.target.value !== org.city && set({ city: e.target.value })} /></Field>
              </div>
              <Field label="Web サイト"><input className="input" disabled={!editable} defaultValue={org.url} key={org.url} onBlur={(e) => e.target.value !== org.url && set({ url: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="区分"><select className="select" disabled={!editable} value={org.segment} onChange={(e) => set({ segment: e.target.value as never })}>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
                <Field label="獲得経路"><select className="select" disabled={!editable} value={org.source} onChange={(e) => set({ source: e.target.value as never })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              </div>
              <Field label="業種"><input className="input" disabled={!editable} defaultValue={org.industry} key={org.industry} onBlur={(e) => e.target.value !== org.industry && set({ industry: e.target.value })} /></Field>
              <Field label="担当営業"><select className="select" disabled={!perms.isManager} value={org.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="メモ（自動保存）"><textarea className="textarea" rows={5} disabled={!editable} defaultValue={org.memo} key={org.id} onBlur={(e) => e.target.value !== org.memo && set({ memo: e.target.value })} /></Field>
            </div>
          </section>
        </div>
      </div>
      <NewDealDrawer key={"d" + addDeal} d={d} open={addDeal} onClose={() => setAddDeal(false)} presetOrgId={org.id} onCreated={(i) => router.push(`/deals/view/?id=${i}`)} />
      <NewContactDrawer key={"c" + addContact} d={d} open={addContact} onClose={() => setAddContact(false)} presetOrgId={org.id} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "warn" }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className={`mt-1.5 text-[22px] font-bold leading-none num ${tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      <div className="mt-1.5 h-4 truncate text-[11.5px] text-ink-3">{sub}</div>
    </div>
  );
}
