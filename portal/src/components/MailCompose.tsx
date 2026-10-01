"use client";

import { useState } from "react";
import { MAIL_CATEGORIES, deptOf, type Mail, type MailCategory } from "@/lib/ops";
import { useStore } from "@/lib/store";

export const DESKS = ["人事", "情シス", "経理", "総務"] as const;
export const deskOf = (c: MailCategory): (typeof DESKS)[number] => ({ ハラスメント相談: "人事", 人事: "人事", "情シス・PC": "情シス", ツールの使い方: "情シス", 経理: "経理", 総務: "総務", "営業・業務": "総務", その他: "総務" } as const)[c];

/** 問い合わせの作成。宛先は「個人」「事業部」「窓口（管理部）」から選ぶ。ハラスメント相談などは匿名にできる */
export function MailCompose({ init, onClose, onSent }: { init?: Partial<{ toType: Mail["toType"]; category: MailCategory; subject: string; anon: boolean }>; onClose: () => void; onSent?: (id: string) => void }) {
  const { s, d, me, meId } = useStore();
  const [newId] = useState(() => `M${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const depts = [...new Set(s.employees.map((e) => deptOf(e)))].sort();
  const people = s.employees.filter((e) => e.id !== meId && !e.left);
  const [f, setF] = useState({ toType: init?.toType ?? "窓口" as Mail["toType"], category: init?.category ?? "総務" as MailCategory, subject: init?.subject ?? "", body: "", anon: init?.anon ?? false, person: people[0]?.id ?? "", dept: deptOf(me), desk: deskOf(init?.category ?? "総務") as string });
  const toId = f.toType === "個人" ? f.person : f.toType === "事業部" ? f.dept : f.desk;
  const canAnon = f.toType === "窓口";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="問い合わせの作成" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        if (!toId || !f.subject.trim() || !f.body.trim()) return;
        d({ t: "mail-new", mail: { id: newId, from: meId, anon: canAnon && f.anon, toType: f.toType, toId, category: f.category, subject: f.subject.trim(), body: f.body.trim(), at: new Date().toISOString(), status: "未対応", thread: [] } });
        onSent?.(newId); onClose();
      }}>
        <h2 className="text-lg font-bold">問い合わせ・メッセージを送る</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="mt">宛先の種類</label><select id="mt" className="input" value={f.toType} onChange={(e) => setF({ ...f, toType: e.target.value as Mail["toType"], anon: false })}><option value="窓口">窓口（管理部：人事・情シス・経理・総務）</option><option value="事業部">事業部（部署のみんなへ）</option><option value="個人">個人（社員へ）</option></select></div>
          <div>
            {f.toType === "窓口" && <><label className="label" htmlFor="md">窓口</label><select id="md" className="input" value={f.desk} onChange={(e) => setF({ ...f, desk: e.target.value })}>{DESKS.map((x) => <option key={x}>{x}</option>)}</select></>}
            {f.toType === "事業部" && <><label className="label" htmlFor="md2">事業部</label><select id="md2" className="input" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>{depts.map((x) => <option key={x}>{x}</option>)}</select></>}
            {f.toType === "個人" && <><label className="label" htmlFor="mp">宛先</label><select id="mp" className="input" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })}>{people.map((e) => <option key={e.id} value={e.id}>{e.name}（{e.dept ?? e.job}）</option>)}</select></>}
          </div>
        </div>
        <div><label className="label" htmlFor="mc">内容の分類</label><select id="mc" className="input" value={f.category} onChange={(e) => { const c = e.target.value as MailCategory; setF({ ...f, category: c, desk: f.toType === "窓口" ? deskOf(c) : f.desk }); }}>{MAIL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="ms">件名</label><input id="ms" required maxLength={120} className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
        <div><label className="label" htmlFor="mb">内容</label><textarea id="mb" required rows={6} maxLength={8000} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        {canAnon && <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-[13px]"><input type="checkbox" className="mt-1" checked={f.anon} onChange={(e) => setF({ ...f, anon: e.target.checked })} /><span><b>匿名で送る</b><span className="block text-[12px] text-ink-3">担当者には送信者が表示されません。返信はこの画面で受け取れます。ハラスメント相談は、管理者（人事）だけが閲覧します。</span></span></label>}
        <p className="text-[11.5px] text-ink-3">送信者：{f.anon && canAnon ? "（匿名）" : me.name}・事業部：{deptOf(me)}。{f.toType === "個人" ? "個人宛ては、送った人と宛先の人だけが読めます。" : f.toType === "事業部" ? "事業部宛ては、その事業部のメンバーと役員・管理者が読めます。" : "窓口宛ては、管理者（人事・情シス・経理・総務）だけが読めます。"}</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!toId || !f.subject.trim() || !f.body.trim()}>送信</button></div>
      </form>
    </div>
  );
}
