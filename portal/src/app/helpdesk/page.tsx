"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/data";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

const CATS = ["すべて", "IT", "人事", "経理", "総務", "コンプライアンス"];
const STATUS_TONE = { 受付: "gray", 対応中: "warn", 完了: "good" } as const;

export default function Helpdesk() {
  const { s, d, meId, role } = useStore();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [cat, setCat] = useState("すべて");
  const [f, setF] = useState({ cat: "IT", title: "", body: "" });
  const admin = role === "admin";
  const t = q.trim();
  const faqs = FAQ.filter((x) => (cat === "すべて" || x.cat === cat) && (!t || (x.q + x.a).includes(t)));
  const tickets = s.tickets.filter((x) => admin || x.by === meId);

  return (
    <div>
      <PageHeader title="ヘルプデスク" sub="まずFAQで解決を。解決しない場合は問い合わせを起票してください（IT：内線2999）。" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-label="FAQ">
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input !w-64" placeholder="困りごとを入力" value={q} onChange={(e) => setQ(e.target.value)} aria-label="FAQ検索" />
            {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-[12.5px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}</button>)}
          </div>
          <div className="card divide-y divide-line">
            {faqs.map((x) => (
              <details key={x.q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Badge tone="brand">{x.cat}</Badge><span className="flex-1">{x.q}</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden /></summary>
                <p className="mt-2 leading-7 text-ink-2">{x.a}</p>
              </details>
            ))}
            {faqs.length === 0 && <Empty>該当するFAQがありません。右のフォームから問い合わせてください。</Empty>}
          </div>
        </section>
        <section className="space-y-5 lg:col-span-2">
          <form className="card space-y-3 p-4" onSubmit={(e) => {
            e.preventDefault();
            d({ t: "ticket", tk: { id: `T-${3022 + s.tickets.length}`, cat: f.cat, title: f.title, body: f.body, status: "受付", createdAt: ymd(new Date()), by: meId } });
            setF({ cat: "IT", title: "", body: "" });
          }}>
            <h2 className="font-bold">問い合わせを起票</h2>
            <div><label className="label" htmlFor="tc">分類</label><select id="tc" className="input" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATS.slice(1).map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor="tt">件名</label><input id="tt" required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="label" htmlFor="tb">内容</label><textarea id="tb" required rows={3} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
            <button className="btn btn-primary w-full">送信</button>
          </form>
          <div className="card">
            <h2 className="border-b border-line px-4 py-3 font-bold">{admin ? "全問い合わせ（管理者）" : "自分の問い合わせ"}</h2>
            {tickets.map((x) => (
              <div key={x.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex items-center gap-2"><Badge tone={STATUS_TONE[x.status]}>{x.status}</Badge><span className="tabular text-[12px] text-ink-3">{x.id}・{x.cat}・{x.createdAt}</span></div>
                <div className="font-medium">{x.title}</div>
                {admin && x.status !== "完了" && <div className="mt-1.5 flex gap-1.5">{(["対応中", "完了"] as const).map((st) => <button key={st} className="btn !h-7 !px-2 text-[12px]" onClick={() => d({ t: "ticket-status", id: x.id, status: st })}>{st}にする</button>)}</div>}
              </div>
            ))}
            {tickets.length === 0 && <Empty>問い合わせはありません</Empty>}
          </div>
        </section>
      </div>
    </div>
  );
}
