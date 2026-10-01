import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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
  brand: "bg-surface-2 text-ink",
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

/**
 * H-LINK のロゴ。ライト/ナイトで自動的に切り替わる（CSSで html[data-theme] に応じて表示を切替）。
 *  circle（丸型）：ライト＝赤丸／ナイト＝黒丸　vertical（縦）・horizontal（横）：ライト＝通常／ナイト＝黒背景用
 *  dark=true は常に暗い背景（サイドバー等）なので、ナイト用を使う
 */
export function Logo({ variant = "circle", dark = false, height = 32, className = "" }: { variant?: "circle" | "horizontal" | "vertical"; dark?: boolean; height?: number; className?: string }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const night = variant === "circle" ? "logo-circle-black.png" : `logo-${variant}-night.png`;
  const day = variant === "circle" ? "logo-circle-red.png" : `logo-${variant}.png`;
  const style = { height, width: "auto" } as const;
  /* eslint-disable @next/next/no-img-element */
  if (dark) return <img src={`${base}/brand/${night}`} alt="H-LINK" height={height} style={style} className={className} />;
  return (
    <>
      <img src={`${base}/brand/${day}`} alt="H-LINK" height={height} style={style} className={`logo-day ${className}`} />
      <img src={`${base}/brand/${night}`} alt="H-LINK" height={height} style={style} className={`logo-night ${className}`} />
    </>
  );
}

/** こまごまとした内容を▸で折りたたむ（開くと▾に変わる）。補足説明・過去の記録・ルールの説明などに使う */
export function Fold({ title, children, defaultOpen = false, className = "" }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details className={`group rounded-lg border border-line ${className}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden"><ChevronRight size={15} aria-hidden className="shrink-0 transition-transform group-open:rotate-90" />{title}</summary>
      <div className="px-3 pb-3 pt-1 text-[12.5px] text-ink-2">{children}</div>
    </details>
  );
}
