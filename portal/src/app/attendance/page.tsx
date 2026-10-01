"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eraser, Lock, Save, Wand2 } from "lucide-react";
import { ROLE_LABEL } from "@/lib/data";
import { can } from "@/lib/perm";
import { missingDays, monthLabel, monthSummary, shiftMonth } from "@/lib/attendance-view";
import { KINDS, autoKind, calcDay, daysOf, fmtH, holidayName, isHoliday, normalizeTime, overtimeLevel, toMin, type DayInput, type Kind } from "@/lib/work";
import { useStore, ymd } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";
import { TodayCard } from "@/components/TodayCard";

const DOW = "日月火水木金土";
const TABS = ["日別入力", "全員の月次集計"] as const;

export default function Attendance() {
  const { s, meId, role, emp, me } = useStore();
  const today = ymd(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [target, setTarget] = useState(meId);
  const [tab, setTab] = useState<(typeof TABS)[number]>("日別入力");
  const [unsaved, setUnsaved] = useState(0);
  const guard = (fn: () => void) => { if (unsaved > 0 && !confirm(`保存していない変更が${unsaved}件あります。破棄して移動しますか？`)) return; setUnsaved(0); fn(); };
  const viewer = can.viewAllAttendance(role), canEditOthers = can.editAttendanceOfOthers(role);
  const empId = viewer ? target : meId;
  const who = emp(empId) ?? me;
  const editable = empId === meId || canEditOthers;
  const sum = monthSummary(s.attendance, empId, month, who.scheduled, s.conditions);
  const lv = overtimeLevel(sum.overtime45, sum.total100);
  const miss = missingDays(s.attendance, empId, month, s.conditions, today);
  const tone = lv.level === "danger" ? "bad" : lv.level === "warn" || lv.level === "notice" ? "warn" : "brand";

  return (
    <div>
      <PageHeader title="勤怠" sub={`始業・終業・休憩を入力すると、所定内・残業・深夜・休日労働が自動で計算され、Excel（勤怠ブック→賃金計算ブック）に反映できます。`}
        actions={<div className="flex items-center gap-1"><button className="btn !h-9 !w-9 !p-0" aria-label="前月" onClick={() => guard(() => setMonth(shiftMonth(month, -1)))}><ChevronLeft size={16} /></button><span className="tabular min-w-28 text-center font-bold">{monthLabel(month)}</span><button className="btn !h-9 !w-9 !p-0" aria-label="翌月" onClick={() => guard(() => setMonth(shiftMonth(month, 1)))}><ChevronRight size={16} /></button></div>} />

      {viewer && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${tab === t ? "border-brand text-ink" : "border-transparent text-ink-3"}`}>{t}</button>)}
        </div>
      )}

      {viewer && tab === "全員の月次集計" ? (
        <AllSummary month={month} onOpen={(id) => { setTarget(id); setTab("日別入力"); }} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {empId === meId && month === today.slice(0, 7) ? <TodayCard /> : (
              <section className="card p-4"><h2 className="font-bold">{who.name}さんの勤怠</h2><p className="mt-1 text-[13px] text-ink-2">{who.job}・{who.employment}・{ROLE_LABEL[who.role]}<br />所定労働時間 {fmtH(who.scheduled)}/日</p>
                {!editable && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><Lock size={14} aria-hidden />閲覧のみ（役員は他の人の勤怠を修正できません）</p>}
                {editable && empId !== meId && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">管理者として他の人の勤怠を修正しています。修正は監査ログに記録されます。</p>}
              </section>
            )}
            <section className="card p-4 lg:col-span-2" aria-label="時間外労働（36協定）">
              {viewer && (
                <label className="mb-3 flex items-center gap-2 text-[13px]">対象者
                  <select className="input !h-9 !w-auto" value={empId} onChange={(e) => guard(() => setTarget(e.target.value))}>{s.employees.map((e) => <option key={e.id} value={e.id}>{e.id} {e.name}</option>)}</select>
                </label>
              )}
              <div className="mb-1 flex items-center justify-between"><span className="font-bold">時間外労働（36協定管理）</span><span className="tabular text-[13px]"><b>{sum.overtime45.toFixed(1)}h</b> / 上限45h</span></div>
              <Progress value={(sum.overtime45 / 45) * 100} tone={tone} />
              <div className="mt-1 flex justify-between text-[11.5px] text-ink-3"><span>0</span><span>36h（注意）</span><span>45h</span></div>
              {lv.level !== "ok" && <p className={`mt-2 flex items-start gap-1.5 text-[12.5px] ${lv.level === "danger" ? "text-bad" : "text-warn"}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{lv.message}</p>}
              <p className="mt-2 text-[11.5px] text-ink-3">時間外＝法定外残業＋法定外休日労働（土・祝）。月100時間未満の判定には法定休日（日）の労働も含みます（現在 {sum.total100.toFixed(1)}h）。</p>
              {miss.length > 0 && <p className="mt-2 text-[12.5px] text-warn">未入力の所定労働日が {miss.length} 日あります（{miss.slice(0, 4).map((d) => d.slice(5).replace("-", "/")).join("・")}{miss.length > 4 ? " ほか" : ""}）。休みの日は「休み」を選んでください。</p>}
            </section>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {[["出勤日数", `${sum.workDays + sum.holidayWorkDays}日`], ["所定内", fmtH(sum.scheduled)], ["法定内残業", fmtH(sum.legalIn)], ["法定外残業", fmtH(sum.legalOut)], ["深夜", fmtH(sum.night)], ["休日労働", fmtH(sum.legalHoliday + sum.nonLegalHoliday)], ["有給", `${sum.paidDays}日`], ["欠勤", `${sum.absentDays}日`]].map(([l, v]) => (
              <div key={l} className="card px-3 py-2.5"><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-lg font-bold">{v}</div></div>
            ))}
          </div>
          {sum.nightExcelDiff !== 0 && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">深夜時間が、Excel（勤怠ブック）の計算式では {sum.nightExcelDiff > 0 ? "+" : ""}{sum.nightExcelDiff}h 異なります（日をまたぐ勤務の二重計上）。「Excel連携」で式の修正を選べます。</p>}

          <DayTable key={`${empId}-${month}`} month={month} empId={empId} editable={editable} onUnsaved={setUnsaved} />
        </>
      )}
    </div>
  );
}

