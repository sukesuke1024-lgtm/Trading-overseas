"use client";

import { useState } from "react";
import { Paperclip, Plus, X, ChevronDown } from "lucide-react";
import { updateTask } from "@/lib/automation";
import { CHECKLIST_GROUPS } from "@/lib/checklist";
import { TASK_STATUS } from "@/lib/constants";
import { fmtDate, today } from "@/lib/format";
import { useStore } from "@/lib/store/store";
import type { Task, TaskStatus } from "@/lib/types";
import { Button, Input, Progress, Select, Textarea, cx } from "./ui";

export function statusTone(s: TaskStatus) {
  return s === "done" ? "text-good" : s === "blocked" ? "text-warn" : s === "na" ? "text-ink-3" : s === "in_progress" ? "text-accent-2" : "text-ink-2";
}

/** 仕様書 ⑦ Export Checklist（担当者・Deadline・Status・Note・添付） */
export function Checklist({ dealId }: { dealId: string }) {
  const { db, run } = useStore();
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState(CHECKLIST_GROUPS[0]);
  const items = db.tasks.filter((t) => t.deal_id === dealId && t.kind === "checklist").sort((a, b) => a.sort_order - b.sort_order);
  const done = items.filter((t) => t.status === "done" || t.status === "na").length;
  const groups = Array.from(new Set([...CHECKLIST_GROUPS, ...items.map((i) => i.group_name)])).filter((g) => items.some((i) => i.group_name === g));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Progress value={items.length ? done / items.length : 0} />
        <span className="tabular shrink-0 text-[12px] text-ink-2">
          {done}/{items.length}
        </span>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <h4 className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">{g}</h4>
          <ul className="divide-y divide-line rounded-md border border-line">
            {items
              .filter((t) => t.group_name === g)
              .map((t) => (
                <ChecklistRow key={t.id} t={t} />
              ))}
          </ul>
        </div>
      ))}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          run((tx) =>
            tx.insert("tasks", {
              title: title.trim(),
              deal_id: dealId,
              kind: "checklist",
              group_name: group,
              assignee_id: tx.find("deals", dealId)?.owner_id ?? null,
              due_date: "",
              status: "todo",
              note: "",
              attachments: [],
              sort_order: items.length + 1,
              auto_key: "",
            }),
          );
          setTitle("");
        }}
      >
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-32">
          {CHECKLIST_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="項目を追加" className="min-w-40 flex-1" />
        <Button type="submit">
          <Plus size={14} /> 追加
        </Button>
      </form>
    </div>
  );
}

export function ChecklistRow({ t, showDeal }: { t: Task; showDeal?: boolean }) {
  const { db, run, upload } = useStore();
  const [open, setOpen] = useState(false);
  const overdue = t.due_date && t.due_date < today() && t.status !== "done" && t.status !== "na";
  const set = (patch: Partial<Task>) => run((tx) => updateTask(tx, tx.find("tasks", t.id)!, patch));
  const deal = showDeal && t.deal_id ? db.deals.find((d) => d.id === t.deal_id) : undefined;
  const assignee = db.members.find((m) => m.id === t.assignee_id);

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={t.status === "done"}
          onChange={(e) => set({ status: e.target.checked ? "done" : "todo" })}
          className="h-4 w-4 shrink-0 accent-[#1f3a5f]"
          aria-label={t.title}
        />
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className={cx("text-[13px]", t.status === "done" && "text-ink-3 line-through", t.status === "na" && "text-ink-3")}>{t.title}</span>
          {deal && <span className="ml-2 text-[11.5px] text-ink-3">{deal.code}</span>}
          <span className="ml-2 inline-flex flex-wrap gap-x-2 text-[11.5px]">
            {t.due_date && <span className={overdue ? "font-medium text-bad" : "text-ink-3"}>{fmtDate(t.due_date)}</span>}
            {assignee && <span className="text-ink-3">{assignee.name}</span>}
            {t.note && <span className="text-ink-3">✎</span>}
            {t.attachments.length > 0 && (
              <span className="text-ink-3">
                <Paperclip size={11} className="inline" /> {t.attachments.length}
              </span>
            )}
          </span>
        </button>
        <span className={cx("hidden text-[11.5px] sm:inline", statusTone(t.status))}>{TASK_STATUS.find((s) => s.key === t.status)?.label}</span>
        <button onClick={() => setOpen((o) => !o)} className="text-ink-3" aria-label="詳細">
          <ChevronDown size={15} className={cx("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-3">
          <Select value={t.status} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
            {TASK_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={t.assignee_id ?? ""} onChange={(e) => set({ assignee_id: e.target.value || null })}>
            <option value="">担当者なし</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={t.due_date} onChange={(e) => set({ due_date: e.target.value })} />
          <Textarea defaultValue={t.note} onBlur={(e) => e.target.value !== t.note && set({ note: e.target.value })} placeholder="Note" className="min-h-14 sm:col-span-3" />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            {t.attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[12px]">
                <a href={a.url} target="_blank" rel="noreferrer" download={a.name} className="hover:underline">
                  {a.name}
                </a>
                <button onClick={() => set({ attachments: t.attachments.filter((_, j) => j !== i) })} aria-label="削除" className="text-ink-3 hover:text-bad">
                  <X size={11} />
                </button>
              </span>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-line-strong px-2 py-0.5 text-[12px] text-ink-2 hover:bg-surface-2">
              <Paperclip size={12} /> 添付
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const a = await upload(f);
                  if (a) run((tx) => tx.update("tasks", t.id, { attachments: [...(tx.find("tasks", t.id)?.attachments ?? []), a] }), { ok: "添付しました" });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      )}
    </li>
  );
}
