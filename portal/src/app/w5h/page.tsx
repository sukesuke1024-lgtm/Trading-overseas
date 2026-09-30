"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { empById } from "@/lib/data";
import { download } from "@/lib/csv";
import { hm, useStore, ymd } from "@/lib/store";
import { CATEGORIES, buildEvents, markdown, notionCsv, people, tally, type W5H } from "@/lib/w5h";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader } from "@/components/report";
import { PLACES } from "@/components/PunchCard";

const TABS = ["タイムライン", "一覧表", "集計"] as const;
const SRC_LABEL = { punch: "打刻", workflow: "ワークフロー", manual: "手入力" } as const;
const TONE = { 勤務: "brand", 申請: "warn", 承認: "good" } as const;
const fmtMin = (m: number) => (m ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ""}` : "—");

export default function W5H() {
  const { s, d, meId } = useStore();
  const today = ymd(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<(typeof TABS)[number]>("タイムライン");
  const [cat, setCat] = useState("");
  const [src, setSrc] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const all = useMemo(() => buildEvents({ meId, name: (id) => empById(id)?.name ?? id, punches: s.punches[meId] ?? {}, workflows: s.workflows, logs: s.logs }, from, to), [s.punches, s.workflows, s.logs, meId, from, to]);
  const events = useMemo(() => all.filter((e) => (!cat || e.category === cat) && (!src || e.source === src) && (!q || `${e.what}${e.where}${e.who}${e.why}${e.how}`.includes(q))), [all, cat, src, q]);
  const days = useMemo(() => { const m = new Map<string, W5H[]>(); for (const e of events) { const k = e.when.slice(0, 10); m.set(k, [...(m.get(k) ?? []), e]); } return [...m.entries()]; }, [events]);
  const cats = [...new Set(all.map((e) => e.category))];
  const preset = (a: string, b: string) => { setFrom(a); setTo(b); };
  const dt = new Date(), dow = (dt.getDay() + 6) % 7, monday = ymd(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - dow));
  const period = `${from} 〜 ${to}`;
  const exportCsv = () => { download(`5W1H_${from}_${to}.csv`, notionCsv(events)); d({ t: "export-log", by: meId, what: `5W1H CSV ${period}` }); };
  const exportMd = () => { download(`5W1H_${from}_${to}.md`, markdown(events, `5W1H記録 ${period}`), "text/markdown;charset=utf-8"); d({ t: "export-log", by: meId, what: `5W1H Markdown ${period}` }); };

  return (
    <div>
      <div className="print:hidden"><PageHeader title="5W1H 記録" sub="勤怠・申請・承認の記録に、自分のメモを足して「いつ・どこで・誰が・何を・なぜ・どのように」で見える化します。" actions={<div className="flex flex-wrap gap-2">
        <button className="btn" onClick={exportCsv} disabled={!events.length}><Download size={14} />Notion用CSV</button>
        <button className="btn" onClick={exportMd} disabled={!events.length}><FileText size={14} />Markdown</button>
        <PrintButton what="5W1H記録" />
        <button className="btn btn-primary" onClick={() => setOpen(!open)}><Plus size={15} />記録を追加</button></div>} /></div>
      <PrintHeader title="5W1H 記録" period={period} />
      {open && <Compose onDone={() => setOpen(false)} />}

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        {[["今日", today, today], ["今週", monday, today], ["今月", `${today.slice(0, 7)}-01`, today]].map(([l, a, b]) => <button key={l} className={`rounded-full border px-3 py-1 text-[12.5px] ${from === a && to === b ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`} onClick={() => preset(a, b)}>{l}</button>)}
        <input type="date" className="input !w-36" aria-label="開始日" value={from} onChange={(e) => setFrom(e.target.value)} /><span>〜</span><input type="date" className="input !w-36" aria-label="終了日" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input !w-32" aria-label="分類" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">分類: すべて</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input !w-36" aria-label="ソース" value={src} onChange={(e) => setSrc(e.target.value)}><option value="">由来: すべて</option><option value="punch">打刻</option><option value="workflow">ワークフロー</option><option value="manual">手入力</option></select>
        <input className="input !w-44" placeholder="キーワード" aria-label="キーワード" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-[12.5px] text-ink-3">{events.length}件</span>
      </div>
      <div className="mb-4 flex gap-1 border-b border-line print:hidden" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${tab === t ? "border-brand text-brand" : "border-transparent text-ink-3"}`}>{t}</button>)}</div>

      {events.length === 0 && <div className="card"><Empty>この期間の記録はありません。打刻や申請、または「記録を追加」から入力してください。</Empty></div>}

      {tab === "タイムライン" && days.map(([date, list]) => (
        <section key={date} className="mb-5 avoid-break">
          <h2 className="mb-2 flex items-baseline gap-3 font-bold"><span className="tabular">{date.slice(5).replace("-", "/")}（{"日月火水木金土"[new Date(`${date}T00:00`).getDay()]}）</span><span className="text-[12px] font-normal text-ink-3">{list.length}件・{fmtMin(list.reduce((a, e) => a + e.minutes, 0))}</span></h2>
          <div className="space-y-2">{list.map((e) => <Card key={e.id} e={e} onDelete={e.source === "manual" ? () => confirm("この記録を削除しますか？") && d({ t: "log-del", id: e.id, by: meId }) : undefined} />)}</div>
        </section>
      ))}

      {tab === "一覧表" && events.length > 0 && (
        <div className="card overflow-x-auto"><table className="w-full min-w-[900px] text-[13px]"><thead><tr><th className="th">いつ</th><th className="th">どこで</th><th className="th">誰が</th><th className="th">何を</th><th className="th">なぜ</th><th className="th">どのように</th></tr></thead><tbody>
          {events.map((e) => <tr key={e.id} className="avoid-break align-top"><td className="td tabular whitespace-nowrap">{e.when.replace("T", " ")}{e.until && `〜${e.until.slice(11)}`}</td><td className="td">{e.where}</td><td className="td">{e.who}</td><td className="td font-medium">{e.what}</td><td className="td text-ink-2">{e.why}</td><td className="td text-ink-2">{e.how}</td></tr>)}
        </tbody></table></div>
      )}

      {tab === "集計" && events.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Bars title="どこで（時間）" rows={tally(events, (e) => [e.where]).filter((r) => r.minutes > 0)} by="minutes" />
          <Bars title="何を（分類・件数）" rows={tally(events, (e) => [e.category])} by="count" />
          <Bars title="誰が・誰と（件数）" rows={tally(events, (e) => people(e.who)).slice(0, 8)} by="count" />
          <Bars title="どのように（件数）" rows={tally(events, (e) => [e.how.split(/[／（(]/)[0]]).slice(0, 8)} by="count" />
        </div>
      )}
    </div>
  );
}

