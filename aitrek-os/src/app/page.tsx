"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { HBars } from "@/components/bars";
import { ActivityFeed, StageBadge } from "@/components/common";
import { Badge, Card, Stat, Table, cx } from "@/components/ui";
import { countryOf, stageLabel } from "@/lib/constants";
import { addDays, daysBetween, fmtDate, pct, today, yen, yenShort } from "@/lib/format";
import { activeDeals, alerts, countInMonth, groupCount, isOpenTask, monthly, outstanding, pipeline, financeOverdue } from "@/lib/insights";
import { useLookup, useStore } from "@/lib/store/store";

export default function Dashboard() {
  const { db, me } = useStore();
  const lk = useLookup();
  const now = today();
  const month = now.slice(0, 7);
  const weekEnd = addDays(now, 7);

  const m = useMemo(() => {
    const cur = monthly(db, month);
    const prevMonth = new Date(now);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prev = monthly(db, prevMonth.toISOString().slice(0, 7));
    const active = activeDeals(db);
    const openTasks = db.tasks.filter(isOpenTask);
    return {
      cur,
      prev,
      active,
      newLeads: db.deals.filter((d) => d.created_at.slice(0, 7) === month).length + db.buyers.filter((b) => b.created_at.slice(0, 7) === month && !db.deals.some((d) => d.buyer_id === b.id)).length,
      quotations: db.quotations.filter((q) => q.issue_date.slice(0, 7) === month && q.status !== "draft").length,
      samples: countInMonth(db, /→ Sample$/, month),
      won: countInMonth(db, /→ (Contract|Order)$/, month),
      shipments: countInMonth(db, /→ Shipment$/, month),
      unpaid: db.finance.reduce((s, f) => s + outstanding(f), 0),
      overdueFin: db.finance.filter((f) => financeOverdue(f, now)),
      weekTasks: openTasks.filter((t) => t.due_date && t.due_date >= now && t.due_date <= weekEnd).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      overdueTasks: openTasks.filter((t) => t.due_date && t.due_date < now).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      byCountry: groupCount(active, (d) => d.country),
      byCategory: groupCount(active, (d) => db.products.find((p) => p.id === d.product_id)?.category),
      pipe: pipeline(db),
      alerts: alerts(db),
    };
  }, [db, month, now, weekEnd]);

  // 「今どの案件が・どこで止まり・次に何をすべきか」
  const stuck = useMemo(() => {
    return m.active
      .map((d) => {
        const open = db.tasks.filter((t) => t.deal_id === d.id && isOpenTask(t));
        const overdue = open.filter((t) => t.due_date && t.due_date < now).sort((a, b) => a.due_date.localeCompare(b.due_date));
        const next = [...open].sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9"))[0];
        const late = d.deadline && d.deadline < now;
        const idle = daysBetween(d.updated_at.slice(0, 10), now);
        const score = overdue.length * 3 + (late ? 5 : 0) + (idle > 14 ? 2 : 0) + (!d.price_approved && ["quotation", "negotiation"].includes(d.stage) ? 2 : 0);
        const block = overdue[0]?.title ?? (late ? "Deal期限超過" : !d.price_approved && ["quotation", "negotiation"].includes(d.stage) ? "価格承認待ち" : idle > 14 ? `${idle}日更新なし` : "");
        return { d, overdue: overdue.length, next, block, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [m.active, db.tasks, now]);

  const delta = m.prev.revenue > 0 ? (m.cur.revenue - m.prev.revenue) / m.prev.revenue : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-ink-2">
            {fmtDate(now)}・{me ? `${me.name} さん` : ""}　今どの案件が・どこで止まり・次に何をすべきか
          </p>
        </div>
        {m.alerts.length > 0 && (
          <Badge tone={m.alerts.some((a) => a.level === "critical") ? "red" : "amber"}>
            <AlertTriangle size={12} /> 要対応 {m.alerts.filter((a) => a.level !== "info").length} 件
          </Badge>
        )}
      </div>

      {m.overdueFin.length > 0 && (
        <Link href="/finance" className="mb-4 flex items-center gap-2 rounded-lg border border-bad/25 bg-bad-soft px-4 py-2.5 text-[13px] text-bad hover:border-bad/50">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <b>Payment Alert：</b>入金期限超過 {m.overdueFin.length} 件（{yen(m.overdueFin.reduce((s, f) => s + outstanding(f), 0))}）
          </span>
          <ArrowRight size={14} className="ml-auto" />
        </Link>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="今月売上" value={yenShort(m.cur.revenue)} sub={delta == null ? "前月データなし" : `前月比 ${delta >= 0 ? "+" : ""}${pct(delta)}`} />
        <Stat label="今月粗利益" value={yenShort(m.cur.profit)} />
        <Stat label="粗利率" value={pct(m.cur.margin)} />
        <Stat label="商談件数" value={m.active.length} sub="進行中 Deal" />
        <Stat label="未入金額" value={yenShort(m.unpaid)} tone={m.overdueFin.length ? "bad" : m.unpaid ? "warn" : undefined} sub={m.overdueFin.length ? `期限超過 ${m.overdueFin.length} 件` : undefined} />
        <Stat label="期限超過Task" value={m.overdueTasks.length} tone={m.overdueTasks.length ? "bad" : "good"} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-5">
        <Stat label="新規Lead（今月）" value={m.newLeads} />
        <Stat label="見積提出数" value={m.quotations} />
        <Stat label="Sample発送数" value={m.samples} />
        <Stat label="成約件数" value={m.won} />
        <Stat label="Shipment数" value={m.shipments} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 止まっている案件 */}
        <Card title="要対応の案件（止まっている場所と次の一手）" className="xl:col-span-2" pad={false}>
          {stuck.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-ink-3">止まっている案件はありません 🎉</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Status</th>
                  <th>止まっている理由</th>
                  <th>次にやること</th>
                  <th>期限</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map(({ d, block, next, overdue }) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/deals/${d.id}`} className="font-medium hover:text-accent-2">
                        {d.code}
                      </Link>
                      <div className="max-w-48 truncate text-[11.5px] text-ink-3">
                        {countryOf(d.country)?.flag} {lk.buyer.get(d.buyer_id ?? "")?.company_name}
                      </div>
                    </td>
                    <td>
                      <StageBadge stage={d.stage} />
                    </td>
                    <td className="text-bad">
                      {block}
                      {overdue > 1 && <span className="ml-1 text-[11.5px] text-ink-3">他{overdue - 1}件</span>}
                    </td>
                    <td className="max-w-60">
                      <div className="truncate">{d.next_action || next?.title || "—"}</div>
                      {next && d.next_action && <div className="truncate text-[11.5px] text-ink-3">Task：{next.title}</div>}
                    </td>
                    <td className={cx("whitespace-nowrap", d.deadline < now && "font-semibold text-bad")}>{fmtDate(d.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="最新Activity" action={<Link href="/deals" className="text-[12px] text-accent-2">すべて</Link>}>
          <div className="max-h-[360px] overflow-y-auto">
            <ActivityFeed items={db.activities} showDeal limit={20} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Deal Pipeline（件数）" action={<Link href="/deals" className="text-[12px] text-accent-2">Pipeline</Link>}>
          <HBars data={m.pipe.map((s) => ({ label: s.label, value: s.count, sub: `見込売上 ${yenShort(s.amount)}` }))} />
        </Card>
        <Card title="国別案件数（進行中）">
          <HBars data={m.byCountry.map(([c, v]) => ({ label: `${countryOf(c)?.flag ?? ""} ${countryOf(c)?.name ?? c}`, value: v }))} />
        </Card>
        <Card title="商品カテゴリー別案件数（進行中）">
          <HBars data={m.byCategory.map(([c, v]) => ({ label: c, value: v }))} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskList title="今週のTask" tasks={m.weekTasks} empty="今週期限の Task はありません" />
        <TaskList title="期限超過Task" tasks={m.overdueTasks} empty="期限超過の Task はありません" danger />
      </div>
    </>
  );
}

function TaskList({ title, tasks, empty, danger }: { title: string; tasks: ReturnType<typeof useStore>["db"]["tasks"]; empty: string; danger?: boolean }) {
  const lk = useLookup();
  const now = today();
  return (
    <Card title={`${title}（${tasks.length}）`} action={<Link href="/tasks" className="text-[12px] text-accent-2">Tasks</Link>} pad={false}>
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-3">{empty}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {tasks.slice(0, 30).map((t) => {
            const deal = t.deal_id ? lk.deal.get(t.deal_id) : undefined;
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                <Clock size={13} className={danger ? "text-bad" : "text-ink-3"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{t.title}</div>
                  <div className="truncate text-[11.5px] text-ink-3">
                    {deal ? (
                      <Link href={`/deals/${deal.id}`} className="hover:text-accent-2">
                        {deal.code}・{stageLabel(deal.stage)}
                      </Link>
                    ) : (
                      "個別Task"
                    )}
                    {t.assignee_id && `・${lk.member.get(t.assignee_id)?.name ?? ""}`}
                  </div>
                </div>
                <span className={cx("tabular shrink-0 text-[12px]", danger ? "font-medium text-bad" : "text-ink-2")}>
                  {fmtDate(t.due_date)}
                  {danger && <span className="ml-1 text-[11px]">({daysBetween(t.due_date, now)}日)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
