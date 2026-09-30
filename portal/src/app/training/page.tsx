"use client";

import { COURSES } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";

export default function Training() {
  const { s, d, meId } = useStore();
  const prog = s.progress[meId] ?? {};
  const req = COURSES.filter((c) => c.required);
  const done = req.filter((c) => (prog[c.id] ?? 0) >= 100).length;
  const overdue = (due?: string) => !!due && due < new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="研修・eラーニング" sub="必須研修（コンプライアンス）の受講状況は人事部・所属長に共有されます。" />
      <div className="card mb-5 p-4">
        <div className="mb-1 flex justify-between font-bold"><span>必須研修 修了状況</span><span className="tabular">{done} / {req.length}</span></div>
        <Progress value={(done / req.length) * 100} tone={done === req.length ? "good" : "brand"} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {COURSES.map((c) => {
          const p = prog[c.id] ?? 0;
          return (
            <div key={c.id} className="card flex flex-col p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone={c.required ? "bad" : "gray"}>{c.required ? "必須" : "任意"}</Badge><span className="text-[12px] text-ink-3">{c.category}・約{c.minutes}分</span>{c.due && <span className={`tabular text-[12px] ${overdue(c.due) && p < 100 ? "font-semibold text-bad" : "text-ink-3"}`}>期限 {c.due}</span>}</div>
              <div className="mb-3 font-semibold">{c.title}</div>
              <div className="mt-auto">
                <div className="mb-1 flex justify-between text-[12px] text-ink-3"><span>{p >= 100 ? "修了" : p > 0 ? "受講中" : "未受講"}</span><span className="tabular">{p}%</span></div>
                <Progress value={p} tone={p >= 100 ? "good" : "brand"} />
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-primary !h-8" disabled={p >= 100} onClick={() => d({ t: "progress", emp: meId, id: c.id, v: p + 20 })}>{p === 0 ? "受講開始" : p >= 100 ? "修了済み" : "続きから（+20%）"}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
