"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Clock, Trash2 } from "lucide-react";
import type { ActivityType, Contact, Currency, Data, Deal, Lang, StageId } from "@/lib/types";
import { ACTIVITY_TYPES, COUNTRIES, LOST_REASONS, OPEN_STAGES, PRODUCTS, SEGMENTS, SOURCES, activityLabel, flag, stageOf } from "@/lib/constants";
import { addDays, dueInfo, fmtDateTime, relativeDays, todayStr } from "@/lib/dates";
import { addContact, addDeal, addOrg, completeTask, deleteActivity, moveStage, setNextAction, useMe } from "@/lib/store";
import { permsFor } from "@/lib/selectors";
import { ActivityIcon, Avatar, Drawer, Field, Modal } from "./ui";
import type { Activity } from "@/lib/types";

const CURRENCIES: Currency[] = ["JPY", "USD", "SGD", "HKD", "EUR", "AUD", "THB"];

export function NewDealDrawer({ d, open, onClose, presetOrgId, onCreated }: { d: Data; open: boolean; onClose: () => void; presetOrgId?: string; onCreated?: (id: string) => void }) {
  const me = useMe()!;
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState(presetOrgId ?? "");
  const [contactId, setContactId] = useState("");
  const [ownerId, setOwnerId] = useState(me.id);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [stage, setStage] = useState<StageId>("lead");
  const [close, setClose] = useState(addDays(todayStr(), 45));
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [naTitle, setNaTitle] = useState("");
  const [naDue, setNaDue] = useState(addDays(todayStr(), 3));
  const contacts = d.contacts.filter((c) => c.orgId === orgId);
  const valid = name.trim() && orgId && naTitle.trim();
  const save = () => {
    const id = addDeal({ name: name.trim(), orgId, contactId: contactId || null, ownerId, amount: Number(amount.replace(/,/g, "")) || 0, currency, stage, expectedCloseDate: close || null, product, memo: "" }, { title: naTitle.trim(), type: "email", due: naDue || null });
    onCreated?.(id);
    onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} title="案件を追加" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!valid} onClick={save}>追加する</button></>}>
      <div className="space-y-4">
        <Field label="案件名 *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：和牛A5 月次コンテナ定期輸入" /></Field>
        <Field label="顧客 *"><select className="select" value={orgId} onChange={(e) => { setOrgId(e.target.value); setContactId(""); }}><option value="">選択してください</option>{d.organizations.map((o) => <option key={o.id} value={o.id}>{flag(o.country)} {o.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="担当者"><select className="select" disabled={!orgId} value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">（未設定）</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="担当営業"><select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="金額"><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))} placeholder="0" /></Field>
          <Field label="通貨"><select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ステージ"><select className="select" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>{OPEN_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="予定受注日"><input type="date" className="input" value={close} onChange={(e) => setClose(e.target.value)} /></Field>
        </div>
        <Field label="商材"><select className="select" value={product} onChange={(e) => setProduct(e.target.value)}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div className="rounded-xl bg-accent-soft p-3.5">
          <div className="mb-2 text-[12.5px] font-bold text-accent">Next Action（必須）</div>
          <input className="input" value={naTitle} onChange={(e) => setNaTitle(e.target.value)} placeholder="例：初回の Online ミーティングを設定する" />
          <div className="mt-2 flex items-center gap-2"><span className="text-xs text-ink-2">期限</span><input type="date" className="input !h-8 !w-auto" value={naDue} onChange={(e) => setNaDue(e.target.value)} /></div>
        </div>
      </div>
    </Drawer>
  );
}

export function NewOrgDrawer({ d, open, onClose, onCreated }: { d: Data; open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const me = useMe()!;
  const [f, setF] = useState({ name: "", country: "シンガポール", city: "", url: "", segment: "importer", source: "展示会", industry: "", ownerId: me.id });
  const [cName, setCName] = useState(""); const [cEmail, setCEmail] = useState(""); const [cTitle, setCTitle] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const dup = d.organizations.find((o) => f.name.trim().length > 2 && o.name.toLowerCase().includes(f.name.trim().toLowerCase()));
  const save = () => {
    const id = addOrg({ name: f.name.trim(), country: f.country, city: f.city, address: `${f.city}, ${f.country}`, url: f.url, segment: f.segment as never, source: f.source as never, industry: f.industry, ownerId: f.ownerId, memo: "" });
    if (cName.trim()) addContact({ orgId: id, name: cName.trim(), department: "", title: cTitle, email: cEmail, phone: "", isPrimary: true, isDecisionMaker: false, note: "", optOut: false, lang: f.country === "日本" ? "ja" : "en" });
    onCreated?.(id);
    onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} title="顧客を追加" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.name.trim()} onClick={save}>追加する</button></>}>
      <div className="space-y-4">
        <Field label="会社名 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        {dup && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">似た名前の顧客が既にあります：<Link className="font-bold underline" href={`/customers/view/?id=${dup.id}`} onClick={onClose}>{dup.name}</Link>（重複登録にご注意ください）</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="国"><select className="select" value={f.country} onChange={(e) => set("country", e.target.value)}>{COUNTRIES.map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}</select></Field>
          <Field label="都市"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
        </div>
        <Field label="Web サイト"><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="区分"><select className="select" value={f.segment} onChange={(e) => set("segment", e.target.value)}>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="獲得経路"><select className="select" value={f.source} onChange={(e) => set("source", e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="業種"><input className="input" value={f.industry} onChange={(e) => set("industry", e.target.value)} placeholder="例：高級食材の輸入" /></Field>
          <Field label="担当営業"><select className="select" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <div className="rounded-xl bg-surface-2 p-3.5">
          <div className="mb-2 text-[12.5px] font-bold">主要な担当者（任意）</div>
          <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="氏名" value={cName} onChange={(e) => setCName(e.target.value)} /><input className="input" placeholder="役職" value={cTitle} onChange={(e) => setCTitle(e.target.value)} /></div>
          <input className="input mt-2" placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
        </div>
      </div>
    </Drawer>
  );
}

export function NewContactDrawer({ d, open, onClose, presetOrgId }: { d: Data; open: boolean; onClose: () => void; presetOrgId?: string }) {
  const [f, setF] = useState({ orgId: presetOrgId ?? "", name: "", department: "", title: "", email: "", phone: "", isPrimary: false, isDecisionMaker: false, note: "", optOut: false, lang: "en" as Lang });
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = () => { addContact(f as Omit<Contact, "id">); onClose(); };
  return (
    <Drawer open={open} onClose={onClose} title="担当者を追加" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.name.trim() || !f.orgId} onClick={save}>追加する</button></>}>
      <div className="space-y-4">
        <Field label="顧客 *"><select className="select" value={f.orgId} onChange={(e) => set("orgId", e.target.value)}><option value="">選択してください</option>{d.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="氏名 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="部署"><input className="input" value={f.department} onChange={(e) => set("department", e.target.value)} /></Field><Field label="役職"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Email"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field><Field label="電話"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field></div>
        <div className="flex gap-5 text-[13px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} />主要連絡先</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isDecisionMaker} onChange={(e) => set("isDecisionMaker", e.target.checked)} />意思決定者</label>
        </div>
        <Field label="備考"><textarea className="textarea" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

/** 失注理由の入力（失注は理由が必須） */
export function LostModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const final = reason === "その他" ? other.trim() : reason;
  return (
    <Modal open={open} onClose={onClose} title="失注理由を選択"
      footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!final} onClick={() => { onConfirm(final); onClose(); }}>失注にする</button></>}>
      <p className="mb-3 text-xs text-ink-2">次の提案に活かすため、理由を必ず残します。</p>
      <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      {reason === "その他" && <input className="input mt-2" autoFocus placeholder="理由を入力" value={other} onChange={(e) => setOther(e.target.value)} />}
    </Modal>
  );
}

