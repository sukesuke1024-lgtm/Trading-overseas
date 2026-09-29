"use client";

import { AlertTriangle } from "lucide-react";
import { hm, useStore, ymd } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";

const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const DOW = "日月火水木金土";

// 実働 = 在社時間 − 休憩（6h超で45分、8h超で60分）。所定8h超を時間外とする
function calc(p?: { in?: string; out?: string }) {
  const a = toMin(p?.in), b = toMin(p?.out);
  if (a == null || b == null || b <= a) return { work: 0, over: 0 };
  const span = b - a;
  const brk = span > 8 * 60 ? 60 : span > 6 * 60 ? 45 : 0;
  const work = span - brk;
  return { work, over: Math.max(0, work - 8 * 60) };
}
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export default function Attendance() {
  const { s, d } = useStore();
  const now = new Date();
  const days = Array.from({ length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1));
  const today = ymd(now);

  let work = 0, over = 0, count = 0;
  days.forEach((dt) => { const c = calc(s.punches[ymd(dt)]); work += c.work; over += c.over; if (c.work) count++; });
  const overH = over / 60;
  const tone = overH >= 80 ? "bad" : overH >= 45 ? "warn" : "brand";
  const approvedLeave = s.workflows.filter((w) => w.type === "休暇申請" && w.status === "承認済").length;

  return (
    <div>
      <PageHeader title="勤怠" sub={`${now.getFullYear()}年${now.getMonth() + 1}月の勤務実績（打刻データから自動集計）`} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["出勤日数", `${count}日`], ["総実働", fmt(work)], ["時間外労働", fmt(over)], ["有給残日数", `${20 - 6 - approvedLeave}日`]].map(([l, v]) => (
          <div key={l} className="card p-4"><div className="text-[12px] text-ink-3">{l}</div><div className="tabular text-2xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="card mb-5 p-4">
        <div className="mb-1 flex items-center justify-between"><span className="font-bold">時間外労働（36協定管理）</span><span className="tabular text-[13px]">{overH.toFixed(1)}h / 上限45h</span></div>
        <Progress value={(overH / 45) * 100} tone={tone} />
        {overH >= 40 && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn"><AlertTriangle size={14} />月45時間の上限に近づいています。所属長・人事部へ自動通知されます。</p>}
        <p className="mt-2 text-[12px] text-ink-3">特別条項：年6回まで月100時間未満、年720時間以内（休日労働含む）。健康確保のため月80時間超は産業医面談の対象です。</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead><tr><th className="th">日付</th><th className="th">出勤</th><th className="th">退勤</th><th className="th text-right">実働</th><th className="th text-right">時間外</th><th className="th">備考</th></tr></thead>
          <tbody>
            {days.map((dt) => {
              const k = ymd(dt), p = s.punches[k], c = calc(p), w = dt.getDay(), off = w === 0 || w === 6, isToday = k === today;
              return (
                <tr key={k} className={`${off ? "bg-bg text-ink-3" : ""} ${isToday ? "bg-brand-soft" : ""}`}>
                  <td className="td tabular">{dt.getMonth() + 1}/{dt.getDate()}（{DOW[w]}）</td>
                  <td className="td tabular">
                    {p?.in ?? (isToday && !off ? <button className="btn !h-7 !px-2 text-[12px]" onClick={() => d({ t: "punch", date: k, p: { in: hm(new Date()) } })}>今すぐ出勤</button> : "")}
                  </td>
                  <td className="td tabular">
                    {p?.out ?? (isToday && p?.in ? <button className="btn !h-7 !px-2 text-[12px]" onClick={() => d({ t: "punch", date: k, p: { out: hm(new Date()) } })}>今すぐ退勤</button> : "")}
                  </td>
                  <td className="td tabular text-right">{c.work ? fmt(c.work) : ""}</td>
                  <td className="td tabular text-right">{c.over ? <span className={c.over > 90 ? "font-semibold text-warn" : ""}>{fmt(c.over)}</span> : ""}</td>
                  <td className="td">{off ? "休日" : c.over > 120 ? <Badge tone="warn">長時間</Badge> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
