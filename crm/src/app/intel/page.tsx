"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { dataUrl } from "@/lib/asset";
import { useNow } from "@/lib/useNow";
import { PageHeader } from "@/components/ui";

interface Status { generatedAt: string | null; runs: { fx?: { ok: boolean; at?: string; lastOk?: string; error?: string }; sanctions?: { ok: boolean; at?: string; count?: number; lastOk?: string; error?: string }; feeds?: { id: string; name: string; ok: boolean; count?: number; at?: string; error?: string; url?: string; site?: string; verified?: boolean }[] } }
interface Item { title: string; link: string; date: string | null; summary: string; source: string; sourceName: string; category: string }
const j = async <T,>(f: string): Promise<T> => (await fetch(`${dataUrl(f)}?t=${Math.floor(Date.now() / 300000)}`, { cache: "no-store" })).json();
const agoAt = (iso: string | null | undefined, now: number) => { if (!iso) return "—"; const m = Math.round((now - Date.parse(iso)) / 60000); return m < 1 ? "たった今" : m < 60 ? `${m}分前` : m < 1440 ? `${Math.round(m / 60)}時間前` : `${Math.round(m / 1440)}日前`; };

/** 公的情報フィード：為替・制裁リスト・公式ニュース（官公庁のRSS）を、毎時自動で取り込んだ最新の状態を表示する */
export default function Intel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState("");
  const [tick, setTick] = useState(0);
  const now = useNow();
  const ago = (iso?: string | null) => agoAt(iso, now);
  useEffect(() => {
    let live = true;
    Promise.all([j<Status>("status.json"), j<{ items: Item[] }>("feeds.json")]).then(([s, f]) => { if (live) { setStatus(s); setItems(f.items ?? []); setErr(""); } }).catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [tick]);
  const cats = useMemo(() => [...new Set(items.map((x) => x.category))], [items]);
  const list = items.filter((x) => !cat || x.category === cat);
  const stale = status?.generatedAt ? (now - Date.parse(status.generatedAt)) / 3600000 : null;
  const run = status?.runs;
  const row = (label: string, ok: boolean | undefined, detail: string, at?: string, err?: string) => (
    <tr><td className="font-semibold">{label}</td><td>{ok ? <span className="chip chip-good"><CheckCircle2 size={11} />取得できました</span> : <span className="chip chip-bad"><XCircle size={11} />取得できませんでした</span>}</td><td className="text-[12px] text-ink-2">{detail}{!ok && err && <div className="text-[11px] text-bad">{err}</div>}</td><td className="text-[12px] text-ink-3">{ago(at)}</td></tr>
  );
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="公的情報フィード（自動更新）" sub="為替・制裁リスト・官公庁のニュースを、毎時、自動で取り込みます（営業日・休日を問わず 24時間 365日）。人の操作は要りません。"
        actions={<button className="btn" onClick={() => setTick((t) => t + 1)}><RefreshCw size={14} />再読み込み</button>} />

      <section className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[13px] ${!status?.generatedAt ? "bg-warn-soft text-warn" : stale !== null && stale > 3 ? "bg-warn-soft text-warn" : "bg-good-soft text-good"}`}>
        {!status?.generatedAt ? <><AlertTriangle size={16} />まだ自動更新が一度も実行されていません。公開後、最初の実行（毎時17分）で取り込みが始まります。</> : stale !== null && stale > 3 ? <><AlertTriangle size={16} />最終更新 {ago(status.generatedAt)}（{new Date(status.generatedAt).toLocaleString("ja-JP")}）。3時間以上更新されていません。自動実行（GitHub Actions）の状態を確認してください。</> : <><CheckCircle2 size={16} />最終更新 {ago(status.generatedAt)}（{new Date(status.generatedAt).toLocaleString("ja-JP")}）。毎時更新されています。</>}
        {err && <span className="text-bad">（読み込みエラー：{err}）</span>}
      </section>

      <section className="card mb-5 overflow-x-auto">
        <div className="card-h"><h2 className="card-t">情報源の状態</h2></div>
        <table className="tbl mt-2 min-w-[760px]"><thead><tr><th>情報源</th><th>状態</th><th>内容</th><th>取得</th></tr></thead>
          <tbody>
            {row("為替レート", run?.fx?.ok, "ECB 参考レート／ExchangeRate-API（為替ページで利用）", run?.fx?.at, run?.fx?.error)}
            {row("制裁リスト（OFAC SDN）", run?.sanctions?.ok, run?.sanctions?.count ? `${run.sanctions.count.toLocaleString()}件（制裁照会で利用）` : "制裁照会で利用", run?.sanctions?.at, run?.sanctions?.error)}
            {(run?.feeds ?? []).map((f) => <tr key={f.id}><td className="font-semibold">{f.name}</td><td>{f.ok ? <span className="chip chip-good"><CheckCircle2 size={11} />取得できました</span> : <span className="chip chip-bad"><XCircle size={11} />取得できませんでした</span>}</td><td className="text-[12px] text-ink-2">{f.ok ? `${f.count}件の記事` : <>{f.error}{f.verified === false && "（配信URLを確認できていません）"}{f.site && <a href={f.site} target="_blank" rel="noreferrer noopener" className="ml-1 text-accent-2 hover:underline">公式サイト<ExternalLink size={10} className="ml-0.5 inline" /></a>}</>}</td><td className="text-[12px] text-ink-3">{ago(f.at)}</td></tr>)}
          </tbody></table>
        <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">取得できなかった情報源は、前回の記事を残して表示します。配信URLは <code>crm/scripts/data-sources.json</code> で変更できます。公式が配信している RSS・Atom と、公開データ（CSV・API）だけを使い、ウェブページのスクレイピングはしません。</p>
      </section>

      <section className="card">
        <div className="card-h flex-wrap"><h2 className="card-t">公式ニュース（新しい順）</h2><div className="flex flex-wrap gap-1.5"><button className={`btn btn-sm ${!cat ? "btn-primary" : ""}`} onClick={() => setCat("")}>すべて</button>{cats.map((c) => <button key={c} className={`btn btn-sm ${cat === c ? "btn-primary" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div></div>
        <ul className="mt-2 divide-y divide-line">
          {list.slice(0, 60).map((x) => <li key={x.link}><a href={x.link} target="_blank" rel="noreferrer noopener" className="block px-4 py-3 hover:bg-surface-2/60"><div className="flex items-start gap-2"><span className="flex-1 text-[13.5px] font-semibold leading-snug">{x.title}</span><ExternalLink size={12} className="mt-1 shrink-0 text-ink-3" /></div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3"><span className="chip">{x.category}</span><span>{x.sourceName}</span>{x.date && <span className="num">{new Date(x.date).toLocaleDateString("ja-JP")}</span>}</div>{x.summary && <p className="mt-1 line-clamp-2 text-[12px] text-ink-2">{x.summary}</p>}</a></li>)}
          {list.length === 0 && <li className="px-6 py-12 text-center text-[13px] text-ink-3">表示できる記事がありません。自動更新が一度成功すると、ここに公式ニュースが並びます。</li>}
        </ul>
      </section>
      <p className="mt-4 px-1 text-[11.5px] text-ink-3">営業部のお知らせの公式URLは <Link href="/board/" className="text-accent-2 hover:underline">営業部のお知らせ</Link> にあります。記事の著作権は各発行元に帰属します（タイトルと要約のみ表示し、本文は転載しません）。</p>
    </div>
  );
}