/** ステージ変更ボタン群の共通ロジック：失注は理由モーダルを挟む */
export function useStageMove() {
  const [pending, setPending] = useState<string | null>(null);
  const move = (dealId: string, stage: StageId) => { if (stage === "lost") setPending(dealId); else moveStage(dealId, stage); };
  const modal = <LostModal open={!!pending} onClose={() => setPending(null)} onConfirm={(r) => pending && moveStage(pending, "lost", r)} />;
  return { move, modal };
}

/** 案件の Next Action 表示・編集。完了すると次の一手の入力を促す（Next Action を切らさない運用）。 */
export function NextActionBox({ d, deal, editable }: { d: Data; deal: Deal; editable: boolean }) {
  const na = d.tasks.find((t) => t.dealId === deal.id && t.isNextAction && t.status === "open");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(na?.title ?? "");
  const [due, setDue] = useState(na?.dueDate ?? addDays(todayStr(), 3));
  const [type, setType] = useState<ActivityType>(na?.type ?? "email");
  const [justDone, setJustDone] = useState(false);
  const open = stageOf(deal.stage).kind === "open" || stageOf(deal.stage).kind === "hold";
  const info = dueInfo(na?.dueDate ?? null);
  const save = () => { if (title.trim()) { setNextAction(deal.id, { title: title.trim(), type, due: due || null }); setEditing(false); setJustDone(false); } };
  const startNew = () => { setTitle(""); setDue(addDays(todayStr(), 3)); setEditing(true); };

  if (!open) return <div className="rounded-xl bg-surface-2 p-4 text-[13px] text-ink-2">この案件は{stageOf(deal.stage).label}のため、Next Action はありません。</div>;
  if (editing || (!na)) {
    return (
      <div className={`rounded-xl p-4 ${na || justDone ? "bg-accent-soft" : "bg-bad-soft"}`}>
        <div className={`mb-2 flex items-center gap-1.5 text-[12.5px] font-bold ${na || justDone ? "text-accent" : "text-bad"}`}>{justDone ? "完了しました。次の一手を設定しましょう" : na ? "Next Action を編集" : "Next Action が未設定です"}</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="次に誰へ何をする？（例：見積の回答を確認する）" disabled={!editable} autoFocus={editing} />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[{ l: "明日", n: 1 }, { l: "3日後", n: 3 }, { l: "1週間後", n: 7 }].map((x) => <button key={x.n} className="h-7 rounded-md bg-surface px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-3" onClick={() => setDue(addDays(todayStr(), x.n))} disabled={!editable}>{x.l}</button>)}
          <input type="date" className="input !h-7 !w-auto !text-xs" value={due} onChange={(e) => setDue(e.target.value)} disabled={!editable} />
          <select className="select !h-7 !w-auto !text-xs" value={type} onChange={(e) => setType(e.target.value as ActivityType)} disabled={!editable}>{ACTIVITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          <div className="flex-1" />
          {na && <button className="btn btn-sm" onClick={() => setEditing(false)}>戻る</button>}
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!editable || !title.trim()}>設定</button>
        </div>
      </div>
    );
  }
  const tone = info.tone === "overdue" ? "bg-bad-soft" : info.tone === "today" ? "bg-warn-soft" : "bg-accent-soft";
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <button disabled={!editable} onClick={() => { completeTask(na.id); setJustDone(true); startNew(); }} className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-ink-3 shadow-[0_0_0_1.5px_var(--line-strong)] hover:text-good hover:shadow-[0_0_0_1.5px_var(--good)] disabled:opacity-40" aria-label="完了にする"><Check size={14} /></button>
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-0.5">Next Action</div>
          <div className="text-[14.5px] font-semibold leading-snug">{na.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <span className={`chip num ${info.tone === "overdue" ? "chip-bad" : info.tone === "today" ? "chip-warn" : "chip-accent"}`}><Clock size={11} />{info.label}</span>
            <span className="inline-flex items-center gap-1"><ActivityIcon type={na.type} size={12} />{activityLabel(na.type)}</span>
            <span className="inline-flex items-center gap-1"><Avatar user={d.users.find((u) => u.id === na.assigneeId)} size={16} />{d.users.find((u) => u.id === na.assigneeId)?.name}</span>
          </div>
        </div>
        {editable && <button className="btn btn-sm btn-ghost" onClick={() => { setTitle(na.title); setDue(na.dueDate ?? ""); setType(na.type); setEditing(true); }}>編集</button>}
      </div>
    </div>
  );
}

