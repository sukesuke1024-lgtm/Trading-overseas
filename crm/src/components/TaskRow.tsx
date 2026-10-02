"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import type { Data, Task } from "@/lib/types";
import { activityLabel, flag } from "@/lib/constants";
import { completeTask, updateTask } from "@/lib/store";
import { ActivityIcon, Avatar, DueChip } from "./ui";

export function TaskRow({ d, t, editable = true, showAssignee = false }: { d: Data; t: Task; editable?: boolean; showAssignee?: boolean }) {
  const org = d.organizations.find((o) => o.id === t.orgId);
  const deal = d.deals.find((x) => x.id === t.dealId);
  const user = d.users.find((u) => u.id === t.assigneeId);
  const done = t.status === "done";
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/60">
      <button disabled={!editable} onClick={() => completeTask(t.id, !done)} aria-label={done ? "未完了に戻す" : "完了にする"}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition ${done ? "bg-good text-white" : "bg-surface text-transparent shadow-[0_0_0_1.5px_var(--line-strong)] hover:text-good hover:shadow-[0_0_0_1.5px_var(--good)]"} disabled:opacity-40`}>
        <Check size={12} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[13.5px] font-medium leading-snug ${done ? "text-ink-3 line-through" : ""}`}>{t.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-1"><ActivityIcon type={t.type} size={11} />{activityLabel(t.type)}</span>
          {org && <Link href={`/customers/view/?id=${org.id}`} className="hover:text-ink hover:underline">{flag(org.country)} {org.name}</Link>}
          {deal && <Link href={`/deals/view/?id=${deal.id}`} className="hover:text-ink hover:underline">{deal.name}</Link>}
          {showAssignee && user && <span className="inline-flex items-center gap-1"><Avatar user={user} size={14} />{user.name}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editable && !done ? (
          <label className="relative cursor-pointer" title="期限を変更">
            <DueChip due={t.dueDate} />
            <input type="date" value={t.dueDate ?? ""} onChange={(e) => updateTask(t.id, { dueDate: e.target.value || null })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="期限" />
          </label>
        ) : <DueChip due={t.dueDate} done={done} />}
      </div>
    </div>
  );
}
