"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { calcDay, fmtHM } from "@/lib/attendance-calc";
import { hm, useStore, ymd, type Punch } from "@/lib/store";

export const PLACES = ["オフィス", "在宅", "外出・直行直帰", "出張"];
type F5 = Pick<Punch, "what" | "who" | "why" | "how">;

/** 打刻カード（PC・スマホ共通）。打刻と同時に 5W1H（いつ＝打刻時刻／どこで／誰と／何を／なぜ／どのように）を記録する */
export function PunchCard() {
  const { s, d, meId } = useStore();
  const [t, setT] = useState(() => new Date());
  const [place, setPlace] = useState(PLACES[0]);
  const [draft, setDraft] = useState<F5>({});
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  const today = ymd(t);
  const p = s.punches[meId]?.[today] ?? {};
  const c = calcDay(today, { ...p, out: p.out ?? (p.in ? hm(t) : undefined) });
  const val = (k: keyof F5) => (p.in ? p[k] ?? "" : draft[k] ?? "");
  const set = (k: keyof F5, v: string) => (p.in ? d({ t: "punch", emp: meId, date: today, p: { [k]: v } }) : setDraft({ ...draft, [k]: v }));
  const stamp = (kind: "in" | "out") => d({ t: "punch", emp: meId, date: today, p: kind === "in" ? { in: hm(new Date()), place, ...draft } : { out: hm(new Date()) }, log: kind === "in" ? `出勤打刻（${place}${draft.what ? `／${draft.what}` : ""}）` : "退勤打刻" });
  const fields: [keyof F5, string, string][] = [["what", "何を（今日の主な業務）", "例：A社向け提案書の作成"], ["why", "なぜ（目的・背景）", "例：来期の契約更新のため"], ["how", "どのように（方法・手段）", "例：資料作成→社内レビュー"], ["who", "誰と（関係者）", "例：営業本部 佐藤さん"]];

  return (
    <section className="card p-4" aria-label="勤怠打刻">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">勤怠打刻</h2>
        <span className="text-[12px] text-ink-3">{t.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</span>
      </div>
      <div className="tabular text-[40px] font-bold leading-tight">{hm(t)}<span className="ml-1 text-lg text-ink-3">:{String(t.getSeconds()).padStart(2, "0")}</span></div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">出勤（いつ）</div><div className="tabular text-[15px] font-semibold">{p.in ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">退勤</div><div className="tabular text-[15px] font-semibold">{p.out ?? "—"}</div></div>
        <div className="rounded-lg bg-surface-2 py-1.5"><div className="text-ink-3">{p.out ? "実働" : "現在の実働"}</div><div className="tabular text-[15px] font-semibold">{p.in ? fmtHM(c.work) : "—"}</div></div>
      </div>
      {p.in && c.overtime > 0 && <p className="mb-2 text-[12px] text-warn">本日の時間外：{fmtHM(c.overtime)}（休憩 {c.breakMin}分 自動控除）</p>}
      <label className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-2"><MapPin size={14} aria-hidden />どこで
        <select className="input !h-9 !w-auto flex-1" value={p.place ?? place} disabled={!!p.in} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <div className="mb-3 space-y-2">
        {fields.map(([k, label, ph]) => (
          <div key={k}><label className="label !mb-0.5" htmlFor={`pc-${k}`}>{label}</label><input id={`pc-${k}`} className="input !h-9" placeholder={ph} value={val(k)} onChange={(e) => set(k, e.target.value)} /></div>
        ))}
        <p className="text-[11.5px] text-ink-3">{p.in ? "入力内容は自動で保存され、退勤前に振り返って書き足せます。" : "打刻前に書いておくと、出勤と同時に記録されます（後から追記も可）。"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary !h-12 !text-[15px]" disabled={!!p.in} onClick={() => stamp("in")}><LogIn size={17} />出勤</button>
        <button className="btn !h-12 !text-[15px]" disabled={!p.in || !!p.out} onClick={() => stamp("out")}><LogOut size={17} />退勤</button>
      </div>
    </section>
  );
}
