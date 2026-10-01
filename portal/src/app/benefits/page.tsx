"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { BENEFIT_CATEGORIES, BENEFIT_TEMPLATES, isHttps, type Benefit } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default function BenefitsPage() {
  const { s, d, meId, role, me } = useStore();
  const [cat, setCat] = useState<"すべて" | Benefit["category"]>("すべて");
  const [edit, setEdit] = useState<Benefit | "new" | null>(null);
  const manage = can.manageBenefits(role);
  const list = s.benefits.filter((b) => cat === "すべて" || b.category === cat);
  const addTemplates = () => { BENEFIT_TEMPLATES.forEach((b, i) => d({ t: "benefit-save", by: meId, benefit: { ...b, id: `bt${Date.now()}${i}`, updatedAt: ymd(new Date()), updatedBy: me.name } })); };
  return (
    <div>
      <PageHeader title="福利厚生のご案内" sub="福利厚生クラブ・住宅手当・各種手当・慶弔見舞金・健康管理などの制度のご案内です。"
        actions={manage ? <div className="flex gap-2">{s.benefits.length === 0 && <button className="btn" onClick={addTemplates}><Sparkles size={15} />雛形を追加</button>}<button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />案内を登録</button></div> : undefined} />
      <div className="mb-3 flex flex-wrap gap-2">{["すべて", ...BENEFIT_CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c as typeof cat)} aria-pressed={cat === c} className={`rounded-full border px-3 py-1 text-[12.5px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((b) => (
          <section key={b.id} className="card p-4" aria-label={b.title}>
            <div className="mb-1 flex items-start gap-2"><div className="min-w-0 flex-1"><h2 className="font-bold">{b.title}</h2><Badge tone="brand">{b.category}</Badge></div>
              {manage && <div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${b.title}を編集`} onClick={() => setEdit(b)}><Pencil size={13} /></button><button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${b.title}を削除`} onClick={() => confirm(`「${b.title}」を削除しますか？`) && d({ t: "benefit-del", id: b.id, by: meId })}><Trash2 size={13} /></button></div>}</div>
            <p className="mb-2 text-[13.5px] text-ink-2">{b.summary}</p>
            <details className="text-[13px]"><summary className="cursor-pointer font-medium text-brand-2">詳しく見る</summary><p className="mt-2 whitespace-pre-wrap leading-7">{b.body}</p></details>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">{b.contact && <span>お問い合わせ：{b.contact}</span>}<span>更新 {b.updatedAt}</span>{b.link && isHttps(b.link) && <a className="btn !h-8 ml-auto" href={b.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />サイトを開く</a>}</div>
          </section>
        ))}
        {list.length === 0 && <div className="card md:col-span-2"><Empty>{manage ? "案内がまだありません。「雛形を追加」で項目の見出しを入れ、自社の内容に編集してください。" : "福利厚生のご案内はまだ登録されていません。管理部にお問い合わせください。"}</Empty></div>}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">制度の対象・金額・申請方法は、就業規則・賃金規程が優先します。変更が生じたときは「異動・変更届」から届け出てください。</p>
      {edit && <BenefitForm key={edit === "new" ? "new" : edit.id} init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BenefitForm({ init, onClose }: { init: Benefit | null; onClose: () => void }) {
  const { d, me, meId } = useStore();
  const [newId] = useState(() => `b${Date.now()}`);
  const [f, setF] = useState({ title: init?.title ?? "", category: init?.category ?? BENEFIT_CATEGORIES[0], summary: init?.summary ?? "", body: init?.body ?? "", link: init?.link ?? "", contact: init?.contact ?? "" });
  const linkBad = !!f.link && !isHttps(f.link);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="福利厚生の案内" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (linkBad) return; d({ t: "benefit-save", by: meId, benefit: { id: init?.id ?? newId, title: f.title.trim(), category: f.category as Benefit["category"], summary: f.summary.trim(), body: f.body, ...(f.link ? { link: f.link } : {}), ...(f.contact.trim() ? { contact: f.contact.trim() } : {}), updatedAt: ymd(new Date()), updatedBy: me.name } }); onClose(); }}>
        <h2 className="text-lg font-bold">{init ? "案内を編集" : "案内を登録"}</h2>
        <div><label className="label" htmlFor="bt">タイトル</label><input id="bt" required maxLength={100} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label" htmlFor="bc">分類</label><select id="bc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Benefit["category"] })}>{BENEFIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="bs">ひとこと説明</label><input id="bs" required maxLength={300} className="input" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
        <div><label className="label" htmlFor="bb">詳細（対象・金額・申請方法など）</label><textarea id="bb" rows={7} maxLength={10000} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="bl">関連サイトのURL（https://）</label><input id="bl" className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />{linkBad && <p className="mt-1 text-[12px] text-bad">https:// で始まるURL</p>}</div><div><label className="label" htmlFor="bo">お問い合わせ先</label><input id="bo" maxLength={100} className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={linkBad || !f.title.trim() || !f.summary.trim()}>保存</button></div>
      </form>
    </div>
  );
}