export function Timeline({ d, items, showOrg = false, showDeal = true }: { d: Data; items: Activity[]; showOrg?: boolean; showDeal?: boolean }) {
  const me = useMe();
  const perms = permsFor(me);
  if (!items.length) return <p className="px-1 py-6 text-center text-[13px] text-ink-3">まだ活動がありません。右上の「活動を記録」から追加できます。</p>;
  return (
    <ol className="relative ml-3 border-l border-line">
      {items.map((a) => {
        const org = d.organizations.find((o) => o.id === a.orgId);
        const deal = d.deals.find((x) => x.id === a.dealId);
        const contact = d.contacts.find((c) => c.id === a.contactId);
        const user = d.users.find((u) => u.id === a.userId);
        return (
          <li key={a.id} className="group relative pb-5 pl-6 last:pb-1">
            <span className="absolute -left-[13px] top-0 grid h-[26px] w-[26px] place-items-center rounded-full bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line-strong)]"><ActivityIcon type={a.type} size={13} /></span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13.5px] font-semibold">{a.summary}</span>
              <span className="chip">{activityLabel(a.type)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
              <span className="num">{fmtDateTime(a.at)}（{relativeDays(a.at)}）</span>
              {user && <span className="inline-flex items-center gap-1"><Avatar user={user} size={14} />{user.name}</span>}
              {showOrg && org && <Link className="hover:text-ink hover:underline" href={`/customers/view/?id=${org.id}`}>{flag(org.country)} {org.name}</Link>}
              {contact && <span>／{contact.name}</span>}
              {showDeal && deal && <Link className="hover:text-ink hover:underline" href={`/deals/view/?id=${deal.id}`}>案件：{deal.name}</Link>}
            </div>
            {a.note && <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">{a.note}</p>}
            {perms.canDelete && <button onClick={() => { if (confirm("この活動を削除しますか？")) deleteActivity(a.id); }} className="absolute right-0 top-0 hidden text-ink-3 hover:text-bad group-hover:block" aria-label="削除"><Trash2 size={13} /></button>}
          </li>
        );
      })}
    </ol>
  );
}
