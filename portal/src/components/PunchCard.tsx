"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { calcDay, fmtHM } from "@/lib/attendance-calc";
import { hm, useStore, ymd } from "@/lib/store";

export const PLACES = ["オフィス", "在宅", "外出・直行直帰", "出張"];

/** 打刻カード（PC・スマホ共通）。スマホでは大きなボタンで片手操作できる */
export function PunchCard() {
  const { s, d, meId } = useStore();
  const [t, setT] = useState(() => new Date());
  const [place, setPlace] = useState(PLACES[0]);
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const today = ymd(t);
  const p = s.punches[meId]?.[today] ?? {};
  const c = calcDay(today, { ...p, out: p.out ?? (p.in ? hm(t) : undefined) });
  const stamp = (kind: "in" | "out") => d({ t: "punch", emp: meId, date: today, p: kind === "in" ? { in: hm(new Date()), place } : { out: hm(new Date()) }, log: kind === "in" ? `出勤打刻（${place}）` : "退勤打刻" });

  return (
    <section className="card p-4" aria-label="勤怠打刻">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">勤怠打刻</h2>
        <span className="text-[12px] text-ink-3">{t.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</span>
      </div>
      <div className="tabular text-[40px] font-bold leading-tight">{hm(t)}<span className="ml-1 text-lg text-ink-3">:{String(t.getSeconds()).padStart(2, "0")}</span></div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">出勤</div><div className="tabular text-[15px] font-semibold">{p.in ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">退勤</div><div className="tabular text-[15px] font-semibold">{p.out ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">{p.out ? "実働" : "現在の実働"}</div><div className="tabular text-[15px] font-semibold">{p.in ? fmtHM(c.work) : "—"}</div></div>
      </div>
      {p.in && c.overtime > 0 && <p className="mb-2 text-[12px] text-warn">本日の時間外：{fmtHM(c.overtime)}（休憩 {c.breakMin}分 自動控除）</p>}
      <label className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-2"><MapPin size={14} aria-hidden />勤務場所
        <select className="input !h-9 !w-auto flex-1" value={p.place ?? place} disabled={!!p.in} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary !h-12 !text-[15px]" disabled={!!p.in} onClick={() => stamp("in")}><LogIn size={17} />出勤</button>
        <button className="btn !h-12 !text-[15px]" disabled={!p.in || !!p.out} onClick={() => stamp("out")}><LogOut size={17} />退勤</button>
      </div>
    </section>
  );
}
