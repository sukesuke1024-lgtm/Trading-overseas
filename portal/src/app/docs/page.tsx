"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FilePlus2, Pencil, Printer, Trash2 } from "lucide-react";
import { DOC_CATEGORIES, type Doc } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default function DocsPage() {
  const { s, d, meId, role } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const [cat, setCat] = useState<string>("すべて");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Doc | "new" | null>(null);
  const manage = can.manageDocs(role);
  const ack = s.docAck[meId] ?? {};
  const list = useMemo(() => s.docs.filter((x) => (cat === "すべて" || x.category === cat) && `${x.title}${x.body}`.includes(q)), [s.docs, cat, q]);
  const cur = s.docs.find((x) => x.id === sp.get("id"));

  if (cur) {
    const done = ack[cur.id] === cur.version;
    const confirmed = Object.values(s.docAck).filter((m) => m[cur.id] === cur.version).length;
    return (
      <article className="card max-w-3xl p-6">
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <button className="btn" onClick={() => router.push("/docs")}><ArrowLeft size={14} />一覧へ</button>
          <button className="btn" onClick={() => window.print()}><Printer size={14} />印刷・PDF</button>
          {manage && <><button className="btn" onClick={() => setEdit(cur)}><Pencil size={14} />編集</button><button className="btn btn-danger" onClick={() => { if (confirm("この文書を削除しますか？")) { d({ t: "doc-del", id: cur.id, by: meId }); router.push("/docs"); } }}><Trash2 size={14} />削除</button></>}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="brand">{cur.category}</Badge><span className="tabular text-[12px] text-ink-3">{cur.version}・施行 {cur.effective}・更新 {cur.updatedAt}（{cur.updatedBy}）</span></div>
        <h1 className="mb-4 text-xl font-bold leading-snug">{cur.title}</h1>
        <p className="whitespace-pre-wrap leading-8">{cur.body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4 print:hidden">
          {done ? <span className="flex items-center gap-1.5 text-good"><CheckCircle2 size={16} />この版（{cur.version}）を確認済みです</span>
            : <button className="btn btn-primary" onClick={() => d({ t: "doc-ack", emp: meId, id: cur.id, version: cur.version })}>内容を確認しました</button>}
          {can.viewAllReports(role) && <span className="text-[12.5px] text-ink-3">確認済み {confirmed} / {s.employees.length}名</span>}
        </div>
        {edit && <DocForm key={cur.id + cur.version} init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      </article>
    );
  }

  return (
    <div>
      <PageHeader title="文書管理・社内規程" sub="就業規則・各種規程・マニュアルを一か所で。改定されたら「確認しました」で既読を残せます。"
        actions={manage ? <button className="btn btn-primary" onClick={() => setEdit("new")}><FilePlus2 size={15} />文書を登録</button> : undefined} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["すべて", ...DOC_CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-3 py-1 text-[12.5px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}</button>)}
        <input className="input ml-auto !w-56" placeholder="キーワードで検索" aria-label="キーワード" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        {list.length === 0 && <Empty>{s.docs.length === 0 ? (manage ? "まだ文書がありません。「文書を登録」から規程を登録してください。" : "文書はまだ登録されていません。") : "該当する文書はありません"}</Empty>}
        {list.map((x) => (
          <button key={x.id} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-bg" onClick={() => router.push(`/docs?id=${x.id}`)}>
            <Badge tone="brand">{x.category}</Badge>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.title}</span><span className="tabular text-[12px] text-ink-3">{x.version}・施行 {x.effective}</span></span>
            {ack[x.id] === x.version ? <Badge tone="good">確認済み</Badge> : <Badge tone="warn">未確認</Badge>}
          </button>
        ))}
      </div>
      {edit && <DocForm init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DocForm({ init, onClose }: { init: Doc | null; onClose: () => void }) {
  const { d, me } = useStore();
  const today = ymd(new Date());
  const [f, setF] = useState({ title: init?.title ?? "", category: init?.category ?? DOC_CATEGORIES[0], version: init?.version ?? "v1.0", effective: init?.effective ?? today, body: init?.body ?? "" });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="文書の登録" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        d({ t: "doc-save", by: me.id, doc: { id: init?.id ?? `doc${Date.now()}`, ...f, updatedAt: today, updatedBy: me.name } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? "文書を編集" : "文書を登録"}</h2>
        <div><label className="label" htmlFor="dt">タイトル</label><input id="dt" required maxLength={120} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="dc">分類</label><select id="dc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="dv">版</label><input id="dv" required maxLength={20} className="input" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></div>
          <div><label className="label" htmlFor="de">施行日</label><input id="de" type="date" required className="input" value={f.effective} onChange={(e) => setF({ ...f, effective: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="db">本文</label><textarea id="db" required rows={12} maxLength={60000} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        {init && <p className="text-[12px] text-ink-3">改定したときは「版」を変えると、全員の「確認済み」が未確認に戻ります。</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary">保存</button></div>
      </form>
    </div>
  );
}
