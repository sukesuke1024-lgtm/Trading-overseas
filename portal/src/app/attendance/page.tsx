"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { HOLIDAYS_2026, calcDay, dayKind, fmtHM, leaveBalance, lastGrantDate, overtimeLevel, summarize, STD_END, STD_START } from "@/lib/attendance-calc";
import { LEAVE_SEED, empById } from "@/lib/data";
import { download } from "@/lib/csv";
import { CATEGORIES, buildEvents, markdown, notionCsv, type LogRec } from "@/lib/w5h";
import { leaveDatesOf, useStore, ymd, type Punch } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";
import { PLACES, PunchCard } from "@/components/PunchCard";
import { W5hCard, type W5hItem } from "@/components/w5h";
import { PrintButton, PrintHeader } from "@/components/report";

const DOW = "日月火水木金土";
const NO_PUNCH: Record<string, Punch> = {};

export default function Attendance() {
  const { s, d, meId } = useStore();
  const me = empById(meId)!;
  const today = new Date();
  const [off, setOff] = useState(0);
  const [edit, setEdit] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const base = new Date(today.getFullYear(), today.getMonth() + off, 1);
  const days = Array.from({ length: new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate() }, (_, i) => ymd(new Date(base.getFullYear(), base.getMonth(), i + 1)));
  const todayS = ymd(today);
  const punches = s.punches[meId] ?? NO_PUNCH;

  const leave = leaveDatesOf(s.workflows, meId);
  const pending = leaveDatesOf(s.workflows, meId, ["承認待ち"]);
  const sum = summarize(days, punches, leave, todayS);
  const lv = overtimeLevel(sum.overtime, sum.legalHoliday);
  const otH = sum.overtime / 60;

  // 有給：現在の付与期間（直近付与日〜次回付与日）
  const { last, next } = lastGrantDate(me.joined, todayS);
  const inPeriod = (dt: string) => dt >= ymd(last) && dt < ymd(next);
  const taken = [...leave].filter((x) => inPeriod(x) && x <= todayS).length;
  const planned = [...leave].filter((x) => inPeriod(x) && x > todayS).length;
  const bal = leaveBalance(me.joined, todayS, LEAVE_SEED.usedBefore + taken + planned, LEAVE_SEED.carryOver);
  const monthFrom = ymd(base), monthTo = `${monthFrom.slice(0, 7)}-31`;
  const events = buildEvents({ meId, name: (id) => empById(id)?.name ?? id, punches, workflows: s.workflows, logs: s.logs }, monthFrom, monthTo);
  const tone = lv.level === "danger" ? "bad" : lv.level === "warn" || lv.level === "notice" ? "warn" : "brand";

  return (
    <div>
      <PageHeader title="勤怠" sub="打刻と同時に5W1H（いつ・どこで・誰と・何を・なぜ・どのように）を記録。休憩・時間外・深夜・有給は自動計算します（所定 9:00〜18:00／休憩1時間／日曜＝法定休日）。" />
      <PrintHeader title="勤務実績（5W1H）" period={`${base.getFullYear()}年${base.getMonth() + 1}月`} />
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 print:hidden">
        <PunchCard />
        <section className="card p-4 lg:col-span-2" aria-label="時間外労働">
          <div className="mb-1 flex items-center justify-between"><span className="font-bold">時間外労働（36協定管理）</span><span className="tabular text-[13px]"><b>{otH.toFixed(1)}h</b> / 上限45h</span></div>
          <div className="relative"><Progress value={(otH / 45) * 100} tone={tone} /></div>
          <div className="mt-1 flex justify-between text-[11.5px] text-ink-3"><span>0</span><span>36h（注意）</span><span>45h</span></div>
          {lv.level !== "ok" && <p className={`mt-2 flex items-start gap-1.5 text-[12.5px] ${lv.level === "danger" ? "text-bad" : "text-warn"}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{lv.message}</p>}
          <p className="mt-2 text-[12.5px] text-ink-2">月末までの見込み：<b className="tabular">{fmtHM(sum.projectedOvertime)}</b>{sum.projectedOvertime / 60 >= 45 && <span className="ml-2 font-semibold text-warn">上限超過の見込み</span>}</p>
          <p className="mt-1 text-[11.5px] text-ink-3">特別条項：年6回まで月100時間未満（休日労働含む）・年720時間以内。月80時間超は産業医面談の対象。</p>
        </section>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[["出勤日数", `${sum.days}日`], ["総実働", fmtHM(sum.work)], ["所定内", fmtHM(sum.scheduled)], ["時間外", fmtHM(sum.overtime)], ["深夜", fmtHM(sum.night)], ["法定休日", fmtHM(sum.legalHoliday)], ["遅刻/早退", `${sum.lateCount}/${sum.earlyCount}`], ["有休（月）", `${sum.leaveDays}日`]].map(([l, v]) => (
          <div key={l} className="card px-3 py-2.5"><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-lg font-bold">{v}</div></div>
        ))}
      </div>

      <section className="card mb-5 p-4" aria-label="年次有給休暇">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-bold">年次有給休暇</h2><span className="text-[12px] text-ink-3">入社 {me.joined}・次回付与日 {bal.nextGrantDate}</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["今期付与", `${bal.granted}日`], ["繰越", `${bal.carry}日`], ["取得済", `${LEAVE_SEED.usedBefore + taken}日`], ["取得予定", `${planned}日`], ["残日数", `${bal.remaining}日`]].map(([l, v], i) => (
            <div key={l} className={`rounded-lg px-3 py-2 ${i === 4 ? "bg-brand-soft" : "bg-surface-2"}`}><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-xl font-bold">{v}</div></div>
          ))}
        </div>
        <div className="mt-3 space-y-1 text-[12.5px]">
          {bal.granted >= 10 && <p className={bal.mustTake > 0 ? "text-warn" : "text-good"}>年5日の取得義務：{bal.mustTake > 0 ? `あと${bal.mustTake}日の取得が必要です（付与日から1年以内）。` : "達成済みです。"}</p>}
          {bal.expiring > 0 && <p className="text-warn">繰越分のうち {bal.expiring}日 は、次回付与日（{bal.nextGrantDate}）に時効（付与から2年）で失効します。</p>}
          {pending.size > 0 && <p className="text-ink-3">承認待ちの休暇：{pending.size}日（承認後に反映）</p>}
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">{base.getFullYear()}年{base.getMonth() + 1}月の勤務実績</h2>
        <div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label="前月" onClick={() => setOff(off - 1)}><ChevronLeft size={16} /></button><button className="btn !h-8 !px-2 text-[12px]" onClick={() => setOff(0)}>今月</button><button className="btn !h-8 !w-8 !p-0" aria-label="翌月" onClick={() => setOff(off + 1)}><ChevronRight size={16} /></button></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead><tr><th className="th">日付</th><th className="th">出勤</th><th className="th">退勤</th><th className="th text-right">休憩</th><th className="th text-right">実働</th><th className="th text-right">時間外</th><th className="th text-right">深夜</th><th className="th">備考 / 5W1H</th><th className="th w-16"><span className="sr-only">5W1H・修正</span></th></tr></thead>
          <tbody>
            {days.map((k) => {
              const dt = new Date(`${k}T00:00:00`), w = dt.getDay(), kind = dayKind(k);
              const p = punches[k], c = calcDay(k, p), isLeave = leave.has(k), isToday = k === todayS, future = k > todayS;
              const dayLogs = s.logs.filter((l) => l.by === meId && l.start.slice(0, 10) === k);
              const has5 = !!(p?.what || p?.why || p?.how || p?.who) || dayLogs.length > 0;
              return (
                <Fragment key={k}>
                <tr className={`${kind !== "workday" ? "bg-bg text-ink-3" : ""} ${isToday ? "!bg-brand-soft" : ""}`}>
                  <td className="td tabular whitespace-nowrap">{dt.getMonth() + 1}/{dt.getDate()}（{DOW[w]}）</td>
                  <td className="td tabular">{isLeave ? "" : p?.in ?? ""}</td>
                  <td className="td tabular">{isLeave ? "" : p?.out ?? (p?.in && !isToday ? <span className="text-bad">未打刻</span> : "")}</td>
                  <td className="td tabular text-right">{c.breakMin ? `${c.breakMin}分` : ""}</td>
                  <td className="td tabular text-right">{c.work ? fmtHM(c.work) : ""}</td>
                  <td className="td tabular text-right">{c.overtime ? <span className={c.overtime > 120 ? "font-semibold text-warn" : ""}>{fmtHM(c.overtime)}</span> : ""}</td>
                  <td className="td tabular text-right">{c.night ? fmtHM(c.night) : ""}</td>
                  <td className="td whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {isLeave && <Badge tone="good">年休</Badge>}
                      {kind === "legal-off" && <span>法定休日{c.legalHoliday ? <Badge tone="warn">休日労働</Badge> : ""}</span>}
                      {kind === "prescribed-off" && <span>{HOLIDAYS_2026.has(k) ? "祝日" : "所定休日"}</span>}
                      {c.late && <Badge tone="warn">遅刻</Badge>}{c.early && <Badge tone="warn">早退</Badge>}
                      {p?.place && p.place !== "オフィス" && <Badge tone="brand">{p.place}</Badge>}
                      {p?.edited && <Badge>修正済</Badge>}
                    </div>
                  </td>
                  <td className="td"><div className="flex items-center gap-2">
                    {!isLeave && (p?.in || dayLogs.length > 0 || !future) && <button className={`flex items-center text-ink-3 hover:text-brand ${has5 ? "text-brand" : ""}`} aria-expanded={openDay === k} aria-label={`${k} の5W1Hを${openDay === k ? "閉じる" : "開く"}`} title="5W1H" onClick={() => setOpenDay(openDay === k ? null : k)}><ChevronDown size={15} className={openDay === k ? "rotate-180" : ""} /></button>}
                    {!future && !isLeave && <button className="text-ink-3 hover:text-brand" aria-label={`${k} を修正`} onClick={() => setEdit(k)}><Pencil size={14} /></button>}</div></td>
                </tr>
                {openDay === k && <tr className="bg-bg"><td colSpan={9} className="td"><DayDetail date={k} punch={p} logs={dayLogs} /></td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">休憩は法定最低（6時間超45分／8時間超60分）を自動控除。時間外は所定8時間超。所定休日（土・祝）の労働は全て時間外、日曜は法定休日労働として集計。深夜は22:00〜5:00。始業{STD_START}／終業{STD_END}。</p>
      <section className="card mt-5 p-4 print:hidden" aria-label="5W1H出力">
        <h2 className="mb-1 font-bold">5W1H の出力（{base.getFullYear()}年{base.getMonth() + 1}月・{events.length}件）</h2>
        <p className="mb-3 text-[12.5px] text-ink-2">打刻・申請・承認・行動メモをまとめて、いつ／どこで／誰が／何を／なぜ／どのように の形式で出力します。Notion の「Import → CSV」でそのままデータベースにできます。</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={!events.length} onClick={() => { download(`5W1H_${monthFrom.slice(0, 7)}.csv`, notionCsv(events)); d({ t: "export-log", by: meId, what: `5W1H CSV ${monthFrom.slice(0, 7)}` }); }}><Download size={14} />Notion用CSV</button>
          <button className="btn" disabled={!events.length} onClick={() => { download(`5W1H_${monthFrom.slice(0, 7)}.md`, markdown(events, `5W1H記録 ${monthFrom.slice(0, 7)}`), "text/markdown;charset=utf-8"); d({ t: "export-log", by: meId, what: `5W1H Markdown ${monthFrom.slice(0, 7)}` }); }}><FileText size={14} />Markdown</button>
          <PrintButton what={`勤怠 ${monthFrom.slice(0, 7)}`} />
        </div>
      </section>
      {edit && <EditDialog date={edit} punch={punches[edit]} onClose={() => setEdit(null)} onSave={(p, reason) => { d({ t: "punch", emp: meId, date: edit, p: { ...p, edited: true }, log: `打刻修正 ${edit}：${reason}` }); setEdit(null); }} />}
    </div>
  );
}

function EditDialog({ date, punch, onClose, onSave }: { date: string; punch?: Punch; onClose: () => void; onSave: (p: Punch, reason: string) => void }) {
  const [f, setF] = useState({ in: punch?.in ?? "", out: punch?.out ?? "", brk: punch?.break?.toString() ?? "", place: punch?.place ?? PLACES[0], what: punch?.what ?? "", who: punch?.who ?? "", why: punch?.why ?? "", how: punch?.how ?? "", reason: "" });
  const c = calcDay(date, { in: f.in, out: f.out, break: f.brk ? Number(f.brk) : undefined });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="打刻修正">
      <form className="card w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave({ in: f.in || undefined, out: f.out || undefined, break: f.brk ? Number(f.brk) : undefined, place: f.place, what: f.what, who: f.who, why: f.why, how: f.how }, f.reason); }}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">打刻の修正（{date}）</h2><button type="button" onClick={onClose} aria-label="閉じる"><X size={16} /></button></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="ei">出勤</label><input id="ei" type="time" className="input tabular" value={f.in} onChange={(e) => setF({ ...f, in: e.target.value })} /></div>
          <div><label className="label" htmlFor="eo">退勤</label><input id="eo" type="time" className="input tabular" value={f.out} onChange={(e) => setF({ ...f, out: e.target.value })} /></div>
          <div><label className="label" htmlFor="eb">休憩（分）</label><input id="eb" type="number" min={0} max={240} placeholder="自動" className="input tabular" value={f.brk} onChange={(e) => setF({ ...f, brk: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="ep">どこで（勤務場所）</label><select id="ep" className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })}>{PLACES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ew">何を</label><input id="ew" className="input" value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></div>
          <div><label className="label" htmlFor="eo2">誰と</label><input id="eo2" className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} /></div>
          <div><label className="label" htmlFor="ey">なぜ</label><input id="ey" className="input" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} /></div>
          <div><label className="label" htmlFor="eh">どのように</label><input id="eh" className="input" value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="er">修正理由（必須・監査ログに記録）</label><input id="er" required className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="例：打刻忘れ（客先直行）" /></div>
        {f.in && f.out && <p className="rounded-lg bg-bg p-2 text-[12.5px] text-ink-2">自動計算：実働 <b className="tabular">{fmtHM(c.work)}</b>（休憩 {c.breakMin}分）／時間外 <b className="tabular">{fmtHM(c.overtime)}</b>／深夜 <b className="tabular">{fmtHM(c.night)}</b>{f.brk && Number(f.brk) < c.breakMin && "（休憩は法定最低に補正）"}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary">保存</button></div>
      </form>
    </div>
  );
}

function DayDetail({ date, punch, logs }: { date: string; punch?: Punch; logs: LogRec[] }) {
  const { d, meId } = useStore();
  const [add, setAdd] = useState(false);
  const me = empById(meId)?.name ?? meId;
  const items: W5hItem[] = [
    { key: "when", label: "いつ（When）", value: punch?.in ? `${date} ${punch.in}〜${punch.out ?? "勤務中"}` : date },
    { key: "where", label: "どこで（Where）", value: punch?.place },
    { key: "who", label: "誰が・誰と（Who）", value: punch?.in ? (punch.who ? `${me}／${punch.who}` : me) : undefined },
    { key: "what", label: "何を（What）", value: punch?.what },
    { key: "why", label: "なぜ（Why）", value: punch?.why },
    { key: "how", label: "どのように（How）", value: punch?.how },
  ];
  return (
    <div className="space-y-3">
      {punch?.in ? <W5hCard title={`${date} の勤務の5W1H`} items={items} /> : <p className="text-[12.5px] text-ink-3">この日の打刻はありません。行動メモだけ記録できます。</p>}
      {logs.map((l) => (
        <W5hCard key={l.id} title={`行動メモ ${l.start.slice(11)}${l.end ? `〜${l.end.slice(11)}` : ""}（${l.category}）`}
          items={[{ key: "when", label: "いつ（When）", value: l.start.replace("T", " ") }, { key: "where", label: "どこで（Where）", value: l.where }, { key: "who", label: "誰が・誰と（Who）", value: l.who || me }, { key: "what", label: "何を（What）", value: l.what }, { key: "why", label: "なぜ（Why）", value: l.why }, { key: "how", label: "どのように（How）", value: l.how }]}
          footer={<button className="mt-2 flex items-center gap-1 text-[12px] text-ink-3 hover:text-bad print:hidden" onClick={() => confirm("この行動メモを削除しますか？") && d({ t: "log-del", id: l.id, by: meId })}><Trash2 size={13} />削除</button>} />
      ))}
      {add ? <LogForm date={date} onDone={() => setAdd(false)} /> : <button className="btn !h-8 print:hidden" onClick={() => setAdd(true)}><Plus size={14} />この日の行動メモを追加</button>}
    </div>
  );
}

function LogForm({ date, onDone }: { date: string; onDone: () => void }) {
  const { d, meId } = useStore();
  const [f, setF] = useState({ what: "", start: "10:00", end: "", where: PLACES[0], who: "", why: "", how: "", category: "作業" });
  const bad = f.end && f.end <= f.start ? "終了は開始より後にしてください" : "";
  return (
    <form className="card space-y-3 p-3 print:hidden" onSubmit={(e) => { e.preventDefault(); if (bad) return; d({ t: "log-add", log: { id: `l${Date.now()}`, by: meId, what: f.what, where: f.where, who: f.who, why: f.why, how: f.how, category: f.category, start: `${date}T${f.start}`, end: f.end ? `${date}T${f.end}` : undefined } }); onDone(); }}>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><label className="label" htmlFor="lw">何を（What）※必須</label><input id="lw" required className="input" placeholder="例：A社と契約内容の打合せ" value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} /></div>
        <div><label className="label" htmlFor="ls">いつ（開始）</label><input id="ls" type="time" required className="input tabular" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
        <div><label className="label" htmlFor="le">終了（任意）</label><input id="le" type="time" className="input tabular" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
        <div><label className="label" htmlFor="lp">どこで（Where）</label><input id="lp" list="places" className="input" value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} /><datalist id="places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist></div>
        <div><label className="label" htmlFor="lo">誰が・誰と（Who）</label><input id="lo" className="input" placeholder="相手の名前" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} /></div>
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
