"use client";

import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Users } from "lucide-react";
import { COMPANY, ROLE_LABEL } from "@/lib/data";
import { can } from "@/lib/perm";
import { missingDays, monthLabel, monthSummary } from "@/lib/attendance-view";
import { fmtH, overtimeLevel } from "@/lib/work";
import { useStore, ymd } from "@/lib/store";
import { Badge, Progress, yen } from "@/components/ui";
import { TodayCard } from "@/components/TodayCard";

export default function Home() {
  const { s, meId, role, me, nameOf } = useStore();
  const now = new Date(), today = ymd(now), month = today.slice(0, 7);
  const sum = monthSummary(s.attendance, meId, month, me.scheduled, s.conditions);
  const lv = overtimeLevel(sum.overtime45, sum.total100);
  const miss = missingDays(s.attendance, meId, month, s.conditions, today);
  const todo = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId);
  const mine = s.workflows.filter((w) => w.applicantId === meId && (w.status === "承認待ち" || w.status === "差戻し"));
  const readSet = s.read[meId] ?? [];
  const important = s.news.filter((n) => n.important && !readSet.includes(n.id));
  const hour = now.getHours();
  const all = can.viewAllAttendance(role);
  const status = all ? s.employees.map((e) => ({ e, day: s.attendance[e.id]?.[today], over: overtimeLevel(monthSummary(s.attendance, e.id, month, e.scheduled, s.conditions).overtime45).level })) : [];
  const working = status.filter((x) => x.day?.start && !x.day.end).length;
  const done = status.filter((x) => x.day?.start && x.day.end).length;
  const alerts = status.filter((x) => x.over === "warn" || x.over === "danger");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{hour < 11 ? "おはようございます" : hour < 18 ? "お疲れさまです" : "お疲れさまでした"}、{me.name.split(" ")[0]}さん</h1>
        <p className="text-ink-2">{now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}　<Badge>{ROLE_LABEL[role]}</Badge></p>
      </div>

      {important.length > 0 && (
        <section aria-label="重要なお知らせ" className="rounded-[10px] border border-warn/30 bg-warn-soft p-4">
          <div className="mb-1 font-bold text-warn">重要なお知らせ</div>
          <ul className="space-y-1">{important.map((n) => <li key={n.id}><Link href={`/news?id=${n.id}`} className="underline-offset-2 hover:underline">{n.title}</Link></li>)}</ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <TodayCard />

        <section className="card min-w-0 p-4 lg:col-span-2" aria-label="今月の勤怠">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">今月の勤怠（{monthLabel(month)}）</h2><Link href="/attendance" className="flex items-center gap-1 text-[12px] text-brand-2">勤怠入力へ<ArrowRight size={13} /></Link></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["出勤日数", `${sum.workDays + sum.holidayWorkDays}日`], ["所定内", fmtH(sum.scheduled)], ["法定外残業", fmtH(sum.legalOut)], ["有給", `${sum.paidDays}日`]].map(([l, v]) => <div key={l} className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-lg font-bold">{v}</div></div>)}
          </div>
          <div className="mt-3"><div className="mb-1 flex justify-between text-[12.5px]"><span>時間外（36協定）</span><span className="tabular">{sum.overtime45.toFixed(1)}h / 45h</span></div><Progress value={(sum.overtime45 / 45) * 100} tone={lv.level === "danger" ? "bad" : lv.level === "ok" ? "brand" : "warn"} />{lv.message && <p className="mt-1 text-[12px] text-warn">{lv.message}</p>}</div>
          {miss.length > 0 && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">未入力の所定労働日が {miss.length} 日あります。<Link href="/attendance" className="ml-1 underline">入力する</Link></p>}
        </section>

        <section className="card min-w-0 p-4 lg:col-span-2" aria-label="あなたのToDo">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">あなたのToDo</h2><Link href="/workflow" className="flex items-center gap-1 text-[12px] text-brand-2">申請・承認へ<ArrowRight size={13} /></Link></div>
          <ul className="divide-y divide-line">
            {todo.map((w) => <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone="warn">承認依頼</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}<span className="ml-2 text-ink-3">（{nameOf(w.applicantId)}）</span></Link>{w.amount ? <span className="tabular text-ink-2">{yen(w.amount)}</span> : null}</li>)}
            {mine.map((w) => <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone={w.status === "差戻し" ? "bad" : "gray"}>{w.status === "差戻し" ? "差戻し" : "申請中"}</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}</Link></li>)}
            {todo.length + mine.length === 0 && <li className="py-6 text-center text-ink-3">対応が必要なタスクはありません</li>}
          </ul>
        </section>

        {all && (
          <section className="card p-4" aria-label="全社の状況">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><Users size={15} aria-hidden />全社の状況（今日）</h2>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-surface-2 py-2"><div className="tabular text-xl font-bold">{working}</div><div className="text-[11.5px] text-ink-3">勤務中</div></div><div className="rounded-lg bg-surface-2 py-2"><div className="tabular text-xl font-bold">{done}</div><div className="text-[11.5px] text-ink-3">退勤済み</div></div><div className="rounded-lg bg-surface-2 py-2"><div className="tabular text-xl font-bold">{status.length - working - done}</div><div className="text-[11.5px] text-ink-3">打刻なし</div></div></div>
            {alerts.length > 0 ? <ul className="space-y-1 text-[13px]">{alerts.map((x) => <li key={x.e.id} className="flex justify-between"><span>{x.e.name}</span><Badge tone="warn">時間外 45h超</Badge></li>)}</ul> : <p className="text-[12.5px] text-ink-3">36協定の要注意者はいません。</p>}
            <Link href="/attendance" className="mt-3 flex items-center gap-1 text-[12px] text-brand-2">全員の月次集計<ArrowRight size={13} /></Link>
          </section>
        )}
        {can.excel(role) && (
          <section className="card p-4" aria-label="Excel連携">
            <h2 className="mb-1 flex items-center gap-2 font-bold"><FileSpreadsheet size={15} aria-hidden />給与計算への連携</h2>
            <p className="mb-3 text-[12.5px] text-ink-2">{monthLabel(month)}の勤怠を、勤怠ブック→賃金計算ブックに反映します。</p>
            <Link href="/excel" className="btn btn-primary w-full">Excel連携を開く</Link>
          </section>
        )}

        <section className="card min-w-0 lg:col-span-2" aria-label="お知らせ">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold">お知らせ</h2><Link href="/news" className="flex items-center gap-1 text-[12px] text-brand-2">一覧<ArrowRight size={13} /></Link></div>
          <ul>{s.news.slice(0, 5).map((n) => (
            <li key={n.id} className="border-b border-line last:border-0"><Link href={`/news?id=${n.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg"><span className="tabular w-[76px] shrink-0 text-[12px] text-ink-3">{n.date}</span><Badge tone={n.important ? "bad" : "gray"}>{n.category}</Badge><span className={`flex-1 truncate ${readSet.includes(n.id) ? "text-ink-2" : "font-semibold"}`}>{n.title}</span></Link></li>
          ))}</ul>
        </section>
      </div>
      <p className="text-[11.5px] text-ink-3">{COMPANY.name} 社内ポータル</p>
    </div>
  );
}
