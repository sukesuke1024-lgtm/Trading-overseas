/** 表示するページ番号（1 2 3 … 10 のように、多いときは省略記号でつなぐ） */
export function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const s = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...s].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) { if (n - prev > 1) out.push("…"); out.push(n); prev = n; }
  return out;
}

