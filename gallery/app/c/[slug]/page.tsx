import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import LikeButton from "@/components/LikeButton";
import Preview from "@/components/Preview";
import { getComponent } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getComponent(slug);
  if (!c) notFound();
  const tags = c.tags.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-8">
      <Link href="/" className="text-sm text-muted hover:text-fg">← 一覧に戻る</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{c.title}</h1>
          <p className="mt-1 text-muted">{c.description}</p>
          <p className="mt-2 text-xs text-muted">
            {c.category} · by {c.author} · {c.created_at.slice(0, 10)}
          </p>
        </div>
        <div className="flex gap-2">
          <LikeButton slug={c.slug} initial={c.likes} />
          <CopyButton text={c.code} />
        </div>
      </div>

      <div className="mt-6">
        <Preview code={c.code} title={c.title} height={380} />
      </div>

      <h2 className="mb-2 mt-8 font-mono text-xs uppercase tracking-widest text-muted">Code</h2>
      <pre className="max-h-[480px] overflow-auto rounded-xl border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-slate-200">
        <code>{c.code}</code>
      </pre>

      {tags.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t}>
              <Link href={`/?q=${encodeURIComponent(t)}`} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-fg">
                #{t}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
