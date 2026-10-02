"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, LifeBuoy, Search } from "lucide-react";
import { HELP, HELP_CATEGORIES } from "@/lib/help";
import { PageHeader } from "@/components/ui";

const QUICK = ["入金されない", "値引き", "為替", "L/C", "検疫", "返事が来ない", "見積", "クレーム", "契約", "チラシ"];
const norm = (s: string) => s.toLowerCase().replace(/[\s　／/・\-_]/g, "");

/** 困った時の逆引き辞典：症状・キーワードから、まずやること・相談先・使う画面を引く */
export default function Help() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const hits = useMemo(() => {
    const n = norm(q);
    return HELP.map((h) => {
      let score = 0;
      if (n) {
        if (norm(h.title).includes(n)) score += 10;
        score += h.keywords.filter((k) => norm(k).includes(n) || n.includes(norm(k))).length * 5;
        if (norm(h.steps.join("")).includes(n)) score += 1;
        if (!score) return null;
      }
      return (!cat || h.category === cat) ? { h, score } : null;
    }).filter(Boolean).sort((a, b) => b!.score - a!.score) as { h: (typeof HELP)[number]; score: number }[];
  }, [q, cat]);

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader title="困った時は（逆引き辞典）" sub="困りごとの言葉から探せます。『まずやること』と『誰に相談するか』、使う画面へのリンクをまとめています。" />
      <div className="card mb-4 p-4">
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-[13px] text-ink-3" /><input className="input !h-11 !pl-9 !text-[14px]" placeholder="例：入金されない／値引き／L/C／検疫／返事が来ない" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div className="mt-3 flex flex-wrap gap-1.5"><span className="mr-1 self-center text-[11.5px] text-ink-3">よくある：</span>{QUICK.map((w) => <button key={w} className="chip hover:bg-surface-3" onClick={() => setQ(w)}>{w}</button>)}</div>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3"><button className={`btn btn-sm ${!cat ? "btn-primary" : ""}`} onClick={() => setCat("")}>すべて</button>{HELP_CATEGORIES.map((c) => <button key={c} className={`btn btn-sm ${cat === c ? "btn-primary" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>

      <p className="mb-2 px-1 text-[12px] text-ink-3">{hits.length}件{q && `（「${q}」）`}</p>
      <ul className="space-y-2.5">
        {hits.map(({ h }) => {
          const on = open === h.id || hits.length === 1;
          return (
            <li key={h.id} className="card overflow-hidden">
              <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setOpen(on && hits.length > 1 ? null : h.id)} aria-expanded={on}>
                <span className="chip chip-accent shrink-0">{h.category}</span><span className="flex-1 text-[14px] font-semibold">{h.title}</span><span className="text-ink-3">{on ? "−" : "+"}</span>
              </button>
              {on && (
                <div className="anim-fade space-y-3 border-t border-line px-5 py-4 text-[13px]">
                  <div><h3 className="mb-1.5 text-[12px] font-bold text-ink-2">まずやること</h3><ol className="list-decimal space-y-1.5 pl-5 leading-relaxed">{h.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
                  {h.avoid && <p className="rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad"><b>避けること：</b>{h.avoid}</p>}
                  <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><LifeBuoy size={14} className="text-ink-3" /><b>相談先：</b>{h.ask}</p>
                  {h.links.length > 0 && <div className="flex flex-wrap gap-2">{h.links.map((l) => l.href ? <Link key={l.label} href={l.href} className="btn btn-sm">{l.label} →</Link> : <a key={l.label} href={l.url} target="_blank" rel="noreferrer noopener" className="btn btn-sm">{l.label}<ExternalLink size={11} /></a>)}</div>}
                </div>
              )}
            </li>
          );
        })}
        {hits.length === 0 && <li className="card px-6 py-10 text-center text-[13px] text-ink-2">該当する項目がありません。別の言葉（例：「入金」「価格」「書類」）で探すか、上長・先輩に相談してください。</li>}
      </ul>
    </div>
  );
}
