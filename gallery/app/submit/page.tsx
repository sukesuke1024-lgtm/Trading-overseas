"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Preview from "@/components/Preview";
import { CATEGORIES } from "@/lib/categories";

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export default function Submit() {
  const router = useRouter();
  const [code, setCode] = useState('<div class="flex min-h-[200px] items-center justify-center bg-slate-950">\n  <button class="rounded-lg bg-emerald-500 px-5 py-2 font-medium text-emerald-950">Hello</button>\n</div>');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(fd), code }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) router.push(`/c/${data.slug}`);
    else setErrors(data.errors ?? { form: data.error ?? "投稿に失敗しました。" });
  }

  const err = (k: string) =>
    errors[k] ? <p role="alert" className="mt-1 text-xs text-red-400">{errors[k]}</p> : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10">
      <h1 className="text-3xl font-bold tracking-tight">コンポーネントを投稿</h1>
      <p className="mt-1 text-muted">HTML + Tailwind のクラスで書いたスニペットを共有できます。</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">タイトル</label>
            <input id="title" name="title" required className={field} placeholder="例: Glow Button" />
            {err("title")}
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">説明</label>
            <input id="description" name="description" className={field} placeholder="一言で何をするコンポーネントか" />
            {err("description")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium">カテゴリ</label>
              <select id="category" name="category" defaultValue="" className={field}>
                <option value="" disabled>選択…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {err("category")}
            </div>
            <div>
              <label htmlFor="author" className="mb-1 block text-sm font-medium">投稿者名</label>
              <input id="author" name="author" className={field} placeholder="Anonymous" />
            </div>
          </div>
          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium">タグ(カンマ区切り)</label>
            <input id="tags" name="tags" className={field} placeholder="button, cta" />
          </div>
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium">コード</label>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              spellCheck={false}
              className={`${field} font-mono text-[13px]`}
            />
            {err("code")}
          </div>
          {err("form")}
          <button
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "投稿中…" : "投稿する"}
          </button>
        </form>

        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Live preview</p>
          <Preview code={code} title="Draft" height={360} />
        </div>
      </div>
    </main>
  );
}
