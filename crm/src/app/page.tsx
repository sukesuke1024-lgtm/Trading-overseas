"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Bell, CalendarClock, CheckCircle2, ExternalLink, Flame, Megaphone, TrendingUp } from "lucide-react";
import { useMe, useStore } from "@/lib/store";
import { dashboardStats, dealJPY, FOLLOW_LABEL, nextActionOf, openDeals, weighted } from "@/lib/selectors";
import { OPEN_STAGES, flag } from "@/lib/constants";
import { fmtDate, monthKey, todayStr } from "@/lib/dates";
import { yenShort } from "@/lib/format";
import { Avatar, PageHeader, Segmented, StageChip, stageColor, Empty } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { canSeeBoard } from "@/components/Shell";
import { PORTAL_URL } from "@/lib/asset";

const NEWS = [
  { tag: "お知らせ", title: "11月 Food Expo（シンガポール）の出展申込を開始しました", date: "10/1", href: PORTAL_URL },
  { tag: "社内", title: "輸出書類テンプレート（PI/CI/PL）を更新しました", date: "9/28", href: PORTAL_URL },
  { tag: "研修", title: "【必須】輸出管理・コンプライアンス研修（10月分）", date: "9/25", href: PORTAL_URL },
];

export default function Dashboard() {
  const d = useStore().data!;
  const me = useMe()!;
  const [scope, setScope] = useState<"me" | "team">(me.role === "sales" ? "me" : "team");
  const st = useMemo(() => dashboardStats(d, scope === "me" ? me.id : null), [d, scope, me.id]);
  const t = todayStr();
  const hour = new Date().getHours();
  const todayList = [...st.overdue, ...st.today].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const byStage = OPEN_STAGES.map((s) => {
    const xs = st.deals.filter((x) => x.stage === s.id);
    return { s, n: xs.length, amt: xs.reduce((a, x) => a + dealJPY(x), 0) };
  });
  const maxAmt = Math.max(1, ...byStage.map((x) => x.amt));
  const monthDeals = st.deals.filter((x) => x.expectedCloseDate && monthKey(x.expectedCloseDate) === monthKey(t));
  const monthWon = d.deals.filter((x) => x.stage === "won" && x.closedAt && monthKey(x.closedAt) === monthKey(t) && (scope === "team" || x.ownerId === me.id));

  const team = d.users.map((u) => {
    const ds = openDeals(d).filter((x) => x.ownerId === u.id);
    const od = d.tasks.filter((k) => k.assigneeId === u.id && k.status === "open" && k.dueDate && k.dueDate < t).length;
    const noNext = ds.filter((x) => !nextActionOf(d, x.id)).length;
    return { u, n: ds.length, amt: ds.reduce((a, x) => a + dealJPY(x), 0), od, noNext };
  }).filter((x) => x.n > 0 || x.od > 0);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title={`${hour < 11 ? "おはようございます" : "お疲れさまです"}、${me.name}さん`}
        sub={`${fmtDate(t, true)}　今日やること ${todayList.length}件`}
        actions={<>
          {me.role !== "sales" && <Segmented value={scope} onChange={setScope} options={[{ id: "team", label: "チーム全体" }, { id: "me", label: "自分" }]} />}
          {me.role === "sales" && <Segmented value={scope} onChange={setScope} options={[{ id: "me", label: "自分" }, { id: "team", label: "チーム全体" }]} />}
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={<CheckCircle2 size={15} />} label="今日のタスク" value={st.today.length} unit="件" href="/tasks/" />
        <Kpi icon={<AlertTriangle size={15} />} label="期限超過" value={st.overdue.length} unit="件" tone={st.overdue.length ? "bad" : undefined} href="/tasks/" />
        <Kpi icon={<CalendarClock size={15} />} label="今週の商談" value={st.meetings.length} unit="件" sub="訪問・Online" href="/tasks/" />
        <Kpi icon={<Flame size={15} />} label="要フォロー案件" value={st.follow.length} unit="件" tone={st.follow.length ? "warn" : undefined} href="/deals/?follow=1" />
        <Kpi icon={<TrendingUp size={15} />} label="進行中の案件総額" value={yenShort(st.total)} sub={`確度加重 ${yenShort(st.weighted)}`} href="/pipeline/" wide />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <section className="card anim-rise">
            <div className="card-h"><h2 className="card-t">今日やること</h2><Link href="/tasks/" className="text-xs text-ink-3 hover:text-ink">すべて見る →</Link></div>
            <div className="mt-2 divide-y divide-line pb-1">
              {todayList.length === 0 && <Empty icon={<CheckCircle2 size={22} />} title="今日の予定はすべて完了しています" hint="新しい Next Action を設定して、案件を前に進めましょう。" />}
              {todayList.map((k) => <TaskRow key={k.id} d={d} t={k} showAssignee={scope === "team"} editable={me.role !== "sales" || k.assigneeId === me.id} />)}
            </div>
          </section>

          <section className="card anim-rise" style={{ animationDelay: ".05s" }}>
            <div className="card-h"><h2 className="card-t">要フォロー案件<span className="ml-2 text-xs font-normal text-ink-3">Next Action 未設定・期限超過・14日以上接触なし</span></h2></div>
            <div className="mt-2 divide-y divide-line pb-1">
              {st.follow.length === 0 && <Empty title="要フォローの案件はありません" />}
              {st.follow.map(({ deal, reasons }) => {
                const org = d.organizations.find((o) => o.id === deal.orgId);
                const owner = d.users.find((u) => u.id === deal.ownerId);
                return (
                  <Link key={deal.id} href={`/deals/view/?id=${deal.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                    <Avatar user={owner} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{deal.name}</div>
                      <div className="truncate text-[11.5px] text-ink-3">{flag(org?.country ?? "")} {org?.name}</div>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1 sm:flex">{reasons.map((r) => <span key={r} className={`chip ${r === "stale" ? "chip-warn" : "chip-bad"}`}>{FOLLOW_LABEL[r]}</span>)}</div>
                    <ArrowUpRight size={14} className="text-ink-3" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="card anim-rise" style={{ animationDelay: ".1s" }}>
            <div className="card-h"><h2 className="card-t">今週の商談（訪問・Online）</h2></div>
            <div className="mt-2 divide-y divide-line pb-1">
              {st.meetings.length === 0 && <Empty title="今週の商談予定はありません" />}
              {[...st.meetings].sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).map((k) => <TaskRow key={k.id} d={d} t={k} showAssignee={scope === "team"} editable={me.role !== "sales" || k.assigneeId === me.id} />)}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card anim-rise p-4" style={{ animationDelay: ".03s" }}>
            <div className="mb-3 flex items-baseline justify-between"><h2 className="card-t">ステージ別の案件</h2><Link href="/pipeline/" className="text-xs text-ink-3 hover:text-ink">パイプライン →</Link></div>
            <div className="space-y-2.5">
              {byStage.map(({ s, n, amt }) => (
                <div key={s.id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                  <span className="text-[12.5px] font-medium">{s.label}</span>
                  <div className="h-5 overflow-hidden rounded-md bg-surface-2"><div className="h-full rounded-md" style={{ width: `${Math.max(amt ? 4 : 0, (amt / maxAmt) * 100)}%`, background: stageColor(s.id), opacity: .85, transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} /></div>
                  <span className="w-[92px] text-right text-[12px] num text-ink-2">{n}件・{yenShort(amt)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card anim-rise p-4" style={{ animationDelay: ".06s" }}>
            <h2 className="card-t mb-3">今月の受注見込み</h2>
            <div className="grid grid-cols-3 gap-3">
              <Mini label="受注済み" value={yenShort(monthWon.reduce((a, x) => a + dealJPY(x), 0))} />
              <Mini label="予定（総額）" value={yenShort(monthDeals.reduce((a, x) => a + dealJPY(x), 0))} />
              <Mini label="予定（加重）" value={yenShort(monthDeals.reduce((a, x) => a + weighted(x), 0))} />
            </div>
            <div className="mt-3 space-y-1.5">
              {monthDeals.sort((a, b) => (a.expectedCloseDate ?? "").localeCompare(b.expectedCloseDate ?? "")).slice(0, 4).map((x) => (
                <Link key={x.id} href={`/deals/view/?id=${x.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
                  <span className="num w-[52px] text-ink-3">{fmtDate(x.expectedCloseDate).replace(/（.）/, "")}</span><span className="flex-1 truncate font-medium">{x.name}</span><StageChip stage={x.stage} />
                </Link>
              ))}
              {monthDeals.length === 0 && <p className="text-xs text-ink-3">今月に受注予定の案件はありません。</p>}
            </div>
          </section>

          {me.role !== "sales" && scope === "team" && (
            <section className="card anim-rise p-4" style={{ animationDelay: ".09s" }}>
              <h2 className="card-t mb-3">担当別の状況</h2>
              <table className="tbl"><thead><tr><th>担当</th><th className="text-right">案件</th><th className="text-right">金額</th><th className="text-right">期限超過</th><th className="text-right">NA未設定</th></tr></thead>
                <tbody>{team.map(({ u, n, amt, od, noNext }) => (
                  <tr key={u.id}><td><span className="inline-flex items-center gap-2"><Avatar user={u} size={20} />{u.name}</span></td><td className="num text-right">{n}</td><td className="num text-right">{yenShort(amt)}</td>
                    <td className="text-right">{od ? <span className="chip chip-bad num">{od}</span> : <span className="text-ink-3">0</span>}</td><td className="text-right">{noNext ? <span className="chip chip-warn num">{noNext}</span> : <span className="text-ink-3">0</span>}</td></tr>
                ))}</tbody></table>
            </section>
          )}

          {canSeeBoard(me) && (
            <section className="card anim-rise p-4" style={{ animationDelay: ".1s" }}>
              <div className="mb-2 flex items-center justify-between"><h2 className="card-t inline-flex items-center gap-1.5"><Megaphone size={14} />営業部のお知らせ<span className="chip chip-accent ml-1">営業部限定</span></h2><Link href="/board/" className="text-xs text-ink-3 hover:text-ink">すべて →</Link></div>
              <ul className="divide-y divide-line">{[...d.notices].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date)).slice(0, 3).map((n) => <li key={n.id} className="py-2"><Link href="/board/" className="flex items-start gap-2 hover:text-accent-2"><span className="flex-1 text-[12.5px] font-medium leading-snug">{n.title}</span><span className="num text-[11px] text-ink-3">{n.date.slice(5).replace("-", "/")}</span></Link><div className="mt-0.5 flex flex-wrap gap-x-3">{n.urls.slice(0, 2).map((u) => <a key={u.url} href={u.url} target={u.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[11px] text-accent-2 hover:underline"><ExternalLink size={10} />{u.label}</a>)}</div></li>)}</ul>
            </section>
          )}

          <section className="card anim-rise p-4" style={{ animationDelay: ".12s" }}>
            <div className="mb-2 flex items-center justify-between"><h2 className="card-t inline-flex items-center gap-1.5"><Bell size={14} />社内ポータルからのお知らせ</h2><a href={PORTAL_URL} className="text-xs text-ink-3 hover:text-ink">ポータルへ →</a></div>
            <ul className="divide-y divide-line">
              {NEWS.map((n) => <li key={n.title}><a href={n.href} className="flex items-start gap-2.5 py-2 hover:text-accent-2"><span className="chip chip-accent mt-0.5">{n.tag}</span><span className="flex-1 text-[12.5px] leading-snug">{n.title}</span><span className="num text-[11px] text-ink-3">{n.date}</span></a></li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, unit, sub, tone, href, wide }: { icon: React.ReactNode; label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: "bad" | "warn"; href: string; wide?: boolean }) {
  const c = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <Link href={href} className={`card anim-rise group block p-4 transition hover:shadow-[0_4px_16px_rgb(16_18_23/10%),0_0_0_1px_var(--line-strong)] ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <div className="flex items-center justify-between text-ink-3"><span className="text-[12px] font-medium">{label}</span><span className={tone ? c : ""}>{icon}</span></div>
      <div className={`mt-2 text-[28px] font-bold leading-none tracking-tight num ${c}`}>{value}{unit && <span className="ml-1 text-[13px] font-medium text-ink-3">{unit}</span>}</div>
      <div className="mt-1.5 h-4 text-[11.5px] text-ink-3">{sub}</div>
    </Link>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-ink-3">{label}</div><div className="mt-0.5 text-[18px] font-bold num">{value}</div></div>;
}