type Draft = { kind: Kind | ""; start: string; end: string; brk: string; remote: boolean; note: string };
const toDraft = (d?: DayInput): Draft => ({ kind: d?.kind ?? "", start: d?.start ?? "", end: d?.end ?? "", brk: d?.brk != null ? String(d.brk) : "", remote: !!d?.remote, note: d?.note ?? "" });

function DayTable({ month, empId, editable, onUnsaved }: { month: string; empId: string; editable: boolean; onUnsaved: (n: number) => void }) {
  const { s, d, meId, holidays, emp, nameOf } = useStore();
  const regs = useRef(new Map<string, () => void>()); // 未保存の行 → その行を保存する関数
  const [dirtyCount, setDirtyCount] = useState(0);
  const report = useCallback((date: string, save: (() => void) | null) => {
    const before = regs.current.size;
    if (save) regs.current.set(date, save); else regs.current.delete(date);
    if (regs.current.size !== before) { setDirtyCount(regs.current.size); onUnsaved(regs.current.size); }
  }, [onUnsaved]);
  const saveAll = () => { for (const fn of [...regs.current.values()]) fn(); };
  useEffect(() => { // 未保存のままページを閉じようとしたら警告
    if (dirtyCount === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount]);
  const today = ymd(new Date());
  const who = emp(empId);
  const stored = s.attendance[empId] ?? {};

  const save = (date: string, day: DayInput | null, note: string) => {
    const corr = empId !== meId || date < today; // 他人の分・過去日の入力は修正として監査ログに残す
    d({ t: "att-set", emp: empId, date, day, by: meId, log: corr ? `勤怠${day ? "修正" : "削除"}: ${nameOf(empId)} ${date}${note ? `（${note}）` : ""}` : undefined });
  };
  const fillStandard = () => {
    let n = 0;
    for (const date of daysOf(month)) {
      if (date > today || isHoliday(date, holidays) || stored[date]) continue;
      d({ t: "att-set", emp: empId, date, day: { date, kind: "出勤", start: s.conditions.start, end: s.conditions.end, brk: s.conditions.breakMin }, by: meId });
      n++;
    }
    if (n) d({ t: "export-log", by: meId, what: `標準勤務を一括入力: ${nameOf(empId)} ${month}（${n}日）` });
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-bold">日別入力</h2>
        {editable && dirtyCount > 0 && <span className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-1 text-[12.5px] text-warn" role="status">未保存の変更 {dirtyCount}件<button className="btn btn-primary !h-8" onClick={saveAll}><Save size={14} />すべて保存</button></span>}
        {editable && <button className="btn !h-8" onClick={fillStandard} title="今日までの所定労働日のうち、未入力の日を 8:30〜17:00（休憩60分）で埋めます"><Wand2 size={14} />未入力の平日を標準勤務で入力</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead><tr><th className="th">日付</th><th className="th">区分</th><th className="th">始業</th><th className="th">終業</th><th className="th">休憩(分)</th><th className="th">リモート</th><th className="th text-right">実労働</th><th className="th text-right">所定内</th><th className="th text-right">法定内</th><th className="th text-right">法定外</th><th className="th text-right">深夜</th><th className="th text-right">休日</th><th className="th">備考</th><th className="th w-8"><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {daysOf(month).map((date) => {
              const hol = isHoliday(date, holidays), name = holidayName(date, s.conditions), wd = new Date(`${date}T00:00:00`).getDay();
              return (
                <Fragment key={date}>
                  <DayRow date={date} stored={stored[date]} hol={hol} label={`${Number(date.slice(5, 7))}/${Number(date.slice(8))}（${DOW[wd]}）${name ? ` ${name}` : ""}`} isToday={date === today}
                    scheduled={who?.scheduled ?? 7.5} editable={editable} onSave={save} report={report} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11.5px] text-ink-3">入力したら各行の「保存」（またはEnterキー）で確定します。時刻は「830」→「8:30」、「1700」→「17:00」のように数字だけで入力できます。日をまたぐ勤務は終業を「25:00」のように入力します。休日（土日・休日マスタ）に勤務すると自動で「休日出勤」になります。法定外＝8時間超、法定内＝所定7.5時間超〜8時間、休日労働は日曜が法定休日（35%）、土曜・祝日が法定外休日（25%）。</p>
    </div>
  );
}

function DayRow({ date, stored, hol, label, isToday, scheduled, editable, onSave, report }: { report: (date: string, save: (() => void) | null) => void; date: string; stored?: DayInput; hol: boolean; label: string; isToday: boolean; scheduled: number; editable: boolean; onSave: (date: string, day: DayInput | null, note: string) => void }) {
  const { s, holidays } = useStore();
  const sj = JSON.stringify(stored ?? null);
  const [prev, setPrev] = useState(sj);
  const [dr, setDr] = useState<Draft>(() => toDraft(stored));
  if (prev !== sj) { setPrev(sj); setDr(toDraft(stored)); } // 保存された内容（打刻・他の端末の更新を含む）を取り込む

  const bad = (v: string) => v !== "" && toMin(v) == null;
  const errs = { start: bad(dr.start), end: bad(dr.end), brk: dr.brk !== "" && !(Number(dr.brk) >= 0 && Number(dr.brk) <= 600) };
  const live: DayInput | null = dr.kind || dr.start || dr.end ? { date, kind: (dr.kind || autoKind(date, holidays)) as Kind, start: dr.start || undefined, end: dr.end || undefined, brk: dr.brk === "" ? undefined : Number(dr.brk), remote: dr.remote || undefined } : null;
  const calc = live ? calcDay(live, scheduled, holidays, s.conditions) : null;
  const dirty = JSON.stringify(dr) !== JSON.stringify(toDraft(stored));
  const valid = !errs.start && !errs.end && !errs.brk;

  // 保存：時刻を「H:MM」にそろえ、不正な値は保存しない
  const save = (note = "") => {
    const next: Draft = { ...dr, start: normalizeTime(dr.start), end: normalizeTime(dr.end) };
    setDr(next);
    if (bad(next.start) || bad(next.end) || errs.brk) return;
    const nonWork = next.kind === "有給休暇" || next.kind === "欠勤" || next.kind === "休み";
    const times = !nonWork && (next.start || next.end);
    if (!next.kind && !times) { onSave(date, null, note); return; }
    const kind = (nonWork ? next.kind : autoKind(date, holidays, (next.kind || undefined) as Kind | undefined)) as Kind;
    onSave(date, { date, kind, start: nonWork ? undefined : next.start || undefined, end: nonWork ? undefined : next.end || undefined, brk: nonWork || next.brk === "" ? undefined : Number(next.brk), remote: next.remote || undefined, note: next.note || undefined }, note);
  };
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => { report(date, dirty && valid ? () => saveRef.current() : null); return () => report(date, null); }, [dirty, valid, date, report]);

  const std = () => setDr({ ...dr, kind: autoKind(date, holidays), start: s.conditions.start, end: s.conditions.end, brk: String(s.conditions.breakMin) });
  const dis = !editable;
  const cell = "input !h-8 !px-1.5 tabular";
  const time = (key: "start" | "end", ph: string) => (
    <input aria-label={`${date} ${key === "start" ? "始業" : "終業"}`} inputMode="numeric" disabled={dis} className={`${cell} !w-[4.6rem] ${errs[key] ? "!border-bad" : ""}`} placeholder={ph} value={dr[key]}
      onChange={(e) => { const v = e.target.value; setDr({ ...dr, [key]: /^\d{4}$/.test(v) ? normalizeTime(v) : v }); }} // 4桁そろったらすぐ「17:00」に
      onBlur={() => setDr((x) => ({ ...x, [key]: normalizeTime(x[key]) }))}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
  );

  return (
    <tr className={`${hol ? "bg-bg text-ink-2" : ""} ${isToday ? "!bg-brand-soft" : ""}`}>
      <td className="td whitespace-nowrap">{label}</td>
      <td className="td"><select aria-label={`${date} 区分`} disabled={dis} className={`${cell} !w-28`} value={dr.kind} onChange={(e) => setDr({ ...dr, kind: e.target.value as Kind | "" })}><option value="">（未入力）</option>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
      <td className="td">{time("start", "8:30")}</td>
      <td className="td">{time("end", "17:00")}</td>
      <td className="td"><input aria-label={`${date} 休憩`} disabled={dis} type="number" min={0} max={600} className={`${cell} !w-16 ${errs.brk ? "!border-bad" : ""}`} placeholder={String(s.conditions.breakMin)} value={dr.brk} onChange={(e) => setDr({ ...dr, brk: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} /></td>
      <td className="td text-center"><input aria-label={`${date} リモート`} disabled={dis} type="checkbox" className="h-4 w-4" checked={dr.remote} onChange={(e) => setDr({ ...dr, remote: e.target.checked })} /></td>
      <td className="td tabular text-right">{calc?.worked ? fmtH(calc.worked) : ""}</td>
      <td className="td tabular text-right">{calc?.scheduled ? fmtH(calc.scheduled) : ""}</td>
      <td className="td tabular text-right">{calc?.legalIn ? fmtH(calc.legalIn) : ""}</td>
      <td className="td tabular text-right">{calc?.legalOut ? <b className="text-warn">{fmtH(calc.legalOut)}</b> : ""}</td>
      <td className="td tabular text-right">{calc?.night ? fmtH(calc.night) : ""}</td>
      <td className="td tabular text-right">{calc?.holidayWork ? fmtH(calc.holidayWork) : ""}</td>
      <td className="td"><div className="flex items-center gap-1.5">
        <input aria-label={`${date} 備考`} disabled={dis} className={`${cell} !w-32 !text-[12px]`} value={dr.note} onChange={(e) => setDr({ ...dr, note: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
        {calc?.outsideCore && <Badge tone="warn">コア外</Badge>}{calc?.invalid && <Badge tone="bad">{calc.invalid}</Badge>}
      </div></td>
      <td className="td"><div className="flex items-center gap-1.5 whitespace-nowrap">
        {editable && (dirty
          ? <button className="btn btn-primary !h-8 !px-2.5" disabled={!valid} aria-label={`${date} を保存`} title={valid ? "この日の入力を保存（Enter）" : "入力に誤りがあります"} onClick={() => save()}><Save size={13} />保存</button>
          : stored ? <span className="flex items-center gap-0.5 text-[11.5px] text-good" aria-label={`${date} 保存済み`}><Check size={13} aria-hidden />保存済</span> : null)}
        {editable && <button className="text-ink-3 hover:text-ink" title="標準勤務（8:30〜17:00）を入力" aria-label={`${date} 標準勤務を入力`} onClick={std}><Wand2 size={14} /></button>}
        {editable && (live || stored) && <button className="text-ink-3 hover:text-bad" title="この日の入力を消す（保存で確定）" aria-label={`${date} を消す`} onClick={() => setDr({ kind: "", start: "", end: "", brk: "", remote: false, note: "" })}><Eraser size={14} /></button>}
      </div></td>
    </tr>
  );
}

function AllSummary({ month, onOpen }: { month: string; onOpen: (id: string) => void }) {
  const { s } = useStore();
  const today = ymd(new Date());
  const rows = s.employees.map((e) => ({ e, sum: monthSummary(s.attendance, e.id, month, e.scheduled, s.conditions), miss: missingDays(s.attendance, e.id, month, s.conditions, today).length }));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead><tr><th className="th">従業員</th><th className="th text-right">出勤</th><th className="th text-right">有給</th><th className="th text-right">欠勤</th><th className="th text-right">所定内</th><th className="th text-right">法定内残業</th><th className="th text-right">法定外残業</th><th className="th text-right">深夜</th><th className="th text-right">休日労働</th><th className="th text-right">未入力日</th><th className="th">36協定</th></tr></thead>
        <tbody>
          {rows.map(({ e, sum, miss }) => {
            const lv = overtimeLevel(sum.overtime45, sum.total100);
            return (
              <tr key={e.id} className="cursor-pointer hover:bg-bg" onClick={() => onOpen(e.id)}>
                <td className="td"><div className="font-medium">{e.name}</div><div className="text-[11.5px] text-ink-3">{e.id}・{e.job}</div></td>
                <td className="td tabular text-right">{sum.workDays + sum.holidayWorkDays}</td><td className="td tabular text-right">{sum.paidDays}</td><td className="td tabular text-right">{sum.absentDays}</td>
                <td className="td tabular text-right">{fmtH(sum.scheduled)}</td><td className="td tabular text-right">{fmtH(sum.legalIn)}</td><td className="td tabular text-right">{fmtH(sum.legalOut)}</td><td className="td tabular text-right">{fmtH(sum.night)}</td><td className="td tabular text-right">{fmtH(sum.legalHoliday + sum.nonLegalHoliday)}</td>
                <td className="td tabular text-right">{miss > 0 ? <span className="text-warn">{miss}</span> : 0}</td>
                <td className="td">{lv.level === "ok" ? <Badge tone="good">OK</Badge> : <Badge tone={lv.level === "notice" ? "warn" : "bad"}>{sum.overtime45.toFixed(1)}h</Badge>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11.5px] text-ink-3">行を押すと、その人の日別入力を開きます（管理者は修正可・役員は閲覧のみ）。</p>
    </div>
  );
}
