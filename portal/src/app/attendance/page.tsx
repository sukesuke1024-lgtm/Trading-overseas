"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { HOLIDAYS_2026, calcDay, dayKind, fmtHM, leaveBalance, lastGrantDate, overtimeLevel, summarize, STD_END, STD_START } from "@/lib/attendance-calc";
import { LEAVE_SEED, empById } from "@/lib/data";
import { leaveDatesOf, useStore, ymd, type Punch } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";
import { PLACES, PunchCard } from "@/components/PunchCard";

const DOW = "日月火水木金土";

export default function Attendance() {
  const { s, d, meId } = useStore();
  const me = empById(meId)!;
  const today = new Date();
  const [off, setOff] = useState(0);
  const [edit, setEdit] = useState<string | null>(null);
  const base = new Date(today.getFullYear(), today.getMonth() + off, 1);
  const days = Array.from({ length: new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate() }, (_, i) => ymd(new Date(base.getFullYear(), base.getMonth(), i + 1)));
  const todayS = ymd(today);
  const punches = s.punches[meId] ?? {};

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
  const tone = lv.level === "danger" ? "bad" : lv.level === "warn" || lv.level === "notice" ? "warn" : "brand";

  return (
    <div>
      <PageHeader title="勤怠" sub="打刻から休憩・時間外・深夜・有給を自動計算します（所定 9:00〜18:00／休憩1時間／日曜＝法定休日）。" />
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
          <thead><tr><th className="th">日付</th><th className="th">出勤</th><th className="th">退勤</th><th className="th text-right">休憩</th><th className="th text-right">実働</th><th className="th text-right">時間外</th><th className="th text-right">深夜</th><th className="th">備考</th><th className="th w-10"><span className="sr-only">修正</span></th></tr></thead>
          <tbody>
            {days.map((k) => {
              const dt = new Date(`${k}T00:00:00`), w = dt.getDay(), kind = dayKind(k);
              const p = punches[k], c = calcDay(k, p), isLeave = leave.has(k), isToday = k === todayS, future = k > todayS;
              return (
                <tr key={k} className={`${kind !== "workday" ? "bg-bg text-ink-3" : ""} ${isToday ? "!bg-brand-soft" : ""}`}>
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
                  <td className="td">{!future && !isLeave && <button className="text-ink-3 hover:text-brand" aria-label={`${k} を修正`} onClick={() => setEdit(k)}><Pencil size={14} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">休憩は法定最低（6時間超45分／8時間超60分）を自動控除。時間外は所定8時間超。所定休日（土・祝）の労働は全て時間外、日曜は法定休日労働として集計。深夜は22:00〜5:00。始業{STD_START}／終業{STD_END}。</p>
      {edit && <EditDialog date={edit} punch={punches[edit]} onClose={() => setEdit(null)} onSave={(p, reason) => { d({ t: "punch", emp: meId, date: edit, p: { ...p, edited: true }, log: `打刻修正 ${edit}：${reason}` }); setEdit(null); }} />}
    </div>
  );
}

function EditDialog({ date, punch, onClose, onSave }: { date: string; punch?: Punch; onClose: () => void; onSave: (p: Punch, reason: string) => void }) {
  const [f, setF] = useState({ in: punch?.in ?? "", out: punch?.out ?? "", brk: punch?.break?.toString() ?? "", place: punch?.place ?? PLACES[0], reason: "" });
  const c = calcDay(date, { in: f.in, out: f.out, break: f.brk ? Number(f.brk) : undefined });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="打刻修正">
      <form className="card w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSave({ in: f.in || undefined, out: f.out || undefined, break: f.brk ? Number(f.brk) : undefined, place: f.place }, f.reason); }}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">打刻の修正（{date}）</h2><button type="button" onClick={onClose} aria-label="閉じる"><X size={16} /></button></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="ei">出勤</label><input id="ei" type="time" className="input tabular" value={f.in} onChange={(e) => setF({ ...f, in: e.target.value })} /></div>
          <div><label className="label" htmlFor="eo">退勤</label><input id="eo" type="time" className="input tabular" value={f.out} onChange={(e) => setF({ ...f, out: e.target.value })} /></div>
          <div><label className="label" htmlFor="eb">休憩（分）</label><input id="eb" type="number" min={0} max={240} placeholder="自動" className="input tabular" value={f.brk} onChange={(e) => setF({ ...f, brk: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="ep">勤務場所</label><select id="ep" className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })}>{PLACES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label" htmlFor="er">修正理由（必須・監査ログに記録）</label><input id="er" required className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="例：打刻忘れ（客先直行）" /></div>
        {f.in && f.out && <p className="rounded-lg bg-bg p-2 text-[12.5px] text-ink-2">自動計算：実働 <b className="tabular">{fmtHM(c.work)}</b>（休憩 {c.breakMin}分）／時間外 <b className="tabular">{fmtHM(c.overtime)}</b>／深夜 <b className="tabular">{fmtHM(c.night)}</b>{f.brk && Number(f.brk) < c.breakMin && "（休憩は法定最低に補正）"}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary">保存</button></div>
      </form>
    </div>
  );
}
