"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageList } from "@/lib/paging";

export const PAGE_SIZE = 10;

/** 一覧を10件ずつに分ける。page は件数が減っても範囲内に収める */
export function usePaged<T>(rows: T[], size = PAGE_SIZE, resetKey: unknown = "") {
  const [p, setP] = useState(1);
  useEffect(() => { const t = setTimeout(() => setP(1), 0); return () => clearTimeout(t); }, [resetKey]); // 絞り込みを変えたら1ページ目へ
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(p, pages);
  return { page, pages, setPage: setP, total: rows.length, items: rows.slice((page - 1) * size, page * size), from: rows.length ? (page - 1) * size + 1 : 0, to: Math.min(page * size, rows.length) };
}

export function Pager({ pg }: { pg: Pick<ReturnType<typeof usePaged>, "page" | "pages" | "setPage" | "total" | "from" | "to"> }) {
  if (pg.total <= 0) return null;
  const btn = "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[13px] tabular";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12.5px] text-ink-2" aria-label="ページ送り">
      <span className="tabular">{pg.total}件中 {pg.from}–{pg.to}件</span>
      {pg.pages > 1 && (
        <div className="flex items-center gap-1">
          <button className={`${btn} border-line-strong disabled:opacity-40`} disabled={pg.page <= 1} onClick={() => pg.setPage(pg.page - 1)} aria-label="前のページ"><ChevronLeft size={15} /></button>
          {pageList(pg.page, pg.pages).map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1">…</span> : <button key={n} className={`${btn} ${n === pg.page ? "border-brand bg-brand font-bold text-white" : "border-line-strong hover:bg-surface-2"}`} aria-current={n === pg.page ? "page" : undefined} aria-label={`${n}ページ`} onClick={() => pg.setPage(n)}>{n}</button>)}
          <button className={`${btn} border-line-strong disabled:opacity-40`} disabled={pg.page >= pg.pages} onClick={() => pg.setPage(pg.page + 1)} aria-label="次のページ"><ChevronRight size={15} /></button>
        </div>
      )}
    </nav>
  );
}
