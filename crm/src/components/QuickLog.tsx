"use client";
import { useMemo, useState } from "react";
import { closeQuickLog, addActivity, setNextAction, useMe, useQuickLog, useStore } from "@/lib/store";
import { ACTIVITY_TYPES, flag, isOpen } from "@/lib/constants";
import { addDays, fmtDate, todayStr } from "@/lib/dates";
import type { ActivityType } from "@/lib/types";
import { ActivityIcon, Drawer, Field } from "./ui";
import { nextActionOf } from "@/lib/selectors";

const QUICK_DUE = [{ l: "明日", n: 1 }, { l: "3日後", n: 3 }, { l: "1週間後", n: 7 }, { l: "2週間後", n: 14 }];

/** 活動の記録と次の一手（Next Action）を1枚で入力。営業が入力を嫌がらないよう、必須は「顧客」と「内容」のみ。 */
export function QuickLog() {
  const q = useQuickLog();
  const s = useStore();
  const me = useMe();
  if (!q.open || !s.data || !me) return null;
  return <Form key={`${q.orgId}-${q.dealId}-${q.contactId}`} preset={q} />;
}

function Form({ preset }: { preset: { orgId?: string; dealId?: string; contactId?: string } }) {
  const d = useStore().data!;
  const [type, setType] = useState<ActivityType>("call");
  const [orgId, setOrgId] = useState(preset.orgId ?? "");
  const [dealId, setDealId] = useState(preset.dealId ?? "");
  const [contactId, setContactId] = useState(preset.contactId ?? "");
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const [naTitle, setNaTitle] = useState("");
  const [naDue, setNaDue] = useState<string>(addDays(todayStr(), 3));
  const [naType, setNaType] = useState<ActivityType>("email");

  const orgs = useMemo(() => [...d.organizations].sort((a, b) => a.name.localeCompare(b.name)), [d.organizations]);
  const deals = d.deals.filter((x) => x.orgId === orgId && isOpen(x.stage));
  const contacts = d.contacts.filter((c) => c.orgId === orgId);
  const existingNA = dealId ? nextActionOf(d, dealId) : undefined;

  const valid = !!orgId && summary.trim().length > 0;
  const save = () => {
    if (!valid) return;
    addActivity({ type, orgId, contactId: contactId || null, dealId: dealId || null, summary: summary.trim(), note: note.trim() });
    if (dealId && naTitle.trim()) setNextAction(dealId, { title: naTitle.trim(), type: naType, due: naDue || null });
    closeQuickLog();
  };

  return (
    <Drawer open onClose={closeQuickLog} title="活動を記録"
      footer={<><button className="btn" onClick={closeQuickLog}>キャンセル</button><button className="btn btn-primary" disabled={!valid} onClick={save}>記録する</button></>}>
      <div className="space-y-4">
        <div>
          <span className="label">種別</span>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} aria-pressed={type === t.id}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium ${type === t.id ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}>
                <ActivityIcon type={t.id} size={13} />{t.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="顧客 *">
          <select className="select" value={orgId} onChange={(e) => { setOrgId(e.target.value); setDealId(""); setContactId(""); }}>
            <option value="">選択してください</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{flag(o.country)} {o.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="案件"><select className="select" value={dealId} disabled={!orgId} onChange={(e) => { const v = e.target.value; setDealId(v); const x = d.deals.find((y) => y.id === v); if (x?.contactId && !contactId) setContactId(x.contactId); }}><option value="">（案件なし）</option>{deals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="担当者"><select className="select" value={contactId} disabled={!orgId} onChange={(e) => setContactId(e.target.value)}><option value="">（指定なし）</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <Field label="内容（1行で）*"><input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="例：価格条件の最終打合せ（Online）" /></Field>
        <Field label="メモ"><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="先方の反応・決まったこと・懸念点" /></Field>

        {dealId && (
          <div className="rounded-xl bg-accent-soft p-3.5">
            <div className="mb-2 text-[12.5px] font-bold text-accent">次の一手（Next Action）</div>
            {existingNA && <p className="mb-2 text-[11.5px] text-ink-2">現在：{existingNA.title}（{fmtDate(existingNA.dueDate)}）— 入力すると置き換わります</p>}
            <input className="input" value={naTitle} onChange={(e) => setNaTitle(e.target.value)} placeholder="例：見積書を送付し、回答期限を確認する" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {QUICK_DUE.map((x) => (
                <button key={x.n} type="button" onClick={() => setNaDue(addDays(todayStr(), x.n))} className={`h-7 rounded-md px-2 text-[12px] font-medium ${naDue === addDays(todayStr(), x.n) ? "bg-accent text-accent-ink" : "bg-surface text-ink-2 hover:bg-surface-3"}`}>{x.l}</button>
              ))}
              <input type="date" className="input !h-7 !w-auto !text-xs" value={naDue} onChange={(e) => setNaDue(e.target.value)} />
              <select className="select !h-7 !w-auto !text-xs" value={naType} onChange={(e) => setNaType(e.target.value as ActivityType)}>{ACTIVITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
