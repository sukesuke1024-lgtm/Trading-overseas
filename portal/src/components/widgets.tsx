"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, CalendarCheck2, FileSpreadsheet, FileSignature, MonitorUp, NotebookPen, Receipt, Target, Users } from "lucide-react";
import { eventTime, eventsOn, kpiAttainment, paidLeave } from "@/lib/biz";
import { can } from "@/lib/perm";
import { missingDays, monthLabel, monthSummary } from "@/lib/attendance-view";
import { fmtH, overtimeLevel, holidayName } from "@/lib/work";
import { useStore, ymd } from "@/lib/store";
import { Badge, Progress, yen } from "@/components/ui";
import { TodayCard } from "@/components/TodayCard";
import { useEffect, useState, type ReactNode } from "react";
import { BASE, STATIC } from "@/lib/auth";

const More = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="flex items-center gap-1 text-[12px] text-brand-2">{children}<ArrowRight size={13} /></Link>;

function Attendance() {
  const { s, meId, me } = useStore();
  const today = ymd(new Date()), month = today.slice(0, 7);
  const sum = monthSummary(s.attendance, meId, month, me.scheduled, s.conditions);
  const lv = overtimeLevel(sum.overtime45, sum.total100);
  const miss = missingDays(s.attendance, meId, month, s.conditions, today);
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">今月の勤怠（{monthLabel(month)}）</h2><More href="/attendance">勤怠入力へ</More></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["出勤日数", `${sum.workDays + sum.holidayWorkDays}日`], ["所定内", fmtH(sum.scheduled)], ["法定外残業", fmtH(sum.legalOut)], ["有給", `${sum.paidDays}日`]].map(([l, v]) => <div key={l} className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-lg font-bold">{v}</div></div>)}
      </div>
      <div className="mt-3"><div className="mb-1 flex justify-between text-[12.5px]"><span>時間外（36協定）</span><span className="tabular">{sum.overtime45.toFixed(1)}h / 45h</span></div><Progress value={(sum.overtime45 / 45) * 100} tone={lv.level === "danger" ? "bad" : lv.level === "ok" ? "brand" : "warn"} />{lv.message && <p className="mt-1 text-[12px] text-warn">{lv.message}</p>}</div>
      {miss.length > 0 && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">未入力の所定労働日が {miss.length} 日あります。<Link href="/attendance" className="ml-1 underline">入力する</Link></p>}
    </>
  );
}

function Todo() {
  const { s, meId, nameOf } = useStore();
  const todo = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId);
  const mine = s.workflows.filter((w) => w.applicantId === meId && (w.status === "承認待ち" || w.status === "差戻し"));
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">あなたのToDo</h2><More href="/workflow">申請・承認へ</More></div>
      <ul className="divide-y divide-line">
        {todo.map((w) => <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone="warn">承認依頼</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}<span className="ml-2 text-ink-3">（{nameOf(w.applicantId)}）</span></Link>{w.amount ? <span className="tabular text-ink-2">{yen(w.amount)}</span> : null}</li>)}
        {mine.map((w) => <li key={w.id} className="flex min-w-0 items-center gap-3 py-2"><Badge tone={w.status === "差戻し" ? "bad" : "gray"}>{w.status === "差戻し" ? "差戻し" : "申請中"}</Badge><Link href={`/workflow?id=${w.id}`} className="flex-1 truncate hover:underline">{w.title}</Link></li>)}
        {todo.length + mine.length === 0 && <li className="py-6 text-center text-ink-3">対応が必要なタスクはありません</li>}
      </ul>
    </>
  );
}

