"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, DoorOpen, Eye, EyeOff, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { EVENT_CATEGORIES, addDays, addMonths, dowOf, eventTime, eventsOn, monthGrid, weekStart, type CalEvent } from "@/lib/biz";
import { SCHED_KINDS, SCHED_VIS, busyAttendees, deptOf, maskSched, roomConflict, schedOrder, viewerOf, type Room, type Sched, type SchedVis } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { holidayName } from "@/lib/work";
import { googleCalendarUrl, icsOf, outlookCalendarUrl, type CalItem } from "@/lib/calendar-links";
import { Pager, usePaged } from "@/components/Pager";
import { Badge, PageHeader } from "@/components/ui";

type View = "day" | "week" | "month";
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const TONE: Record<string, string> = { 全社: "bg-brand/10 text-brand", 会議: "bg-blue-100 text-blue-800", 研修: "bg-emerald-100 text-emerald-800", "締め日・期日": "bg-amber-100 text-amber-800", 来客: "bg-purple-100 text-purple-800", "休業・休館": "bg-red-100 text-red-800", その他: "bg-surface-2 text-ink-2", 商談: "bg-orange-100 text-orange-800", 個人: "bg-sky-100 text-sky-800", 外出: "bg-teal-100 text-teal-800", 非公開: "bg-surface-2 text-ink-3" };
const jp = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日（${DOW[dowOf(iso)]}）`;

/** 画面に並べる1件（全社行事 or 個人の予定） */
type Item = { key: string; title: string; start?: string; end?: string; tone: string; ev?: CalEvent; sc?: Sched };
const byTime = (a: Item, b: Item) => schedOrder({ start: a.start, title: a.title }, { start: b.start, title: b.title }); // 時刻順（上から）→終日は下

export default function CalendarPage() {
  const { s, d, role, me, meId, nameOf } = useStore();
  const today = ymd(new Date());
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(today);
  const [edit, setEdit] = useState<CalEvent | "new" | null>(null);
  const [sched, setSched] = useState<Sched | "new" | null>(null);
  const [rooms, setRooms] = useState(false);
  const [who, setWho] = useState("all"), [showRooms, setShowRooms] = useState(true);
  const editable = can.editCalendar(role);
  const viewer = useMemo(() => viewerOf(me), [me]);
  const depOf = useMemo(() => (id: string) => deptOf(s.employees.find((e) => e.id === id)), [s.employees]);
  const depts = useMemo(() => [...new Set(s.employees.map((e) => deptOf(e)))].sort(), [s.employees]);
  // 見てよい形にそろえる（鍵や他事業部の予定は「予定あり」の時間帯だけ）
  const list = useMemo(() => s.sched.map((x) => maskSched(x, viewer, depOf)), [s.sched, viewer, depOf]);
  const roomName = (id?: string) => s.rooms.find((r) => r.id === id)?.name ?? "";
  const mine = (x: Sched, pid: string) => (x.masked ? (x.busyIds ?? []).includes(pid) : x.ownerId === pid || x.attendees.includes(pid));
  const match = (x: Sched) => who === "all" ? true : who === "me" ? mine(x, meId) : who.startsWith("dept:") ? s.employees.filter((e) => deptOf(e) === who.slice(5)).some((e) => mine(x, e.id)) : mine(x, who.slice(4));

  const itemsOn = (iso: string): Item[] => [
    ...eventsOn(s.events, iso).map((e): Item => ({ key: `e-${e.id}`, title: e.title, start: e.start, end: e.end, tone: e.category, ev: e })),
    ...list.filter((x) => x.date === iso && match(x) && (showRooms || !x.roomId || x.ownerId === meId || mine(x, meId))).map((x): Item => ({ key: `s-${x.id}`, title: x.title, start: x.start, end: x.end, tone: x.masked ? "非公開" : x.kind, sc: x })),
  ].sort(byTime);

  const move = (n: number) => setDate(view === "month" ? `${addMonths(date.slice(0, 7), n)}-01` : addDays(date, view === "week" ? 7 * n : n));
  const title = view === "month" ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月` : view === "week" ? `${jp(weekStart(date))} 〜 ${jp(addDays(weekStart(date), 6))}` : `${date.slice(0, 4)}年${jp(date)}`;
  const days = useMemo(() => view === "month" ? monthGrid(date.slice(0, 7)) : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)) : [date], [view, date]);
  const hol = (iso: string) => holidayName(iso, s.conditions);

  return (
    <div>
      <PageHeader title="業務カレンダー" sub="全社の行事に加え、全員のスケジュールと会議室の予約状況を確認できます。見られたくない予定は🔒鍵で非公開にできます。"
        actions={<div className="flex flex-wrap gap-2">{editable && <button className="btn" onClick={() => setEdit("new")}><Plus size={15} />全社行事を登録</button>}<button className="btn btn-primary" onClick={() => setSched("new")}><Plus size={15} />予定・会議を登録</button></div>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-2 p-1 text-[13px]" role="tablist" aria-label="表示単位">
          {([["day", "日"], ["week", "週"], ["month", "月"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-4 py-1 ${view === k ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>{l}</button>)}
        </div>
        <button className="btn !h-9 !w-9 !p-0" aria-label="前へ" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <button className="btn !h-9" onClick={() => setDate(today)}>今日</button>
        <button className="btn !h-9 !w-9 !p-0" aria-label="次へ" onClick={() => move(1)}><ChevronRight size={16} /></button>
        <h2 className="tabular text-[16px] font-bold" aria-live="polite">{title}</h2>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2.5 text-[13px]">
        <Users size={15} className="text-ink-3" aria-hidden /><label htmlFor="who" className="font-medium">表示する人</label>
        <select id="who" className="input !h-8 !w-auto" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">全員（全部署）</option><option value="me">自分だけ</option>
          <optgroup label="部署ごと">{depts.map((x) => <option key={x} value={`dept:${x}`}>{x}</option>)}</optgroup>
          <optgroup label="個人ごと">{s.employees.filter((e) => !e.left).map((e) => <option key={e.id} value={`emp:${e.id}`}>{e.name}（{deptOf(e)}）</option>)}</optgroup>
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showRooms} onChange={(e) => setShowRooms(e.target.checked)} />会議室を使う予定も表示</label>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-ink-3"><Lock size={12} aria-hidden />鍵の予定は、本人と招待された人以外には「予定あり」の時間帯だけ表示されます</span>
      </div>

      {view === "month" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] font-semibold">{DOW.map((w, i) => <div key={w} className={`py-1.5 ${i === 0 ? "text-bad" : i === 6 ? "text-blue-700" : ""}`}>{w}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((iso) => {
              const evs = itemsOn(iso), inMonth = iso.slice(0, 7) === date.slice(0, 7), h = hol(iso), w = dowOf(iso);
              return (
                <button key={iso} onClick={() => { setDate(iso); setView("day"); }} className={`min-h-[78px] border-b border-r border-line p-1 text-left align-top hover:bg-bg sm:min-h-[96px] ${inMonth ? "" : "bg-bg/60 text-ink-3"}`} aria-label={`${jp(iso)}の予定${evs.length}件`}>
                  <span className={`tabular inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] ${iso === today ? "bg-brand font-bold text-white" : h || w === 0 ? "text-bad" : w === 6 ? "text-blue-700" : ""}`}>{Number(iso.slice(8))}</span>
                  {h && <span className="ml-1 hidden text-[10.5px] text-bad sm:inline">{h}</span>}
                  <div className="mt-0.5 space-y-0.5">{evs.slice(0, 3).map((e) => <div key={e.key} className={`truncate rounded px-1 text-[11px] leading-5 ${TONE[e.tone] ?? TONE["その他"]}`}>{e.sc?.vis === "鍵" && <Lock size={10} className="mr-0.5 inline" aria-label="鍵" />}{e.start && <span className="tabular mr-1">{e.start}</span>}{e.title}</div>)}{evs.length > 3 && <div className="px-1 text-[10.5px] text-ink-3">ほか{evs.length - 3}件</div>}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((iso) => <DayCard key={iso} iso={iso} items={itemsOn(iso)} today={today} hol={hol(iso)} compact onOpen={() => { setDate(iso); setView("day"); }} ctx={{ roomName, nameOf, meId, role, editable, setEdit, setSched, d }} />)}
        </div>
      )}

      {view === "day" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><DayCard iso={date} items={itemsOn(date)} today={today} hol={hol(date)} ctx={{ roomName, nameOf, meId, role, editable, setEdit, setSched, d }} paged /></div>
          <RoomsPanel iso={date} list={list} rooms={s.rooms} nameOf={nameOf} admin={role === "admin"} onManage={() => setRooms(true)} onBook={() => setSched("new")} />
        </div>
      )}

      {!editable && <p className="mt-3 text-[12px] text-ink-3">全社行事の登録・変更は役員・管理者が行います。個人の予定・会議は、どなたでも自分の名義で登録できます。祝日・休業日は勤怠の休日マスタと同じです。</p>}
      {edit && <EventForm key={edit === "new" ? `new-${date}` : edit.id} init={edit === "new" ? null : edit} date={date} onClose={() => setEdit(null)} />}
      {sched && <SchedForm key={sched === "new" ? `s-${date}` : sched.id} init={sched === "new" ? null : sched} date={date} list={list} onClose={() => setSched(null)} />}
      {rooms && <RoomManager onClose={() => setRooms(false)} />}
    </div>
  );
}

