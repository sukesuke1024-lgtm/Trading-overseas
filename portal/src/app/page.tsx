"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, LogOut, TrendingUp, Cake, AlertTriangle } from "lucide-react";
import { COMPANY, COURSES, EMPLOYEES, ROOMS, empById } from "@/lib/data";
import { hm, useStore, ymd } from "@/lib/store";
import { Badge, Progress, yen } from "@/components/ui";

const LINKS = [
  ["経費精算を申請", "/workflow?new=経費精算"], ["休暇を申請", "/workflow?new=休暇申請"], ["出張を申請", "/workflow?new=出張申請"],
  ["会議室を予約", "/rooms"], ["規程・様式を探す", "/documents"], ["ITの困りごと", "/helpdesk"],
];

export default function Home() {
  const { s, d, meId } = useStore();
  const me = empById(meId)!;
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000 * 20); return () => clearInterval(i); }, []);

  const today = ymd(t);
  const p = s.punches[today] ?? {};
  const todo = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId);
  const mine = s.workflows.filter((w) => w.applicantId === meId && (w.status === "承認待ち" || w.status === "差戻し"));
  const important = s.news.filter((n) => n.important).slice(0, 3);
  const latest = s.news.slice(0, 6);
  const dueCourses = COURSES.filter((c) => c.required && (s.progress[c.id] ?? 0) < 100);
  const todayBookings = s.bookings.filter((b) => b.date === today).sort((a, b) => a.slot.localeCompare(b.slot));
  const hour = t.getHours();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{hour < 11 ? "おはようございます" : hour < 18 ? "お疲れさまです" : "お疲れさまでした"}、{me.name.split(" ")[0]}さん</h1>
        <p className="text-ink-2">{t.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
      </div>

      {important.length > 0 && (
        <section aria-label="重要なお知らせ" className="rounded-[10px] border border-warn/30 bg-warn-soft p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-warn"><AlertTriangle size={16} aria-hidden />重要なお知らせ</div>
          <ul className="space-y-1">
            {important.map((n) => (
              <li key={n.id}><Link href={`/news?id=${n.id}`} className="underline-offset-2 hover:underline">{n.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card p-4" aria-label="勤怠打刻">
          <h2 className="mb-1 font-bold">勤怠打刻</h2>
          <div className="tabular text-[34px] font-bold leading-tight">{hm(t)}</div>
          <p className="mb-3 text-[12px] text-ink-3">出勤 {p.in ?? "—"} ／ 退勤 {p.out ?? "—"}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={!!p.in} onClick={() => d({ t: "punch", date: today, p: { in: hm(new Date()) } })}><LogIn size={15} />出勤</button>
            <button className="btn flex-1" disabled={!p.in || !!p.out} onClick={() => d({ t: "punch", date: today, p: { out: hm(new Date()) } })}><LogOut size={15} />退勤</button>
          </div>
        </section>

        <section className="card min-w-0 p-4 lg:col-span-2" aria-label="あなたのToDo">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">あなたのToDo</h2><Link href="/workflow" className="flex items-center gap-1 text-[12px] text-brand-2">ワークフローへ<ArrowRight size={13} /></Link></div>
          <ul className="divide-y divide-line">
            {todo.map((w) => (
              <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone="warn">承認依頼</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}<span className="ml-2 text-ink-3">（{empById(w.applicantId)?.name}）</span></Link>{w.amount ? <span className="tabular text-ink-2">{yen(w.amount)}</span> : null}</li>
            ))}
            {mine.map((w) => (
              <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone={w.status === "差戻し" ? "bad" : "brand"}>{w.status === "差戻し" ? "差戻し" : "申請中"}</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}</Link></li>
            ))}
            {dueCourses.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2"><Badge tone="bad">必須研修</Badge><Link href="/training" className="flex-1 truncate hover:underline">{c.title}</Link><span className="tabular text-[12px] text-ink-3">期限 {c.due}</span></li>
            ))}
            {todo.length + mine.length + dueCourses.length === 0 && <li className="py-6 text-center text-ink-3">対応が必要なタスクはありません</li>}
          </ul>
        </section>

        <section className="card min-w-0 lg:col-span-2" aria-label="社内ニュース">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold">お知らせ</h2><Link href="/news" className="flex items-center gap-1 text-[12px] text-brand-2">一覧<ArrowRight size={13} /></Link></div>
          <ul>
            {latest.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <Link href={`/news?id=${n.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg">
                  <span className="tabular w-[76px] shrink-0 text-[12px] text-ink-3">{n.date}</span>
                  <Badge tone={n.important ? "bad" : "gray"}>{n.category}</Badge>
                  <span className={`flex-1 truncate ${s.read.includes(n.id) ? "text-ink-2" : "font-semibold"}`}>{n.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-5">
          <section className="card p-4" aria-label="クイックリンク">
            <h2 className="mb-2 font-bold">よく使う業務</h2>
            <div className="grid grid-cols-2 gap-2">
              {LINKS.map(([l, h]) => <Link key={l} href={h} className="btn !h-auto !justify-start py-2 text-left leading-snug">{l}</Link>)}
            </div>
          </section>
          <section className="card p-4" aria-label="IR情報">
            <h2 className="mb-1 flex items-center gap-2 font-bold"><TrendingUp size={15} aria-hidden />IR情報（参考表示）</h2>
            <div className="text-[12px] text-ink-3">{COMPANY.market}：{COMPANY.code}　※デモ用の架空値</div>
            <div className="tabular mt-1 flex items-baseline gap-2"><span className="text-[26px] font-bold">{yen(3482)}</span><span className="font-semibold text-good">+1.8%</span></div>
            <p className="mt-2 text-[12px] text-ink-3">インサイダー取引防止規程により、決算公表前後の自社株売買には事前届出が必要です。</p>
          </section>
        </div>

        <section className="card p-4" aria-label="本日の会議室予約">
          <h2 className="mb-2 font-bold">本日の会議室予約</h2>
          <ul className="space-y-1.5">
            {todayBookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3"><span className="tabular w-11 text-ink-3">{b.slot}</span><span className="flex-1 truncate">{b.title}<span className="ml-1 text-[12px] text-ink-3">{ROOMS.find((r) => r.id === b.roomId)?.name}</span></span></li>
            ))}
            {todayBookings.length === 0 && <li className="text-ink-3">予約はありません</li>}
          </ul>
        </section>

        <section className="card p-4" aria-label="研修進捗">
          <h2 className="mb-2 font-bold">必須研修の進捗</h2>
          <div className="space-y-3">
            {COURSES.filter((c) => c.required).map((c) => (
              <div key={c.id}><div className="mb-1 flex justify-between text-[12px]"><span className="truncate">{c.title}</span><span className="tabular text-ink-3">{s.progress[c.id]}%</span></div><Progress value={s.progress[c.id] ?? 0} tone={(s.progress[c.id] ?? 0) >= 100 ? "good" : "brand"} /></div>
            ))}
          </div>
        </section>

        <section className="card p-4" aria-label="今月の入社記念">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Cake size={15} aria-hidden />入社記念日（今月）</h2>
          <ul className="space-y-1.5">
            {EMPLOYEES.filter((e) => e.joined.slice(5, 7) === pad2(t.getMonth() + 1)).slice(0, 5).map((e) => (
              <li key={e.id} className="flex justify-between"><span>{e.name}<span className="ml-1 text-[12px] text-ink-3">{e.dept}</span></span><span className="tabular text-ink-3">{t.getFullYear() - Number(e.joined.slice(0, 4))}年目</span></li>
            ))}
            {EMPLOYEES.every((e) => e.joined.slice(5, 7) !== pad2(t.getMonth() + 1)) && <li className="text-ink-3">該当者はいません</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
const pad2 = (n: number) => String(n).padStart(2, "0");
