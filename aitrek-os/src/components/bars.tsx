"use client";

import { useState } from "react";

/**
 * 単一系列の横棒グラフ（大きさの比較＝単色）。値ラベルは常に表示し、ホバーで詳細を出す。
 */
export function HBars({ data, format = (v) => String(v), sub }: { data: { label: string; value: number; sub?: string }[]; format?: (v: number) => string; sub?: (i: number) => string | undefined }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="py-6 text-center text-[12.5px] text-ink-3">データがありません</p>;
  return (
    <ul className="flex flex-col gap-1.5" role="list">
      {data.map((d, i) => (
        <li
          key={d.label}
          className="group relative grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2.5 rounded px-1 py-0.5 hover:bg-surface-2"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="truncate text-[12px] text-ink-2">{d.label}</span>
          <span className="relative h-3.5">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] bg-bar transition-opacity"
              style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`, opacity: hover === null || hover === i ? 1 : 0.45 }}
            />
          </span>
          <span className="tabular min-w-8 text-right text-[12px] font-medium text-ink">{format(d.value)}</span>
          {hover === i && (d.sub || sub?.(i)) && (
            <span className="pointer-events-none absolute -top-7 left-32 z-10 whitespace-nowrap rounded bg-[#16161a] px-2 py-1 text-[11px] text-white shadow">
              {d.label}：{format(d.value)}　{d.sub ?? sub?.(i)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
