"use client";
import { Suspense, type ReactNode } from "react";

/** 静的書き出しで useSearchParams を使うページ用の Suspense 境界 */
export function Suspended({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-ink-3">読み込み中…</div>}>{children}</Suspense>;
}
