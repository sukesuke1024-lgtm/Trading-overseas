"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import { setOrgScreening, useStore } from "@/lib/store";
import { screen, type Match, type SdnData } from "@/lib/screening";
import { dataUrl } from "@/lib/asset";
import { useNow } from "@/lib/useNow";
import { fmtDate } from "@/lib/dates";
import { flag } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { Suspended } from "@/components/Suspended";

export default function Page() { return <Suspended><Screening /></Suspended>; }

const OTHER_LISTS: [string, string, string][] = [
  ["EU 制裁リスト（資産凍結の対象者）", "https://www.sanctionsmap.eu/", "欧州連合の制裁。EU の取引先・EUを経由する取引で確認"],
  ["国連安保理 統合制裁リスト", "https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list", "国連の制裁対象者・団体"],
  ["日本：外為法 資産凍結等の対象者（財務省）", "https://www.mof.go.jp/policy/international_policy/gaitame_kawase/gaitame/economic_sanctions/index.html", "日本の制裁。日本の取引では法令上の確認が必要"],
  ["経済産業省：安全保障貿易管理（該非判定・キャッチオール）", "https://www.meti.go.jp/policy/anpo/", "輸出する貨物・技術が規制対象でないかの確認"],
  ["OFAC Sanctions List Search（公式の検索画面）", "https://sanctionssearch.ofac.treas.gov/", "このシステムのデータの元。念のため公式画面でも確認"],
];

