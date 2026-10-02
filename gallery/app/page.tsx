import Link from "next/link";
import Preview from "@/components/Preview";
import { CATEGORIES } from "@/lib/categories";
import { listComponents } from "@/lib/db";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; category?: string; sort?: string }>;

function href(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({ searchParams }: { searchParams: SP }) {
  const { q, category, sort } = await searchParams;
  const items = listComponents({ q, category, sort });

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Open component gallery</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            コピーして使える、
            <br />
            UIコンポーネントの置き場。
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            プレビューを見て、コードをコピー。あなたのコンポーネントも投稿できます。
          </p>
          <form action="/" className="mt-8 flex max-w-xl gap-2" role="search">
            <label htmlFor="q" className="sr-only">コンポーネントを検索</label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="例: button, card, navbar…"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {category && <input type="hidden" name="category" value={category} />}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <button className="shrink-0 whitespace-nowrap rounded-xl bg-fg px-5 font-semibold text-bg transition hover:bg-slate-200">検索</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" aria-label="カテゴリ">
            {[undefined, ...CATEGORIES].map((c) => {
              const active = (c ?? "") === (category ?? "");
              return (
                <Link
                  key={c ?? "all"}
                  href={href({ q, sort, category: c })}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line text-muted hover:text-fg hover:bg-surface"
                  }`}
                >
                  {c ?? "すべて"}
                </Link>
              );
            })}
          </div>
          <div className="flex gap-1 rounded-lg border border-line p-0.5 text-sm">
            {[
              ["", "新着"],
              ["popular", "人気"],
            ].map(([v, label]) => (
              <Link
                key={v}
                href={href({ q, category, sort: v || undefined })}
                className={`rounded-md px-3 py-1 ${(sort ?? "") === v ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-muted" aria-live="polite">{items.length} 件</p>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line p-12 text-center">
            <p className="font-medium">見つかりませんでした</p>
            <p className="mt-1 text-sm text-muted">
              別のキーワードを試すか、
              <Link href="/submit" className="text-accent underline underline-offset-4">新しく投稿</Link>
              してみてください。
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c, i) => (
              <li key={c.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link
                  href={`/c/${c.slug}`}
                  className="group block rounded-2xl border border-line bg-surface p-3 transition hover:border-accent/50"
                >
                  <Preview code={c.code} title={c.title} height={200} />
                  <div className="flex items-start justify-between gap-3 px-1 pb-1 pt-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:text-accent">{c.title}</p>
                      <p className="truncate text-xs text-muted">{c.category} · {c.author}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted">♥ {c.likes}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
