"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { addTask, useMe, useStore } from "@/lib/store";
import { nextActionOf, openDeals } from "@/lib/selectors";
import { flag } from "@/lib/constants";
import { addDays, endOfWeek, todayStr } from "@/lib/dates";
import { Empty, PageHeader, Segmented, StageChip } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import type { Task } from "@/lib/types";

export default function Tasks() {
  const d = useStore().data!;
  const me = useMe()!;
  const [scope, setScope] = useState<"me" | "all">("me");
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState(""); const [due, setDue] = useState(addDays(todayStr(), 1)); const [orgId, setOrgId] = useState("");
  const t = todayStr(), we = endOfWeek();
  const mine = (k: Task) => scope === "all" || k.assigneeId === me.id;

  const g = useMemo(() => {
    const open = d.tasks.filter((k) => k.status === "open" && mine(k)).sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
    return {
      overdue: open.filter((k) => k.dueDate && k.dueDate < t), today: open.filter((k) => k.dueDate === t),
      week: open.filter((k) => k.dueDate && k.dueDate > t && k.dueDate <= we), later: open.filter((k) => k.dueDate && k.dueDate > we), none: open.filter((k) => !k.dueDate),
      done: d.tasks.filter((k) => k.status === "done" && mine(k)).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")).slice(0, 15),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, scope, t, we, me.id]);
  const missing = openDeals(d).filter((x) => !nextActionOf(d, x.id) && (scope === "all" || x.ownerId === me.id));

  const group = (label: string, items: Task[], tone?: string) => items.length === 0 ? null : (
    <section key={label} className="card">
<div className="card-h"><h2 className={`card-t ${tone ?? ""}`}>{label}<span className="ml-2 text-xs font-normal text-ink-3">{items.length}件</span></h2></div>
      <div className="mt-1 divide-y divide-line pb-1">{items.map((k) => <TaskRow key={k.id} d={d} t={k} showAssignee={scope === "all"} editable={me.role !== "sales" || k.assigneeId === me.id} />)}</div></section>
  );
  const none = g.overdue.length + g.today.length + g.week.length + g.later.length + g.none.length === 0;

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title="Task / Next Action" sub="期限の近い順。左の○で完了、期限バッジをクリックで日付変更"
        actions={<Segmented value={scope} onChange={setScope} options={[{ id: "me", label: "自分" }, { id: "all", label: "チーム全体" }]} />} />
      <form className="card mb-5 flex flex-wrap items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; addTask({ title: title.trim(), type: "other", orgId: orgId || null, dealId: null, contactId: null, assigneeId: me.id, dueDate: due || null, isNextAction: false }); setTitle(""); }}>
        <input className="input !w-auto min-w-[200px] flex-1" placeholder="Task を追加（例：香港出張の訪問先を調整）" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="select !w-auto" value={orgId} onChange={(e) => setOrgId(e.target.value)}><option value="">顧客：なし</option>{d.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <input type="date" className="input !w-auto" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn btn-primary" type="submit"><Plus size={14} />追加</button>
      </form>

      {missing.length > 0 && (
        <section className="mb-5 rounded-xl bg-bad-soft p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-bad"><AlertTriangle size={14} />Next Action が未設定の案件 {missing.length}件</h2>
          <ul className="space-y-1.5">{missing.map((x) => <li key={x.id}><Link href={`/deals/view/?id=${x.id}`} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px] font-medium hover:shadow-[var(--shadow)]"><span className="min-w-0 flex-1 truncate">{x.name}<span className="ml-2 text-[11.5px] font-normal text-ink-3">{flag(d.organizations.find((o) => o.id === x.orgId)?.country ?? "")} {d.organizations.find((o) => o.id === x.orgId)?.name}</span></span><StageChip stage={x.stage} /><span className="text-xs text-accent-2">設定する →</span></Link></li>)}</ul>
        </section>
      )}

      <div className="space-y-5">
        {group("期限超過", g.overdue, "!text-bad")}
        {group("今日", g.today)}
        {group("今週", g.week)}
        {group("来週以降", g.later)}
        {group("期限なし", g.none)}
        {none && <div className="card"><Empty title="未完了の Task はありません" hint="お疲れさまでした。新しい Next Action を設定して、案件を前に進めましょう。" /></div>}
        <button className="btn btn-ghost" onClick={() => setShowDone((v) => !v)}>{showDone ? "完了済みを隠す" : `完了済みを表示（${g.done.length}件）`}</button>
        {showDone && group("完了済み（直近）", g.done)}
      </div>
    </div>
  );
}