function Schedule() {
  const { s } = useStore();
  const today = ymd(new Date());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d); });
  const WD = ["日", "月", "火", "水", "木", "金", "土"];
  return (
    <>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">スケジュール（今日から1週間・全社共通）</h2><More href="/calendar">カレンダー（日・週・月）へ</More></div>
      <ul className="grid grid-cols-2 gap-2">
        {days.map((iso) => {
          const evs = eventsOn(s.events, iso), h = holidayName(iso, s.conditions), wd = new Date(`${iso}T00:00:00`).getDay(), isToday = iso === today;
          return (
            <li key={iso} className={`min-h-28 rounded-lg border p-2.5 ${isToday ? "border-brand bg-brand-soft" : "border-line bg-surface-2"}`}>
              <div className="mb-1.5 flex items-baseline gap-1.5"><span className={`tabular text-[15px] font-bold ${isToday ? "text-brand" : ""}`}>{Number(iso.slice(5, 7))}/{Number(iso.slice(8))}</span><span className={`text-[12px] ${wd === 0 ? "text-bad" : wd === 6 ? "text-brand-2" : "text-ink-3"}`}>（{WD[wd]}）</span>{isToday && <span className="whitespace-nowrap"><Badge tone="brand">今日</Badge></span>}</div>
              <div className="space-y-1 text-[12.5px]">
                {h && <Badge tone="bad">{h}</Badge>}
                {evs.map((e) => <div key={e.id} className="rounded bg-surface px-1.5 py-1"><span className="tabular mr-1.5 text-ink-3">{eventTime(e)}</span>{e.title}</div>)}
                {!h && evs.length === 0 && <span className="text-ink-3">予定なし</span>}
              </div>
            </li>
          );
        })}
        <li><Link href="/calendar" className="grid h-full min-h-28 place-items-center rounded-lg border border-dashed border-line-strong p-2.5 text-[13px] text-brand-2 hover:bg-surface-2">カレンダー（日・週・月）を開く →</Link></li>
      </ul>
    </>
  );
}

function ReportToday() {
  const { s, meId } = useStore();
  const today = ymd(new Date()), r = s.reports[meId]?.[today];
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><NotebookPen size={15} aria-hidden />今日の日報</h2><More href="/reports">日報へ</More></div>
      <p className="mb-2 text-[13px]">{r?.status === "提出済" ? <Badge tone="good">提出済</Badge> : <Badge tone={r ? "gray" : "warn"}>{r ? "下書き" : "未提出"}</Badge>}</p>
      {r?.comment && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">確認コメント：{r.comment}</p>}
      {r?.status !== "提出済" && <Link href="/reports" className="btn btn-primary mt-1 w-full">日報を書く</Link>}
    </>
  );
}

