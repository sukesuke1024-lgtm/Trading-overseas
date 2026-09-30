"use client";

import type { ReactNode } from "react";

export type W5hItem = { key: "when" | "where" | "who" | "what" | "why" | "how"; label: string; value?: string };
export const W5H_LABEL = { when: "いつ（When）", where: "どこで（Where）", who: "誰が（Who）", what: "何を（What）", why: "なぜ（Why）", how: "どのように（How）" } as const;

export const completeness = (items: W5hItem[]) => items.filter((i) => i.value && i.value.trim()).length;

/** 5W1H を6項目のカードで表示（未入力は「未記入」を強調して、記録の抜けに気づけるようにする） */
export function W5hCard({ items, title = "5W1H", footer }: { items: W5hItem[]; title?: string; footer?: ReactNode }) {
  const n = completeness(items);
  return (
    <section className="rounded-lg border border-line bg-bg p-3 avoid-break" aria-label={title}>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-ink-2">{title}</h3><span className={`tabular rounded-full px-2 py-0.5 text-[11px] font-semibold ${n === items.length ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{n}/{items.length}</span></div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.key} className="min-w-0"><dt className="text-[11px] font-semibold text-ink-3">{i.label}</dt><dd className={`break-words text-[13px] ${i.value ? "" : "text-warn"}`}>{i.value || "未記入"}</dd></div>
        ))}
      </dl>
      {footer}
    </section>
  );
}