type Ctx = { roomName: (id?: string) => string; nameOf: (id: string) => string; meId: string; role: string; editable: boolean; setEdit: (e: CalEvent) => void; setSched: (x: Sched) => void; d: ReturnType<typeof useStore>["d"] };

function DayCard({ iso, items, today, hol, compact = false, paged = false, onOpen, ctx }: { iso: string; items: Item[]; today: string; hol?: string; compact?: boolean; paged?: boolean; onOpen?: () => void; ctx: Ctx }) {
  const w = dowOf(iso), pg = usePaged(items, 10, iso);
  const shown = paged ? pg.items : items;
  return (
    <section className={`card min-w-0 ${compact ? "p-3" : "p-4"} ${iso === today ? "ring-2 ring-brand/40" : ""}`} aria-label={jp(iso)}>
      <h3 className={`mb-2 flex items-center gap-1.5 text-[13px] font-bold ${hol || w === 0 ? "text-bad" : w === 6 ? "text-blue-700" : ""}`}>{onOpen ? <button className="text-left hover:underline" onClick={onOpen}>{jp(iso)}</button> : jp(iso)}{iso === today && <Badge tone="brand">今日</Badge>}{hol && <span className="text-[11px] font-normal">{hol}</span>}</h3>
      {items.length === 0 && <p className="py-3 text-[12.5px] text-ink-3">予定はありません</p>}
      <ul className="space-y-1.5">{shown.map((it) => <ItemRow key={it.key} it={it} ctx={ctx} compact={compact} />)}</ul>
      {paged && <div className="-mx-4 -mb-4 mt-2"><Pager pg={pg} /></div>}
    </section>
  );
}