function LeaveMine() {
  const { s, me, meId } = useStore();
  const p = paidLeave(me, s.attendance[meId], ymd(new Date()));
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><CalendarCheck2 size={15} aria-hidden />有給休暇</h2><More href="/leave">有給管理へ</More></div>
      {!p ? <p className="text-[12.5px] text-ink-3">入社日が未登録です。</p> : <>
        <div className="mb-2 flex items-end gap-2"><span className="tabular text-3xl font-bold">{p.remaining}</span><span className="pb-1 text-[13px] text-ink-2">日 残り（付与{p.granted}日・取得{p.used}日）</span></div>
        {p.obligation && p.needMore > 0 ? <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">{p.nextGrant}までに、あと{p.needMore}日の取得が必要です。</p> : <p className="text-[12px] text-ink-3">次回付与日：{p.nextGrant}</p>}</>}
    </>
  );
}

function Quick() {
  const items = [["/workflow?new=経費精算", "経費精算", Receipt], ["/workflow?new=稟議", "稟議・決裁", FileSignature], ["/workflow?new=休暇申請", "休暇申請", CalendarCheck2], ["/remote", "リモート接続", MonitorUp]] as const;
  return (
    <>
      <h2 className="mb-2 font-bold">よく使う操作</h2>
      <div className="grid grid-cols-2 gap-2">{items.map(([href, label, I]) => <Link key={href} href={href} className="btn !h-12 justify-start gap-2"><I size={16} aria-hidden />{label}</Link>)}</div>
    </>
  );
}

function NewsList() {
  const { s, meId } = useStore();
  const readSet = s.read[meId] ?? [];
  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold">お知らせ・慶弔・新入社員</h2><More href="/news">一覧</More></div>
      <ul>{s.news.slice(0, 5).map((n) => (
        <li key={n.id} className="border-b border-line last:border-0"><Link href={`/news?id=${n.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg"><span className="tabular w-[76px] shrink-0 text-[12px] text-ink-3">{n.date}</span><Badge tone={n.important ? "bad" : "gray"}>{n.category}</Badge><span className={`flex-1 truncate ${readSet.includes(n.id) ? "text-ink-2" : "font-semibold"}`}>{n.title}</span></Link></li>
      ))}</ul>
    </>
  );
}

function Team() {
  const { s } = useStore();
  const today = ymd(new Date()), month = today.slice(0, 7);
  const status = s.employees.map((e) => ({ e, day: s.attendance[e.id]?.[today], over: overtimeLevel(monthSummary(s.attendance, e.id, month, e.scheduled, s.conditions).overtime45).level }));
  const working = status.filter((x) => x.day?.start && !x.day.end).length, done = status.filter((x) => x.day?.start && x.day.end).length;
  const alerts = status.filter((x) => x.over === "warn" || x.over === "danger");
  return (
    <>
      <h2 className="mb-2 flex items-center gap-2 font-bold"><Users size={15} aria-hidden />全社の状況（今日）</h2>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">{[[working, "勤務中"], [done, "退勤済み"], [status.length - working - done, "打刻なし"]].map(([n, l]) => <div key={l} className="rounded-lg bg-surface-2 py-2"><div className="tabular text-xl font-bold">{n}</div><div className="text-[11.5px] text-ink-3">{l}</div></div>)}</div>
      {alerts.length > 0 ? <ul className="space-y-1 text-[13px]">{alerts.map((x) => <li key={x.e.id} className="flex justify-between"><span>{x.e.name}</span><Badge tone="warn">時間外 45h超</Badge></li>)}</ul> : <p className="text-[12.5px] text-ink-3">36協定の要注意者はいません。</p>}
      <div className="mt-3"><More href="/attendance">全員の月次集計</More></div>
    </>
  );
}

function ReportsTeam() {
  const { s } = useStore();
  const today = ymd(new Date());
  const missing = s.employees.filter((e) => s.attendance[e.id]?.[today]?.start && s.reports[e.id]?.[today]?.status !== "提出済");
  const submitted = s.employees.filter((e) => s.reports[e.id]?.[today]?.status === "提出済").length;
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><NotebookPen size={15} aria-hidden />日報の提出状況（今日）</h2><More href="/reports">確認する</More></div>
      <p className="mb-2 text-[13px]">提出 <b className="tabular">{submitted}</b> / {s.employees.length}名</p>
      {missing.length > 0 ? <p className="text-[12.5px] text-warn">出勤して未提出：{missing.map((e) => e.name).join("、")}</p> : <p className="text-[12.5px] text-ink-3">出勤者の未提出はありません。</p>}
    </>
  );
}

function LeaveAlert() {
  const { s } = useStore();
  const today = ymd(new Date());
  const al = s.employees.map((e) => ({ e, p: paidLeave(e, s.attendance[e.id], today) })).filter((x) => x.p?.obligation && x.p.needMore > 0 && x.p.daysToDeadline <= 120);
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><CalendarCheck2 size={15} aria-hidden />有給5日取得（要対応）</h2><More href="/leave">有給管理へ</More></div>
      {al.length === 0 ? <p className="text-[12.5px] text-ink-3">期限が近い未達者はいません。</p> : <ul className="space-y-1 text-[13px]">{al.map(({ e, p }) => <li key={e.id} className="flex justify-between"><span>{e.name}</span><Badge tone="warn">あと{p?.needMore}日（{p?.nextGrant}まで）</Badge></li>)}</ul>}
    </>
  );
}

function KpiSummary() {
  const { s } = useStore();
  const month = ymd(new Date()).slice(0, 7);
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Target size={15} aria-hidden />KPI（{Number(month.slice(5))}月）</h2><More href="/kpi">KPI管理へ</More></div>
      {s.kpis.length === 0 ? <p className="text-[12.5px] text-ink-3">KPIが登録されていません。</p> : <ul className="space-y-2 text-[13px]">{s.kpis.slice(0, 5).map((k) => { const a = kpiAttainment(k, month); return <li key={k.id}><div className="flex justify-between"><span className="truncate">{k.name}</span><span className="tabular text-ink-2">{a.rate == null ? "未入力" : `${Math.round(a.rate * 100)}%`}</span></div><Progress value={(a.rate ?? 0) * 100} tone={a.ok ? "good" : (a.rate ?? 0) >= 0.8 ? "warn" : "bad"} /></li>; })}</ul>}
    </>
  );
}

function ExcelCard() {
  const { s } = useStore();
  const month = ymd(new Date()).slice(0, 7);
  return (
    <>
      <h2 className="mb-1 flex items-center gap-2 font-bold"><FileSpreadsheet size={15} aria-hidden />給与計算への連携</h2>
      <p className="mb-3 text-[12.5px] text-ink-2">{monthLabel(month)}の勤怠（{s.employees.length}名）を、勤怠ブック→賃金計算ブックに反映します。</p>
      <Link href="/excel" className="btn btn-primary w-full">Excel連携を開く</Link>
    </>
  );
}

/** col: 広い画面で置く列（main=広い列／side=狭い列）。列ごとに上から詰めて並べるので、カードの下に不要な空白ができない */
/** 管理者向け：セキュリティの要対応（承認待ちの端末・未確認のアラート） */
function SecurityWidget() {
  const [sum, setSum] = useState<{ alerts: number; high: number; pending: number } | null>(STATIC ? { alerts: 2, high: 2, pending: 1 } : null);
  useEffect(() => {
    if (STATIC) return;
    let alive = true;
    const load = () => fetch(`${BASE}/api/security`, { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j) setSum({ alerts: (j.alerts ?? []).filter((a: { ack?: boolean }) => !a.ack).length, high: (j.alerts ?? []).filter((a: { ack?: boolean; level: string }) => !a.ack && a.level === "high").length, pending: (j.devices ?? []).filter((d: { status: string }) => d.status === "pending").length }); }).catch(() => {});
    const t0 = setTimeout(load, 0), t = setInterval(load, 60_000);
    return () => { alive = false; clearTimeout(t0); clearInterval(t); };
  }, []);
  const bad = !!sum && (sum.high > 0 || sum.pending > 0);
  return (
    <>
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><ShieldAlert size={15} aria-hidden />セキュリティ{STATIC ? "（サンプル）" : ""}</h2><More href="/security">確認する</More></div>
      {!sum ? <p className="text-[12.5px] text-ink-3">確認中…</p> : (
        <div className="grid grid-cols-2 gap-2 text-center"><div className={`rounded-lg py-2 ${sum.alerts ? "bg-bad-soft" : "bg-surface-2"}`}><div className="tabular text-xl font-bold">{sum.alerts}</div><div className="text-[11.5px] text-ink-3">未確認のアラート</div></div><div className={`rounded-lg py-2 ${sum.pending ? "bg-warn-soft" : "bg-surface-2"}`}><div className="tabular text-xl font-bold">{sum.pending}</div><div className="text-[11.5px] text-ink-3">承認待ちの端末</div></div></div>
      )}
      {bad ? <p className="mt-2 text-[12.5px] text-bad">不審なアクセスの可能性があります。内容を確認してください。</p> : <p className="mt-2 text-[12.5px] text-ink-3">登録端末・許可ネットワークで保護されています。</p>}
    </>
  );
}

export type WidgetDef = { id: string; title: string; col: "main" | "side"; flat?: boolean; show: (role: Parameters<typeof can.admin>[0]) => boolean; C: () => ReactNode };
export const WIDGETS: WidgetDef[] = [
  { id: "punch", title: "打刻", col: "side", show: () => true, C: TodayCard },
  { id: "attendance", title: "今月の勤怠", col: "main", show: () => true, C: Attendance },
  { id: "todo", title: "ToDo・承認依頼", col: "main", show: () => true, C: Todo },
  { id: "schedule", title: "スケジュール", col: "main", show: () => true, C: Schedule },
  { id: "quick", title: "よく使う操作", col: "side", show: () => true, C: Quick },
  { id: "report", title: "今日の日報", col: "side", show: () => true, C: ReportToday },
  { id: "leave", title: "有給休暇", col: "side", show: () => true, C: LeaveMine },
  { id: "team", title: "全社の状況", col: "main", show: can.viewAllAttendance, C: Team },
  { id: "reportsTeam", title: "日報の提出状況", col: "side", show: can.viewAllReports, C: ReportsTeam },
  { id: "leaveAlert", title: "有給5日取得（要対応）", col: "side", show: can.viewAllLeave, C: LeaveAlert },
  { id: "kpi", title: "KPI", col: "main", show: (r) => r !== "employee", C: KpiSummary },
  { id: "security", title: "セキュリティ", col: "side", show: can.manageSecurity, C: SecurityWidget },
  { id: "excel", title: "給与計算への連携", col: "side", show: can.excel, C: ExcelCard },
  { id: "news", title: "お知らせ", col: "main", flat: true, show: () => true, C: NewsList },
];
/** 初期の表示順（一般社員／役職者で異なる）。勤怠のすぐ下にお知らせ。ToDoと全社の状況の間に大きなスケジュール枠。役職者向けのウィジェットは役職者のみ */
export const DEFAULT_ORDER = {
  employee: ["punch", "attendance", "news", "todo", "schedule", "report", "leave", "quick"],
  lead: ["punch", "attendance", "news", "todo", "schedule", "team", "kpi", "security", "reportsTeam", "leaveAlert", "excel", "report", "leave", "quick"],
} as const;