function Card({ e, onDelete }: { e: W5H; onDelete?: () => void }) {
  return (
    <div className="card p-3 avoid-break">
      <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={TONE[e.category as keyof typeof TONE] ?? "gray"}>{e.category}</Badge><span className="font-semibold">{e.what}</span><span className="tabular text-[12px] text-ink-3">{e.when.length > 10 ? e.when.slice(11) : "終日"}{e.until && `〜${e.until.slice(11)}`}{e.minutes > 0 && `（${fmtMin(e.minutes)}）`}</span><span className="text-[11px] text-ink-3">{SRC_LABEL[e.source]}</span>{onDelete && <button className="ml-auto text-ink-3 hover:text-bad print:hidden" aria-label="削除" onClick={onDelete}><Trash2 size={14} /></button>}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4"><F l="どこで（Where）" v={e.where} /><F l="誰が（Who）" v={e.who} /><F l="なぜ（Why）" v={e.why} /><F l="どのように（How）" v={e.how} /></dl>
    </div>
  );
}

function F({ l, v }: { l: string; v: string }) {
  return <div className="min-w-0"><dt className="text-[11px] font-semibold text-ink-3">{l}</dt><dd className="break-words text-[13px]">{v || "—"}</dd></div>;
}

function Bars({ title, rows, by }: { title: string; rows: { key: string; count: number; minutes: number }[]; by: "minutes" | "count" }) {
  const max = Math.max(1, ...rows.map((r) => r[by]));
  return (
    <div className="card p-4 avoid-break"><h2 className="mb-2 font-bold">{title}</h2>
      {rows.length === 0 ? <p className="text-ink-3">データなし</p> : <ul className="space-y-1.5">{rows.map((r) => <li key={r.key} className="flex items-center gap-3 text-[13px]"><span className="w-28 shrink-0 truncate" title={r.key}>{r.key}</span><div className="h-2 flex-1 rounded bg-surface-2"><div className="h-2 rounded bg-brand-2" style={{ width: `${(r[by] / max) * 100}%` }} /></div><span className="tabular w-24 text-right text-ink-2">{by === "minutes" ? fmtMin(r.minutes) : `${r.count}件`}</span></li>)}</ul>}
    </div>
  );
}

function Compose({ onDone }: { onDone: () => void }) {
  const { d, meId } = useStore();
  const now = new Date(), nowS = `${ymd(now)}T${hm(now)}`;
  const [f, setF] = useState({ what: "", start: nowS, end: "", where: PLACES[0], who: "", why: "", how: "", category: "作業" });
  const bad = f.end && f.end <= f.start ? "終了は開始より後にしてください" : "";
  return (
    <form className="card mb-4 space-y-3 p-4 print:hidden" onSubmit={(e) => { e.preventDefault(); if (bad) return; d({ t: "log-add", log: { id: `l${Date.now()}`, by: meId, ...f, end: f.end || undefined } }); onDone(); }}>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><label className="label" htmlFor="lw">何を（What）※必須</label><input id="lw" required className="input" placeholder="例：A社と契約内容の打合せ" value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></div>
        <div><label className="label" htmlFor="ls">いつ（開始）</label><input id="ls" type="datetime-local" required className="input tabular" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
        <div><label className="label" htmlFor="le">終了（任意）</label><input id="le" type="datetime-local" className="input tabular" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
        <div><label className="label" htmlFor="lp">どこで（Where）</label><input id="lp" list="places" className="input" value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} /><datalist id="places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist></div>
        <div><label className="label" htmlFor="lo">誰が・誰と（Who）</label><input id="lo" className="input" placeholder="自分／相手の名前" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} /></div>
        <div><label className="label" htmlFor="lc">分類</label><select id="lc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div />
        <div className="md:col-span-2"><label className="label" htmlFor="ly">なぜ（Why）</label><input id="ly" className="input" placeholder="目的・背景" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="lh">どのように（How）</label><input id="lh" className="input" placeholder="方法・手段・結果" value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} /></div>
      </div>
      {bad && <p role="alert" className="text-[12.5px] text-bad">{bad}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onDone}>キャンセル</button><button className="btn btn-primary" disabled={!!bad}>保存</button></div>
    </form>
  );
}