/** Google / Outlook のカレンダーに追加、または .ics をダウンロード */
function CalAdd({ item, id }: { item: CalItem; id: string }) {
  const dl = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([icsOf([{ ...item, id }])], { type: "text/calendar;charset=utf-8" })); a.download = `${item.title.slice(0, 20)}.ics`; a.click(); URL.revokeObjectURL(a.href); };
  const cls = "rounded px-1.5 py-0.5 text-[11px] underline hover:bg-white/50";
  return <span className="flex items-center" aria-label={`${item.title}をカレンダーに追加`}><a className={cls} href={googleCalendarUrl(item)} target="_blank" rel="noopener noreferrer">Google</a><a className={cls} href={outlookCalendarUrl(item)} target="_blank" rel="noopener noreferrer">Outlook</a><button type="button" className={cls} onClick={dl}>.ics</button></span>;
}

function ItemRow({ it, ctx, compact }: { it: Item; ctx: Ctx; compact: boolean }) {
  const [show, setShow] = useState(false); // 備考は「確認する」を押したときだけ表示
  const { ev, sc } = it, { roomName, nameOf, meId, role, editable, setEdit, setSched, d } = ctx;
  const note = ev?.note ?? sc?.note;
  // 内容が伏せられた予定（鍵・マスク）は、カレンダーへ書き出さない
  const cal: CalItem | null = ev ? { title: ev.title, date: ev.date, endDate: ev.endDate, start: ev.start, end: ev.end, note: ev.note } : sc && !sc.masked ? { title: sc.title, date: sc.date, start: sc.start, end: sc.end, note: sc.note, location: sc.roomId ? roomName(sc.roomId) : undefined } : null;
  const own = !!sc && sc.ownerId === meId, canDel = own || (!!sc && role === "admin");
  return (
    <li className={`rounded-lg p-2 text-[13px] ${TONE[it.tone] ?? TONE["その他"]}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="tabular text-[11.5px] opacity-80">{ev ? eventTime(ev) : it.start ? `${it.start}${it.end ? `–${it.end}` : ""}` : "終日"}{ev?.endDate && ev.endDate !== ev.date ? `（〜${jp(ev.endDate)}）` : ""}</div>
          <div className="font-semibold">{sc?.vis === "鍵" && <Lock size={12} className="mr-1 inline" aria-label="鍵（非公開）" />}{it.title}</div>
          {sc && !compact && <div className="mt-0.5 text-[12px] opacity-90">{nameOf(sc.ownerId)}{sc.masked ? "" : sc.attendees.length ? `　＋${sc.attendees.map(nameOf).join("・")}` : ""}{sc.roomId && <span className="ml-1.5 inline-flex items-center gap-0.5"><DoorOpen size={11} aria-hidden />{roomName(sc.roomId) || "会議室"}</span>}</div>}
          {sc && compact && <div className="truncate text-[11.5px] opacity-90">{nameOf(sc.ownerId)}</div>}
          {note && <div className="mt-1">{show ? <p className="whitespace-pre-wrap rounded bg-white/60 px-2 py-1 text-[12px] text-ink">{note}</p> : null}<button type="button" className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] underline" aria-expanded={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={11} /> : <Eye size={11} />}{show ? "備考を閉じる" : "備考を確認する"}</button></div>}
        </div>
        <div className="flex shrink-0 gap-1">
          {cal && !compact && <CalAdd item={cal} id={it.key} />}
          {ev && editable && <><button className="rounded p-1 hover:bg-white/50" aria-label={`${ev.title}を編集`} onClick={() => setEdit(ev)}><Pencil size={13} /></button><button className="rounded p-1 hover:bg-white/50" aria-label={`${ev.title}を削除`} onClick={() => confirm(`「${ev.title}」を削除しますか？`) && d({ t: "ev-del", id: ev.id, by: meId })}><Trash2 size={13} /></button></>}
          {sc && own && <button className="rounded p-1 hover:bg-white/50" aria-label={`${sc.title}を編集`} onClick={() => setSched(sc)}><Pencil size={13} /></button>}
          {sc && canDel && <button className="rounded p-1 hover:bg-white/50" aria-label={`${it.title}を削除`} onClick={() => confirm(`「${it.title}」を削除しますか？`) && d({ t: "sched-del", id: sc.id, by: meId })}><Trash2 size={13} /></button>}
        </div>
      </div>
    </li>
  );
}

/** 会議室の予約状況（その日）。時刻順に上から、終日は下 */
function RoomsPanel({ iso, list, rooms, nameOf, admin, onManage, onBook }: { iso: string; list: Sched[]; rooms: Room[]; nameOf: (id: string) => string; admin: boolean; onManage: () => void; onBook: () => void }) {
  return (
    <section className="card h-fit p-4" aria-label="会議室の予約状況">
      <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 font-bold"><DoorOpen size={16} aria-hidden />会議室の予約状況</h3>{admin && <button className="text-[12px] text-brand-2 underline" onClick={onManage}>会議室の管理</button>}</div>
      <p className="mb-2 text-[12px] text-ink-3">{jp(iso)}</p>
      <ul className="space-y-3">
        {rooms.map((r) => {
          const bk = list.filter((x) => x.roomId === r.id && x.date === iso).sort(schedOrder);
          return (
            <li key={r.id}><div className="mb-1 flex items-center gap-2 text-[13px] font-semibold">{r.name}{r.capacity ? <span className="text-[11px] font-normal text-ink-3">{r.capacity}名</span> : null}{bk.length === 0 && <Badge tone="good">空き</Badge>}</div>
              <ul className="space-y-1">{bk.map((x) => <li key={x.id} className="tabular flex items-center gap-2 rounded bg-surface-2 px-2 py-1 text-[12px]">{x.vis === "鍵" && <Lock size={11} aria-label="鍵" />}<span>{x.start ? `${x.start}–${x.end ?? ""}` : "終日"}</span><span className="truncate">{x.masked ? "予約済" : x.title}（{nameOf(x.ownerId)}）</span></li>)}</ul></li>
          );
        })}
        {rooms.length === 0 && <li className="text-[12.5px] text-ink-3">会議室が登録されていません。</li>}
      </ul>
      <button className="btn mt-3 w-full" onClick={onBook}><Plus size={14} />会議室を予約する</button>
    </section>
  );
}

function RoomManager({ onClose }: { onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [name, setName] = useState(""), [cap, setCap] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="会議室の管理" onClick={onClose}>
      <div className="card w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">会議室の管理</h2>
        <ul className="divide-y divide-line">{s.rooms.map((r) => <li key={r.id} className="flex items-center gap-2 py-1.5 text-[13px]"><span className="flex-1">{r.name}{r.capacity ? `（${r.capacity}名）` : ""}</span><button className="btn btn-danger !h-7 !w-7 !p-0" aria-label={`${r.name}を削除`} onClick={() => confirm(`「${r.name}」を削除しますか？（この会議室の予約は残ります）`) && d({ t: "room-del", id: r.id, by: meId })}><Trash2 size={13} /></button></li>)}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; d({ t: "room-save", by: meId, room: { id: `room-${Date.now()}`, name: name.trim(), ...(cap && Number(cap) > 0 ? { capacity: Number(cap) } : {}) } }); setName(""); setCap(""); }}>
          <input className="input" placeholder="会議室の名前" aria-label="会議室の名前" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input !w-20" inputMode="numeric" placeholder="定員" aria-label="定員" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} />
          <button className="btn btn-primary shrink-0">追加</button>
        </form>
        <div className="flex justify-end"><button className="btn" onClick={onClose}>閉じる</button></div>
      </div>
    </div>
  );
}

const VIS_HELP: Record<SchedVis, string> = { 全社: "全員が内容を見られます", 事業部: "同じ事業部の人と役員だけが内容を見られます（他の人には「予定あり」）", 鍵: "本人と招待した人だけ。他の人には「予定あり」の時間帯のみ" };

function SchedForm({ init, date, list, onClose }: { init: Sched | null; date: string; list: Sched[]; onClose: () => void }) {
  const { s, d, meId, nameOf } = useStore();
  const [newId] = useState(() => `sc${Date.now()}`);
  const [f, setF] = useState({ title: init?.title ?? "", date: init?.date ?? date, allDay: init ? !init.start : false, start: init?.start ?? "10:00", end: init?.end ?? "11:00", kind: init?.kind ?? "会議" as Sched["kind"], vis: init?.vis ?? "全社" as SchedVis, roomId: init?.roomId ?? "", note: init?.note ?? "", attendees: init?.attendees ?? [] as string[] });
  const [q, setQ] = useState("");
  const draft: Sched = { id: init?.id ?? newId, title: f.title.trim(), date: f.date, ...(f.allDay ? {} : { start: f.start, end: f.end }), ownerId: init?.ownerId ?? meId, attendees: f.attendees, ...(f.roomId ? { roomId: f.roomId } : {}), kind: f.kind, vis: f.vis, ...(f.note.trim() ? { note: f.note.trim() } : {}), at: init?.at ?? new Date().toISOString() };
  const timeBad = !f.allDay && (!f.start || !f.end || f.end <= f.start);
  const roomBad = !!f.roomId && f.allDay;
  const clash = !roomBad && !timeBad ? roomConflict(list, draft) : undefined;
  const busy = !timeBad && !f.allDay ? busyAttendees(list, draft) : [];
  const people = s.employees.filter((e) => !e.left && e.id !== (init?.ownerId ?? meId) && `${e.name}${e.dept ?? ""}`.includes(q));
  const toggle = (id: string) => setF((x) => ({ ...x, attendees: x.attendees.includes(id) ? x.attendees.filter((a) => a !== id) : [...x.attendees, id] }));
  const ok = f.title.trim() && !timeBad && !roomBad && !clash;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="予定の登録" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) { d({ t: "sched-save", by: meId, item: draft }); onClose(); } }}>
        <h2 className="text-lg font-bold">{init ? "予定を編集" : "予定・会議を登録"}</h2>
        <div><label className="label" htmlFor="st">件名</label><input id="st" required maxLength={120} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="sd">日付</label><input id="sd" type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className="label" htmlFor="sk">種類</label><select id="sk" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Sched["kind"] })}>{SCHED_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
          <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />終日</label>
        </div>
        {!f.allDay && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="ss">開始</label><input id="ss" type="time" required className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label" htmlFor="se">終了</label><input id="se" type="time" required className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div>}
        {timeBad && <p role="alert" className="text-[13px] text-bad">終了は開始より後の時刻にしてください。</p>}

        <fieldset className="rounded-lg border border-line p-3"><legend className="px-1 text-[13px] font-semibold">誰に見せる？（閲覧権限）</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">{SCHED_VIS.map((v) => <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[13px] ${f.vis === v ? "border-brand bg-brand-soft font-bold" : "border-line"}`}><input type="radio" name="vis" checked={f.vis === v} onChange={() => setF({ ...f, vis: v })} />{v === "鍵" && <Lock size={13} aria-hidden />}{v === "鍵" ? "鍵（非公開）" : v === "事業部" ? "自事業部" : "全社"}</label>)}</div>
          <p className="mt-1.5 text-[12px] text-ink-3">{VIS_HELP[f.vis]}</p>
        </fieldset>

        <div><div className="label">参加者（この人のスケジュールも押さえる）{f.attendees.length > 0 && <span className="ml-1 font-normal text-ink-3">{f.attendees.length}名</span>}</div>
          <input className="input mb-1.5" placeholder="名前・部署で絞り込み" aria-label="参加者を絞り込み" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-line p-1.5 sm:grid-cols-2">{people.map((e) => <li key={e.id}><label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-surface-2"><input type="checkbox" checked={f.attendees.includes(e.id)} onChange={() => toggle(e.id)} />{e.name}<span className="text-[11px] text-ink-3">{deptOf(e)}</span></label></li>)}{people.length === 0 && <li className="p-2 text-[12.5px] text-ink-3">該当者がいません</li>}</ul>
          {busy.length > 0 && <p role="status" className="mt-1.5 rounded bg-warn-soft px-2 py-1 text-[12.5px] text-warn">この時間にすでに予定がある人：{busy.map(nameOf).join("、")}（そのまま登録もできます）</p>}
        </div>

        <div><label className="label" htmlFor="sr">会議室</label>
          <select id="sr" className="input" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">使わない</option>{s.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? `（${r.capacity}名）` : ""}</option>)}</select>
          {roomBad && <p role="alert" className="mt-1 text-[12.5px] text-bad">会議室の予約には、開始・終了時刻が必要です（終日は選べません）。</p>}
          {clash && <p role="alert" className="mt-1 text-[12.5px] text-bad">その時間は{s.rooms.find((r) => r.id === f.roomId)?.name}が予約済みです（{clash.start}–{clash.end}）。時間か会議室を変えてください。</p>}
        </div>
        <div><label className="label" htmlFor="sn">備考（見る人は「備考を確認する」を押して開きます）</label><textarea id="sn" rows={3} maxLength={500} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok}>保存</button></div>
      </form>
    </div>
  );
}