/** 制裁リスト照会：取引先の名前を、OFAC の SDN リスト（毎時の自動更新）と照合し、結果を顧客に記録する */
function Screening() {
  const d = useStore().data!;
  const sp = useSearchParams();
  const [orgId, setOrgId] = useState(sp.get("org") ?? "");
  const [name, setName] = useState(d.organizations.find((o) => o.id === sp.get("org"))?.name ?? "");
  const [data, setData] = useState<SdnData | null>(null);
  const [res, setRes] = useState<Match[] | null>(null);
  const [saved, setSaved] = useState("");
  const now = useNow();

  useEffect(() => {
    let live = true;
    fetch(`${dataUrl("sanctions.json")}?t=${Math.floor(Date.now() / 600000)}`).then((r) => r.json()).then((j: SdnData) => { if (live) setData({ ...j, status: j.entries?.length ? "ok" : "empty" }); }).catch((e: Error) => { if (live) setData({ updatedAt: null, source: "OFAC SDN", count: 0, entries: [], status: "error", error: e.message }); });
    return () => { live = false; };
  }, []);

  const ready = !!data && data.status === "ok";
  const run = () => { if (!data) return; setRes(screen(name, data.entries)); setSaved(""); };
  const org = d.organizations.find((o) => o.id === orgId);
  const result = useMemo<"clear" | "review" | "hit">(() => (!res ? "clear" : res.some((m) => m.kind === "完全一致") ? "hit" : res.length ? "review" : "clear"), [res]);
  const stale = data?.updatedAt ? (now - Date.parse(data.updatedAt)) / 3600000 : null;

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader title="制裁リスト照会" sub="取引先の名前を、米国財務省（OFAC）が公開している制裁リスト（SDN）と照合します。リストは自動で毎時更新されます。" />

      <section className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[12.5px] ${ready ? (stale !== null && stale > 6 ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2") : "bg-bad-soft text-bad"}`}>
        {ready ? <><CheckCircle2 size={15} className="text-good" /><span>照合データ：<b>{data!.source}</b>　{data!.count.toLocaleString()}件　最終更新 <b>{data!.updatedAt ? new Date(data!.updatedAt).toLocaleString("ja-JP") : "—"}</b>{stale !== null && stale > 6 && "（6時間以上更新されていません。自動更新の状態を確認してください）"}</span></>
          : <><ShieldAlert size={15} /><span>{data === null ? "読み込み中…" : "照合データがまだ取り込まれていません（自動更新の初回実行前、または取得に失敗）。このままでは照会できません。下の公式サイトで直接確認してください。"}</span></>}
        <Link href="/intel/" className="ml-auto text-accent-2 hover:underline">取り込み状況 →</Link>
      </section>

      <section className="card space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <select className="select" value={orgId} onChange={(e) => { setOrgId(e.target.value); const o = d.organizations.find((x) => x.id === e.target.value); if (o) setName(o.name); setRes(null); }}><option value="">顧客から選ぶ（任意）</option>{d.organizations.map((o) => <option key={o.id} value={o.id}>{flag(o.country)} {o.name}</option>)}</select>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setRes(null); }} placeholder="会社名・個人名（英字表記がおすすめ）" onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn btn-primary" disabled={!ready || name.trim().length < 3} onClick={run}>照会する</button>
        </div>
        <p className="text-[11.5px] text-ink-3">社名は、法人格（Co., Ltd. など）や語順の違い、綴りの違いも考慮して照合します。代表者・実質的支配者の氏名も、同じ方法で照会してください。</p>
      </section>

      {res && (
        <section className="card anim-rise mt-5 overflow-hidden">
          <div className={`flex items-center gap-3 px-5 py-4 ${result === "clear" ? "bg-good-soft text-good" : result === "hit" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
            {result === "clear" ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            <div><div className="text-[11px] opacity-80">「{name}」の照会結果</div><div className="text-[16px] font-bold">{result === "clear" ? "このデータには該当がありません" : result === "hit" ? "完全一致があります（取引前に必ず確認・上長へ報告）" : `類似の名前が ${res.length}件あります（同一かどうか確認が必要）`}</div></div>
          </div>
          <div className="p-5">
            {res.length > 0 && <table className="tbl"><thead><tr><th>一致度</th><th>登録名</th><th>種別</th><th>プログラム</th><th>番号</th></tr></thead><tbody>{res.map((m) => <tr key={m.entry.id + m.entry.n}><td><span className={`chip ${m.kind === "完全一致" ? "chip-bad" : m.kind === "ほぼ一致" ? "chip-warn" : ""}`}>{m.kind} {m.score}</span></td><td className="font-semibold">{m.entry.n}</td><td className="text-ink-2">{m.entry.t}</td><td className="text-[12px] text-ink-2">{m.entry.p}</td><td className="num text-[12px] text-ink-3">{m.entry.id}</td></tr>)}</tbody></table>}
            <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
              <b>「該当なし」は『安全』ではありません。</b>このデータ（OFAC SDN）に載っていないという意味だけです。EU・国連・日本の制裁リスト、反社チェック、輸出貨物の該非判定は別に確認が必要です（下の一覧）。同じ名前の別人・別会社のこともあるため、住所・生年月日・代表者などで同一性を確認してください。</div>
            {org && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4"><span className="text-[12.5px]">この結果を <b>{org.name}</b> に記録</span>
                <button className="btn btn-primary btn-sm" onClick={() => { setOrgScreening(org.id, { query: name, result, matches: res.length, dataDate: data?.updatedAt ?? null }); setSaved("記録しました（与信審査の『制裁リスト照会』に反映されます）"); }}>照会結果を記録</button>
                <Link href={`/credit/?org=${org.id}`} className="text-[12px] text-accent-2 hover:underline">与信審査へ →</Link>{saved && <span role="status" className="text-xs text-good">{saved}</span>}</div>)}
          </div>
        </section>
      )}

      {org?.screening && !res && <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] text-ink-2">前回の記録：{fmtDate(org.screening.at.slice(0, 10), true)}　{org.screening.result === "clear" ? "該当なし" : org.screening.result === "hit" ? "完全一致あり" : "類似あり"}（{org.screening.matches}件）</p>}

      <section className="card mt-5 overflow-hidden">
        <div className="card-h"><h2 className="card-t">ほかに確認するリスト・制度（公式サイト）</h2></div>
        <ul className="mt-2 divide-y divide-line">{OTHER_LISTS.map(([t, u, n]) => <li key={u}><a href={u} target="_blank" rel="noreferrer noopener" className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60"><ExternalLink size={14} className="mt-1 shrink-0 text-ink-3" /><span><span className="block text-[13px] font-semibold text-accent-2">{t}</span><span className="block text-[12px] text-ink-2">{n}</span></span></a></li>)}</ul>
      </section>
    </div>
  );
}
