"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Settings2 } from "lucide-react";
import { ROLE_LABEL } from "@/lib/data";
import { useStore, ymd } from "@/lib/store";
import { Badge } from "@/components/ui";
import { useMedia } from "@/lib/useMedia";
import { DEFAULT_ORDER, WIDGETS } from "@/components/widgets";

type Prefs = { order: string[]; hidden: string[] };

function Card({ w }: { w: (typeof WIDGETS)[number] }) {
  const C = w.C;
  return w.id === "punch" ? <C /> : <section aria-label={w.title} className={`card min-w-0 ${w.flat ? "" : "p-4"}`}><C /></section>;
}

export default function Home() {
  const { s, meId, role, me } = useStore();
  const now = new Date();
  const hour = now.getHours();
  const key = `hlink-widgets2-${meId}`;
  const wide = useMedia("(min-width: 1024px)");
  const defaults = role === "employee" ? DEFAULT_ORDER.employee : DEFAULT_ORDER.lead;
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { const p = JSON.parse(localStorage.getItem(key) ?? "null") as Prefs | null; if (p && Array.isArray(p.order) && Array.isArray(p.hidden)) return p; } catch {}
    return { order: [...defaults], hidden: [] };
  });
  const [edit, setEdit] = useState(false);
  const save = (p: Prefs) => { setPrefs(p); try { localStorage.setItem(key, JSON.stringify(p)); } catch {} };

  // この権限で使えるウィジェットだけ。保存済みの並びに、新しく増えたものを末尾へ補う
  const usable = useMemo(() => WIDGETS.filter((w) => w.show(role)), [role]);
  const order = useMemo(() => {
    const ids = new Set(usable.map((w) => w.id));
    const base = prefs.order.filter((id) => ids.has(id));
    return [...base, ...defaults.filter((id) => ids.has(id) && !base.includes(id)), ...usable.map((w) => w.id).filter((id) => !base.includes(id) && !defaults.includes(id as never))];
  }, [prefs.order, usable, defaults]);
  const move = (id: string, d: number) => { const i = order.indexOf(id), j = i + d; if (j < 0 || j >= order.length) return; const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; save({ ...prefs, order: o }); };
  const toggle = (id: string) => save({ ...prefs, order, hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });

  const important = s.news.filter((n) => n.important && !(s.read[meId] ?? []).includes(n.id));
  const shown = order.map((id) => usable.find((w) => w.id === id)).filter((w): w is NonNullable<typeof w> => !!w && !prefs.hidden.includes(w.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{hour < 11 ? "おはようございます" : hour < 18 ? "お疲れさまです" : "お疲れさまでした"}、{me.name.split(" ")[0]}さん</h1>
          <p className="text-ink-2">{now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}　<Badge>{ROLE_LABEL[role]}</Badge></p>
        </div>
        <button className="btn" aria-expanded={edit} onClick={() => setEdit(!edit)}><Settings2 size={15} />ウィジェットの設定</button>
      </div>

      {edit && (
        <section className="card p-4" aria-label="ウィジェットの設定">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">表示するウィジェットと並び順（{role === "employee" ? "一般社員" : "役職者"}向け）</h2><button className="btn !h-8" onClick={() => save({ order: [...defaults], hidden: [] })}><RotateCcw size={13} />初期設定に戻す</button></div>
          <ul className="grid gap-1 sm:grid-cols-2">{order.map((id, i) => { const w = usable.find((x) => x.id === id); return w ? (
            <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[13px]"><label className="flex flex-1 items-center gap-2"><input type="checkbox" checked={!prefs.hidden.includes(id)} onChange={() => toggle(id)} />{w.title}</label>
              <button className="btn !h-7 !w-7 !p-0" aria-label={`${w.title}を上へ`} disabled={i === 0} onClick={() => move(id, -1)}><ArrowUp size={13} /></button><button className="btn !h-7 !w-7 !p-0" aria-label={`${w.title}を下へ`} disabled={i === order.length - 1} onClick={() => move(id, 1)}><ArrowDown size={13} /></button></li>) : null; })}</ul>
          <p className="mt-2 text-[12px] text-ink-3">この設定はこの端末のブラウザに保存されます。役職者（役員・管理者）には、全社の状況・KPI・日報の提出状況などのウィジェットが追加されます。</p>
        </section>
      )}

      {important.length > 0 && (
        <section aria-label="重要なお知らせ" className="rounded-[10px] border border-warn/30 bg-warn-soft p-4">
          <div className="mb-1 font-bold text-warn">重要なお知らせ</div>
          <ul className="space-y-1">{important.map((n) => <li key={n.id}><Link href={`/news?id=${n.id}`} className="underline-offset-2 hover:underline">{n.title}</Link></li>)}</ul>
        </section>
      )}

      {shown.length === 0 ? <p className="text-ink-3">表示するウィジェットがありません。右上の「ウィジェットの設定」から選んでください。</p> : wide ? (
        <div className="grid grid-cols-3 items-start gap-5">
          <div className="col-span-2 min-w-0 space-y-5">{shown.filter((w) => w.col === "main").map((w) => <Card key={w.id} w={w} />)}</div>
          <div className="min-w-0 space-y-5">{shown.filter((w) => w.col === "side").map((w) => <Card key={w.id} w={w} />)}</div>
        </div>
      ) : <div className="space-y-5">{shown.map((w) => <Card key={w.id} w={w} />)}</div>}
      <p className="text-[11.5px] text-ink-3">{ymd(now)}</p>
    </div>
  );
}
