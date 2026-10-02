"use client";
import { useState } from "react";
import { ExternalLink, Lock, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { addNotice, deleteNotice, toggleNoticePin, useMe, useStore } from "@/lib/store";
import { SALES_DEPT } from "@/lib/roster";
import { fmtDate } from "@/lib/dates";
import { permsFor } from "@/lib/selectors";
import { canSeeBoard } from "@/components/Shell";
import { Avatar, Drawer, Field, PageHeader } from "@/components/ui";
import type { NoticeUrl } from "@/lib/types";

const validUrl = (u: string) => /^https:\/\/[^\s/]+\.[^\s]+/.test(u) || u.startsWith("../") || u.startsWith("/");

/** 営業部のお知らせ：営業部（従業員名簿の部署）と Manager 以上だけが見られる。お知らせには公式URLを必ず添付する */
export default function Board() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const [adding, setAdding] = useState(false);
  if (!canSeeBoard(me)) return <div className="card mx-auto mt-10 max-w-lg p-8 text-center text-[13px] text-ink-2"><Lock className="mx-auto mb-2 text-ink-3" />営業部のお知らせは、営業部の方（従業員名簿の部署）と Manager 以上が閲覧できます。</div>;
  const list = [...d.notices].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="営業部のお知らせ" sub={<span className="inline-flex items-center gap-1.5"><Lock size={12} />営業部だけに表示されます（部署は社内ポータルの従業員名簿と同じ）。お知らせには公式URLを添付しています。</span>}
        actions={perms.isManager && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />お知らせを投稿</button>} />
      <ul className="space-y-3">
        {list.map((n) => { const a = d.users.find((u) => u.id === n.authorId); return (
          <li key={n.id} className="card anim-rise p-5">
            <div className="flex items-start gap-2">
              {n.pinned && <Pin size={14} className="mt-1 shrink-0 text-accent-2" aria-label="固定" />}
              <h2 className="flex-1 text-[15.5px] font-bold leading-snug">{n.title}</h2>
              {perms.isManager && <div className="flex gap-1"><button className="btn btn-ghost btn-sm" onClick={() => toggleNoticePin(n.id)} title="固定／解除"><Pin size={13} /></button><button className="btn btn-ghost btn-sm btn-danger" aria-label="削除" onClick={() => confirm("このお知らせを削除しますか？") && deleteNotice(n.id)}><Trash2 size={13} /></button></div>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-3"><span className="chip chip-accent"><Megaphone size={11} />営業部限定</span><span className="num">{fmtDate(n.date, true)}</span>{a && <span className="inline-flex items-center gap-1"><Avatar user={a} size={14} />{a.name}</span>}</div>
            <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{n.body}</p>
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              <div className="mb-1.5 text-[11.5px] font-bold text-ink-2">公式URL</div>
              <ul className="space-y-1">{n.urls.map((u) => <li key={u.url}><a href={u.url} target={u.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-2 hover:underline"><ExternalLink size={12} />{u.label}<span className="text-[11px] font-normal text-ink-3">{u.url.replace(/^https?:\/\//, "")}</span></a></li>)}</ul>
            </div>
          </li>); })}
        {list.length === 0 && <li className="card p-10 text-center text-[13px] text-ink-3">お知らせはまだありません。</li>}
      </ul>
      <p className="mt-4 px-1 text-[11.5px] text-ink-3">営業部（{SALES_DEPT}）以外の方には、メニューにも表示されません。リンク先は外部サイトです。個人情報・機密情報は入力しないでください。</p>
      {adding && <NoticeDrawer onClose={() => setAdding(false)} />}
    </div>
  );
}

function NoticeDrawer({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [pinned, setPinned] = useState(false);
  const [urls, setUrls] = useState<NoticeUrl[]>([{ label: "", url: "https://" }]);
  const ok = title.trim() && body.trim() && urls.length > 0 && urls.every((u) => u.label.trim() && validUrl(u.url.trim()) && u.url.trim() !== "https://");
  const setU = (i: number, k: keyof NoticeUrl, v: string) => setUrls((x) => x.map((u, j) => (j === i ? { ...u, [k]: v } : u)));
  return (
    <Drawer open onClose={onClose} title="営業部のお知らせを投稿" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok} onClick={() => { addNotice({ title: title.trim(), body: body.trim(), pinned, urls: urls.map((u) => ({ label: u.label.trim(), url: u.url.trim() })) }); onClose(); }}>投稿する</button></>}>
      <div className="space-y-4">
        <Field label="タイトル *"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="本文 *"><textarea className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="rounded-xl bg-accent-soft p-3.5">
          <div className="mb-2 text-[12.5px] font-bold text-accent">公式URL（1件以上・必須）</div>
          <div className="space-y-2">{urls.map((u, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2"><input className="input" placeholder="名称（例：JETRO）" value={u.label} onChange={(e) => setU(i, "label", e.target.value)} /><input className={`input ${u.url.trim() !== "https://" && !validUrl(u.url.trim()) ? "!ring-[var(--bad)]" : ""}`} placeholder="https://…" value={u.url} onChange={(e) => setU(i, "url", e.target.value)} />{urls.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setUrls((x) => x.filter((_, j) => j !== i))} aria-label="削除"><Trash2 size={13} /></button>}</div>
          ))}</div>
          <button className="btn btn-sm mt-2" onClick={() => setUrls((x) => [...x, { label: "", url: "https://" }])}><Plus size={12} />URLを追加</button>
          <p className="mt-2 text-[11.5px] text-ink-3">官公庁・団体・取引銀行などの公式サイトの URL を、https:// から入力してください。</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />上部に固定する</label>
      </div>
    </Drawer>
  );
}
