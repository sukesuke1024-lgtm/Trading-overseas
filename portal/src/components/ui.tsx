import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-ink-2">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

const TONES = {
  gray: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-ink-3">{children}</div>;
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "good" | "warn" | "bad" }) {
  const c = { brand: "bg-brand-2", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${c}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
