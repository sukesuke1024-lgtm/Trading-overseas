"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/data";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default function NewsPage() {
  const { s, d } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id");
  const [cat, setCat] = useState<"すべて" | NewsCategory>("すべて");
  const [q, setQ] = useState("");
  const [unreadOnly, setUnread] = useState(false);
  const [compose, setCompose] = useState(false);
  const canPost = s.role === "admin";

  const list = useMemo(() => s.news.filter((n) =>
    (cat === "すべて" || n.category === cat) && (!unreadOnly || !s.read.includes(n.id)) && (n.title + n.body).includes(q)), [s.news, s.read, cat, q, unreadOnly]);
  const cur = s.news.find((n) => n.id === id);

  if (cur) {
    if (!s.read.includes(cur.id)) queueMicrotask(() => d({ t: "read", id: cur.id }));
    return (
      <article className="card max-w-3xl p-6">
        <button className="btn mb-4" onClick={() => router.push("/news")}><ArrowLeft size={14} />一覧へ</button>
        <div className="mb-2 flex items-center gap-2"><Badge tone={cur.important ? "bad" : "brand"}>{cur.category}</Badge>{cur.important && <Badge tone="bad">重要</Badge>}<span className="tabular text-[12px] text-ink-3">{cur.date}　{cur.author}</span></div>
        <h1 className="mb-4 text-xl font-bold leading-snug">{cur.title}</h1>
        <p className="whitespace-pre-wrap leading-8">{cur.body}</p>
        <p className="mt-6 border-t border-line pt-3 text-[12px] text-ink-3">お問い合わせ：{cur.author}（社内メール・内線）／ 本情報は社外秘です。</p>
      </article>
    );
  }
  return (
    <div>
      <PageHeader title="お知らせ" sub="全社・部門からの通知。重要なお知らせは既読管理の対象です。"
        actions={canPost ? <button className="btn btn-primary" onClick={() => setCompose(true)}><Plus size={15} />お知らせを投稿</button> : <span className="text-[12px] text-ink-3">投稿は「全社管理者」ロールのみ</span>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["すべて", ...NEWS_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-3 py-1 text-[12.5px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}</button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnread(e.target.checked)} />未読のみ</label>
        <input className="input !w-56" placeholder="キーワードで絞り込み" value={q} onChange={(e) => setQ(e.target.value)} aria-label="キーワード" />
      </div>
      <div className="card">
        {list.length === 0 && <Empty>該当するお知らせはありません</Empty>}
        {list.map((n) => (
          <div key={n.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.read.includes(n.id) ? "bg-transparent" : "bg-brand-2"}`} aria-label={s.read.includes(n.id) ? "既読" : "未読"} />
            <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/news?id=${n.id}`)}>
              <div className="mb-0.5 flex items-center gap-2"><Badge tone={n.important ? "bad" : "gray"}>{n.category}</Badge>{n.important && <Badge tone="bad">重要</Badge>}<span className="tabular text-[12px] text-ink-3">{n.date}・{n.author}</span></div>
              <div className={`truncate ${s.read.includes(n.id) ? "" : "font-semibold"}`}>{n.title}</div>
            </button>
            {canPost && <button className="btn btn-danger !h-8 !w-8 !p-0" aria-label="削除" onClick={() => confirm("このお知らせを削除しますか？") && d({ t: "news-del", id: n.id })}><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      {compose && <Compose onClose={() => setCompose(false)} />}
    </div>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const { d } = useStore();
  const [f, setF] = useState({ title: "", body: "", category: "全社" as NewsCategory, important: false });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="お知らせ投稿">
      <form className="card w-full max-w-xl space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        d({ t: "news", n: { id: `n${Date.now()}`, ...f, date: ymd(new Date()), author: "人事部（管理者）" } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">お知らせを投稿</h2>
        <div><label className="label" htmlFor="nt">タイトル</label><input id="nt" required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="nc">カテゴリ</label><select id="nc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as NewsCategory })}>{NEWS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <label className="mt-6 flex items-center gap-2"><input type="checkbox" checked={f.important} onChange={(e) => setF({ ...f, important: e.target.checked })} />重要（ホームに固定表示）</label>
        </div>
        <div><label className="label" htmlFor="nb">本文</label><textarea id="nb" required rows={6} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary">投稿</button></div>
      </form>
    </div>
  );
}
