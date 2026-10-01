"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { EVENT_CATEGORIES, addDays, addMonths, dowOf, eventTime, eventsOn, monthGrid, weekStart, type CalEvent } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { holidayName } from "@/lib/work";
import { Badge, PageHeader } from "@/components/ui";

type View = "day" | "week" | "month";
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const TONE: Record<string, string> = { 全社: "bg-brand/10 text-brand", 会議: "bg-blue-100 text-blue-800", 研修: "bg-emerald-100 text-emerald-800", "締め日・期日": "bg-amber-100 text-amber-800", 来客: "bg-purple-100 text-purple-800", "休業・休館": "bg-red-100 text-red-800", その他: "bg-surface-2 text-ink-2" };
const jp = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日（${DOW[dowOf(iso)]}）`;

export default function CalendarPage() {
  const { s, role } = useStore();
  const today = ymd(new Date());
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(today);
  const [edit, setEdit] = useState<CalEvent | "new" | null>(null);
  const editable = can.editCalendar(role);

  const move = (n: number) => setDate(view === "month" ? `${addMonths(date.slice(0, 7), n)}-01` : addDays(date, view === "week" ? 7 * n : n));
  const title = view === "month" ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月` : view === "week" ? `${jp(weekStart(date))} 〜 ${jp(addDays(weekStart(date), 6))}` : `${date.slice(0, 4)}年${jp(date)}`;
  const days = useMemo(() => view === "month" ? monthGrid(date.slice(0, 7)) : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)) : [date], [view, date]);
  const hol = (iso: string) => holidayName(iso, s.conditions);
  const upcoming = useMemo(() => s.events.filter((e) => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5), [s.events, today]);

  return (
    <div>
      <PageHeader title="業務カレンダー" sub="全社共通の予定（会議・研修・締め日・休業日など）。日・週・月で確認できます。"
        actions={editable ? <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />予定を登録</button> : undefined} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-2 p-1 text-[13px]" role="tablist" aria-label="表示単位">
          {([["day", "日"], ["week", "週"], ["month", "月"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-4 py-1 ${view === k ? "bg-white font-bold shadow-sm" : "text-ink-2"}`}>{l}</button>)}
        </div>
        <button className="btn !h-9 !w-9 !p-0" aria-label="前へ" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <button className="btn !h-9" onClick={() => setDate(today)}>今日</button>
        <button className="btn !h-9 !w-9 !p-0" aria-label="次へ" onClick={() => move(1)}><ChevronRight size={16} /></button>
        <h2 className="tabular text-[16px] font-bold" aria-live="polite">{title}</h2>
      </div>

      {view === "month" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] font-semibold">{DOW.map((w, i) => <div key={w} className={`py-1.5 ${i === 0 ? "text-bad" : i === 6 ? "text-blue-700" : ""}`}>{w}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((iso) => {
              const evs = eventsOn(s.events, iso), inMonth = iso.slice(0, 7) === date.slice(0, 7), h = hol(iso), w = dowOf(iso);
              return (
                <button key={iso} onClick={() => { setDate(iso); setView("day"); }} className={`min-h-[78px] border-b border-r border-line p-1 text-left align-top hover:bg-bg sm:min-h-[96px] ${inMonth ? "" : "bg-bg/60 text-ink-3"}`} aria-label={`${jp(iso)}の予定 ${evs.length}件`}>
                  <span className={`tabular inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] ${iso === today ? "bg-brand font-bold text-white" : h || w === 0 ? "text-bad" : w === 6 ? "text-blue-700" : ""}`}>{Number(iso.slice(8))}</span>
                  {h && <span className="ml-1 hidden text-[10.5px] text-bad sm:inline">{h}</span>}
                  <div className="mt-0.5 space-y-0.5">{evs.slice(0, 3).map((e) => <div key={e.id} className={`truncate rounded px-1 text-[11px] leading-5 ${TONE[e.category] ?? TONE["その他"]}`}>{e.start && <span className="tabular mr-1">{e.start}</span>}{e.title}</div>)}{evs.length > 3 && <div className="text-[11px] text-ink-3">ほか{evs.length - 3}件</div>}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view !== "month" && (
        <div className={`grid gap-3 ${view === "week" ? "md:grid-cols-7" : ""}`}>
          {days.map((iso) => {
            const evs = eventsOn(s.events, iso), h = hol(iso), w = dowOf(iso);
            return (
              <section key={iso} className={`card min-w-0 p-3 ${iso === today ? "ring-2 ring-brand/40" : ""}`} aria-label={jp(iso)}>
                <h3 className={`mb-2 flex items-center gap-1.5 text-[13px] font-bold ${h || w === 0 ? "text-bad" : w === 6 ? "text-blue-700" : ""}`}><button className="text-left hover:underline" onClick={() => { setDate(iso); setView("day"); }}>{jp(iso)}</button>{h && <Badge tone="bad">{h}</Badge>}</h3>
                {evs.length === 0 && <p className="py-3 text-[12.5px] text-ink-3">予定はありません</p>}
                <ul className="space-y-1.5">{evs.map((e) => (
                  <li key={e.id} className={`rounded-lg p-2 text-[13px] ${TONE[e.category] ?? TONE["その他"]}`}>
                    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="tabular text-[11.5px] opacity-80">{eventTime(e)}{e.endDate && e.endDate !== e.date ? `（〜${jp(e.endDate)}）` : ""}</div><div className="font-semibold">{e.title}</div>{e.note && <div className="mt-0.5 whitespace-pre-wrap text-[12px] opacity-90">{e.note}</div>}<div className="mt-0.5 text-[11px] opacity-70">{e.category}</div></div>
                      {editable && <div className="flex shrink-0 gap-1"><button className="rounded p-1 hover:bg-white/50" aria-label={`${e.title}を編集`} onClick={() => setEdit(e)}><Pencil size={13} /></button><DeleteBtn id={e.id} title={e.title} /></div>}</div>
                  </li>))}</ul>
              </section>
            );
          })}
        </div>
      )}
      {upcoming.length > 0 && view !== "day" && <section className="card mt-5 p-4"><h2 className="mb-2 font-bold">これからの予定</h2><ul className="space-y-1 text-[13px]">{upcoming.map((e) => <li key={e.id} className="flex gap-3"><span className="tabular w-28 shrink-0 text-ink-3">{jp(e.date)}</span><span className="tabular w-20 shrink-0 text-ink-3">{eventTime(e)}</span><span className="font-medium">{e.title}</span></li>)}</ul></section>}
      {!editable && <p className="mt-3 text-[12px] text-ink-3">予定の登録・変更は役員・管理者が行います。祝日・休業日は勤怠の休日マスタと同じです。</p>}
      {edit && <EventForm key={edit === "new" ? `new-${date}` : edit.id} init={edit === "new" ? null : edit} date={date} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DeleteBtn({ id, title }: { id: string; title: string }) {
  const { d, meId } = useStore();
  return <button className="rounded p-1 hover:bg-white/50" aria-label={`${title}を削除`} onClick={() => confirm(`「${title}」を削除しますか？`) && d({ t: "ev-del", id, by: meId })}><Trash2 size={13} /></button>;
}

function EventForm({ init, date, onClose }: { init: CalEvent | null; date: string; onClose: () => void }) {
  const { d, meId } = useStore();
  const [f, setF] = useState({ title: init?.title ?? "", date: init?.date ?? date, endDate: init?.endDate ?? "", allDay: !init?.start, start: init?.start ?? "10:00", end: init?.end ?? "11:00", category: init?.category ?? "全社", note: init?.note ?? "" });
  const bad = (f.endDate && f.endDate < f.date) || (!f.allDay && f.end && f.end <= f.start && !f.endDate);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="予定の登録" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault(); if (bad) return;
        d({ t: "ev-save", by: meId, ev: { id: init?.id ?? `ev${Date.now()}`, title: f.title.trim(), date: f.date, ...(f.endDate && f.endDate !== f.date ? { endDate: f.endDate } : {}), ...(f.allDay ? {} : { start: f.start, end: f.end || undefined }), category: f.category, ...(f.note.trim() ? { note: f.note.trim() } : {}), by: init?.by ?? meId } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? "予定を編集" : "予定を登録"}（全社共通）</h2>
        <div><label className="label" htmlFor="et">件名</label><input id="et" required maxLength={120} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ed">開始日</label><input id="ed" type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className="label" htmlFor="ee">終了日（複数日のとき）</label><input id="ee" type="date" className="input" value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />終日</label>
        {!f.allDay && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="es">開始時刻</label><input id="es" type="time" required className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label" htmlFor="en">終了時刻</label><input id="en" type="time" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div>}
        <div><label className="label" htmlFor="ec">分類</label><select id="ec" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="eno">メモ</label><textarea id="eno" rows={3} maxLength={500} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {bad && <p role="alert" className="text-[13px] text-bad">終了が開始より前になっています。</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!!bad}>保存</button></div>
      </form>
    </div>
  );
}