function EventForm({ init, date, onClose }: { init: CalEvent | null; date: string; onClose: () => void }) {
  const { d, meId } = useStore();
  const [f, setF] = useState({ title: init?.title ?? "", date: init?.date ?? date, endDate: init?.endDate ?? "", allDay: !init?.start, start: init?.start ?? "10:00", end: init?.end ?? "11:00", category: init?.category ?? "全社", note: init?.note ?? "" });
  const bad = (f.endDate && f.endDate < f.date) || (!f.allDay && f.end && f.end <= f.start && !f.endDate);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="全社行事の登録" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault(); if (bad) return;
        d({ t: "ev-save", by: meId, ev: { id: init?.id ?? `ev${Date.now()}`, title: f.title.trim(), date: f.date, ...(f.endDate && f.endDate !== f.date ? { endDate: f.endDate } : {}), ...(f.allDay ? {} : { start: f.start, end: f.end || undefined }), category: f.category, ...(f.note.trim() ? { note: f.note.trim() } : {}), by: init?.by ?? meId } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? "全社行事を編集" : "全社行事を登録"}（全員に表示）</h2>
        <div><label className="label" htmlFor="et">件名</label><input id="et" required maxLength={120} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ed">開始日</label><input id="ed" type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className="label" htmlFor="ee">終了日（複数日のとき）</label><input id="ee" type="date" className="input" value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />終日</label>
        {!f.allDay && <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="es">開始時刻</label><input id="es" type="time" required className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label" htmlFor="ef">終了時刻</label><input id="ef" type="time" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div>}
        <div><label className="label" htmlFor="ec">分類</label><select id="ec" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="eno">備考</label><textarea id="eno" rows={3} maxLength={500} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {bad && <p role="alert" className="text-[13px] text-bad">終了が開始より前になっています。</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!!bad}>保存</button></div>
      </form>
    </div>
  );
}

