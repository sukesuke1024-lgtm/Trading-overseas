"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ChecklistRow } from "@/components/checklist";
import { Button, Card, Empty, Input, PageHeader, Select, Tabs } from "@/components/ui";
import { addDays, today } from "@/lib/format";
import { isOpenTask } from "@/lib/insights";
import { useStore } from "@/lib/store/store";
import type { Task } from "@/lib/types";

type View = "overdue" | "week" | "open" | "done" | "all";

export default function TasksPage() {
  const { db, run, me } = useStore();
  const [view, setView] = useState<View>("week");
  const [who, setWho] = useState<string>("");
  const [kind, setKind] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(addDays(today(), 3));
  const [dealId, setDealId] = useState("");
  const now = today();
  const weekEnd = addDays(now, 7);

  const counts = useMemo(() => {
    const open = db.tasks.filter(isOpenTask);
    return {
      overdue: open.filter((t) => t.due_date && t.due_date < now).length,
      week: open.filter((t) => t.due_date && t.due_date >= now && t.due_date <= weekEnd).length,
      open: open.length,
    };
  }, [db.tasks, now, weekEnd]);

  const list = useMemo(() => {
    const f = (t: Task) => {
      if (who && t.assignee_id !== who) return false;
      if (kind && t.kind !== kind) return false;
      switch (view) {
        case "overdue":
          return isOpenTask(t) && !!t.due_date && t.due_date < now;
        case "week":
          return isOpenTask(t) && !!t.due_date && t.due_date >= now && t.due_date <= weekEnd;
        case "open":
          return isOpenTask(t);
        case "done":
          return !isOpenTask(t);
        default:
          return true;
      }
    };
    return db.tasks.filter(f).sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  }, [db.tasks, view, who, kind, now, weekEnd]);

  return (
    <>
      <PageHeader title="Tasks" subtitle="Export Checklist・自動生成Follow-up・個別Taskを横断管理" />
      <Card className="mb-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(
              (tx) =>
                tx.insert("tasks", {
                  title: title.trim(),
                  deal_id: dealId || null,
                  kind: "general",
                  group_name: "",
                  assignee_id: me?.id ?? null,
                  due_date: due,
                  status: "todo",
                  note: "",
                  attachments: [],
                  sort_order: 0,
                  auto_key: "",
                }),
              { ok: "Task を追加しました" },
            );
            setTitle("");
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新しい Task" className="min-w-52 flex-1" />
          <Select value={dealId} onChange={(e) => setDealId(e.target.value)} className="w-56">
            <option value="">Deal なし</option>
            {db.deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} {d.title}
              </option>
            ))}
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" />
          <Button variant="primary" type="submit">
            <Plus size={14} /> 追加
          </Button>
        </form>
      </Card>

      <Card pad={false}>
        <div className="px-3 pt-1">
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { key: "overdue", label: <span className={counts.overdue ? "text-bad" : ""}>期限超過 {counts.overdue}</span> },
              { key: "week", label: `今週 ${counts.week}` },
              { key: "open", label: `未完了 ${counts.open}` },
              { key: "done", label: "完了" },
              { key: "all", label: "すべて" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto">
            <option value="">担当：全員</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
            <option value="">種類：すべて</option>
            <option value="checklist">Export Checklist</option>
            <option value="followup">自動Follow-up</option>
            <option value="general">個別Task</option>
          </Select>
          <span className="self-center text-[12px] text-ink-3">{list.length} 件</span>
        </div>
        {list.length === 0 ? (
          <div className="p-4">
            <Empty>該当する Task はありません</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {list.slice(0, 300).map((t) => (
              <ChecklistRow key={t.id} t={t} showDeal />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
