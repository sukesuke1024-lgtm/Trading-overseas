"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { autoKind, calcDay, fmtH, toMin, type DayInput } from "@/lib/work";
import { hm, useStore, ymd } from "@/lib/store";

/** 今日の打刻（PC・スマホ共通）。出勤・退勤を押すと、日別勤怠の始業・終業に入る */
export function TodayCard() {
  const { s, d, meId, holidays, me } = useStore();
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const today = ymd(t);
  const day: DayInput | undefined = s.attendance[meId]?.[today];
  const set = (patch: Partial<DayInput>, log?: string) => {
    const cur: DayInput = day ?? { date: today, kind: autoKind(today, holidays), brk: s.conditions.breakMin };
    d({ t: "att-set", emp: meId, date: today, day: { ...cur, ...patch, kind: autoKind(today, holidays, cur.kind) }, by: meId, log });
  };
  const calc = day ? calcDay({ ...day, end: day.end ?? (day.start ? hm(t) : undefined) }, me.scheduled, holidays, s.conditions) : null;
  const working = !!day?.start && !day.end;
  const noteKinds = day && ["有給休暇", "欠勤", "休み"].includes(day.kind);

  return (
    <section className="card p-4" aria-label="今日の打刻">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">今日の打刻</h2>
        <span className="text-[12px] text-ink-3">{t.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</span>
      </div>
      <div className="tabular text-[40px] font-bold leading-tight">{hm(t)}<span className="ml-1 text-lg text-ink-3">:{String(t.getSeconds()).padStart(2, "0")}</span></div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">始業</div><div className="tabular text-[15px] font-semibold">{day?.start ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">終業</div><div className="tabular text-[15px] font-semibold">{day?.end ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">{working ? "現在の実働" : "実働"}</div><div className="tabular text-[15px] font-semibold">{calc && calc.worked > 0 ? fmtH(calc.worked) : "—"}</div></div>
      </div>
      {noteKinds && <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">本日は「{day!.kind}」で入力されています。</p>}
      {calc && calc.legalOut > 0 && <p className="mb-2 text-[12px] text-warn">本日の法定外残業：{fmtH(calc.legalOut)}（休憩 {day?.brk ?? s.conditions.breakMin}分）</p>}
      <label className="mb-3 flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4" checked={!!day?.remote} onChange={(e) => set({ remote: e.target.checked })} />リモート勤務</label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary !h-12 !text-[15px]" disabled={!!day?.start || !!noteKinds} onClick={() => set({ start: hm(new Date()), brk: day?.brk ?? s.conditions.breakMin })}><LogIn size={17} />出勤</button>
        <button className="btn !h-12 !text-[15px]" disabled={!day?.start || !!day.end} onClick={() => { const now = hm(new Date()); set({ end: toMin(now)! < toMin(day!.start)! ? `${Number(now.slice(0, 2)) + 24}:${now.slice(3)}` : now }); }}><LogOut size={17} />退勤</button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">打刻は日別勤怠に反映されます。後から「勤怠」画面で修正できます（所定 {s.conditions.start}〜{s.conditions.end}・休憩{s.conditions.breakMin}分）。</p>
    </section>
  );
}
