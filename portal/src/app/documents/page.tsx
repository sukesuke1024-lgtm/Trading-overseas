"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Download } from "lucide-react";
import { DOCS } from "@/lib/data";
import { Badge, Empty, PageHeader } from "@/components/ui";

const KINDS = ["すべて", "規程", "マニュアル", "様式", "ガイドライン"] as const;

export default function Documents() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("すべて");
  const t = q.trim().toLowerCase();
  const rows = DOCS.filter((x) => (kind === "すべて" || x.kind === kind) && (!t || `${x.title}${x.summary}${x.owner}${x.tags.join("")}`.toLowerCase().includes(t)));
  const download = (title: string, body: string) => {
    const blob = new Blob([`${title}\n\n${body}\n\n※デモ用のダミー文書です。`], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${title}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <PageHeader title="文書ライブラリ" sub="社内規程・マニュアル・様式。常に最新版のみを掲載しています（旧版は法務部で保管）。" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-72" placeholder="タイトル・内容・タグで検索" value={q} onChange={(e) => setQ(e.target.value)} aria-label="検索" />
        {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[12.5px] ${kind === k ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{k}</button>)}
      </div>
      <div className="card divide-y divide-line">
        {rows.map((x) => (
          <div key={x.id} className="flex items-start gap-3 px-4 py-3">
            <FileText size={18} className="mt-1 shrink-0 text-brand-2" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{x.title}</span><Badge tone="brand">{x.kind}</Badge><span className="tabular text-[12px] text-ink-3">{x.version}・改定 {x.revised}</span></div>
              <p className="text-[13px] text-ink-2">{x.summary}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-ink-3">主管：{x.owner}{x.tags.map((g) => <span key={g} className="rounded bg-surface-2 px-1.5">#{g}</span>)}</div>
            </div>
            <button className="btn !h-8 shrink-0" onClick={() => download(x.title, x.summary)}><Download size={14} />取得</button>
          </div>
        ))}
        {rows.length === 0 && <Empty>該当する文書がありません</Empty>}
      </div>
    </div>
  );
}
