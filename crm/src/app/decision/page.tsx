"use client";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, OctagonX, PauseCircle, RotateCcw } from "lucide-react";
import { addActivity, setDecision, useMe, useStore } from "@/lib/store";
import { FLOW, START, byId, currentNode, evaluate, layout, type Answer } from "@/lib/flow";
import { isOpen } from "@/lib/constants";
import { dealJPY } from "@/lib/selectors";
import { yenShort } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { Suspended } from "@/components/Suspended";
import type { Deal } from "@/lib/types";

export default function Page() { return <Suspended><Decision /></Suspended>; }

const PAY_IDX: Record<string, number> = { advance: 0, partial: 1, lc: 2, dp: 3, da: 4, oa: 4 };
const RESULT_UI = {
  go: { label: "契約へ進む（GO）", cls: "bg-good-soft text-good", icon: CheckCircle2 },
  conditional: { label: "条件付きで契約へ進む", cls: "bg-warn-soft text-warn", icon: AlertTriangle },
  hold: { label: "保留（確認待ち）", cls: "bg-surface-3 text-ink-2", icon: PauseCircle },
  stop: { label: "撤退（契約しない）", cls: "bg-bad-soft text-bad", icon: OctagonX },
} as const;

/** 契約可否の判定フロー：決済条件・保証会社（貿易保険）・L/C・前払いなどで自動分岐し、フロー図に経路を示す */
function Decision() {
  const d = useStore().data!;
  const me = useMe()!;
  const sp = useSearchParams();
  const [dealId, setDealId] = useState(sp.get("deal") ?? "");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [manualAmount, setManualAmount] = useState("");
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const boxRef = useRef<HTMLDivElement>(null);
  const deal: Deal | undefined = d.deals.find((x) => x.id === dealId);
  const amountJPY = deal ? dealJPY(deal) : Number(manualAmount.replace(/\D/g, "")) * 10000 || 0;

  const node = currentNode(answers);
  const result = node?.kind === "end" ? evaluate(answers, amountJPY) : null;
  const visited = useMemo(() => { const ids = [START]; let id = START; for (const a of answers) { const n = byId(id); if (n.kind !== "q") break; id = n.options[a.option].next; ids.push(id); } return ids; }, [answers]);
  const lay = useMemo(() => layout(), []);

  const answer = (option: number) => { if (node?.kind === "q") { setAnswers([...answers, { node: node.id, option }]); setSaved(false); } };
  const reset = () => { setAnswers([]); setSaved(false); };
  const autoFill = () => { if (deal && PAY_IDX[deal.payTerm] !== undefined) { setAnswers([{ node: START, option: PAY_IDX[deal.payTerm] }]); setSaved(false); } };
  const selectDeal = (id: string) => { setDealId(id); setAnswers([]); setSaved(false); };

  const save = () => {
    if (!deal || !result) return;
    setDecision(deal.id, { result: result.result, label: result.label, conditions: result.conditions, path: result.path, at: new Date().toISOString(), by: me.id });
    addActivity({ type: "other", orgId: deal.orgId, contactId: null, dealId: deal.id, summary: `契約可否の判定：${result.label}`, note: [`経路：${result.path.join(" ／ ")}`, ...(result.conditions.length ? ["条件：", ...result.conditions.map((c) => `・${c}`)] : [])].join("\n") });
    setSaved(true);
  };

  const resUi = result ? RESULT_UI[result.result] : null;
  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader title="契約可否の判定フロー" sub="契約に進むか、撤退するかの線引きを、質問に答えるだけで判定します。決済条件・保証会社（貿易保険）・L/C・前払いの有無などで自動的に分岐します。" />

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <label className="text-[12.5px] font-semibold">案件</label>
        <select className="select !w-auto min-w-[260px]" value={dealId} onChange={(e) => selectDeal(e.target.value)}><option value="">（案件を指定しない）</option>{d.deals.filter((x) => isOpen(x.stage) || x.stage === "hold").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        {deal ? <><span className="text-[12.5px] text-ink-2">金額 <b className="num">{yenShort(amountJPY)}</b></span>{PAY_IDX[deal.payTerm] !== undefined && answers.length === 0 && <button className="btn btn-sm" onClick={autoFill}>案件の決済条件を自動入力</button>}</>
          : <label className="flex items-center gap-2 text-[12.5px] text-ink-2">取引金額（万円）<input className="input num !h-8 !w-28" inputMode="numeric" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="例 300" /></label>}
        <span className="ml-auto text-[12px] text-ink-3">金額が 500万円以上のときは、役員承認が条件に付きます</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-4">
          {node?.kind === "q" && (
            <section className="card anim-rise p-5" key={node.id}>
              <div className="eyebrow">質問 {answers.length + 1}</div>
              <h2 className="mt-1 text-[16px] font-bold leading-snug">{node.text}</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{node.help}</p>
              <div className="mt-4 space-y-2">
                {node.options.map((o, i) => (
                  <button key={o.label} onClick={() => answer(i)} className="flex w-full items-center gap-2 rounded-xl px-3.5 py-3 text-left text-[13.5px] font-medium ring-1 ring-line-strong transition hover:bg-accent-soft hover:ring-accent-2">
                    <span className="flex-1">{o.label}</span><ChevronRight size={15} className="text-ink-3" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {result && resUi && (
            <section className="card anim-rise overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-4 ${resUi.cls}`}><resUi.icon size={26} /><div><div className="text-[11px] font-semibold opacity-80">判定結果</div><div className="text-[17px] font-bold leading-snug">{result.label}</div></div></div>
              <div className="space-y-3 p-5 text-[13px]">
                <p className="leading-relaxed text-ink-2">{byId(result.endNode).kind === "end" ? (byId(result.endNode) as { help: string }).help : ""}</p>
                {result.conditions.length > 0 && (
                  <div><h3 className="mb-1.5 text-[12.5px] font-bold">{result.result === "stop" ? "再検討の条件" : "契約前に満たす条件"}</h3><ul className="space-y-1.5">{result.conditions.map((c) => <li key={c} className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><span className="mt-0.5 text-warn">●</span>{c}</li>)}</ul></div>
                )}
                {result.result === "go" && <p className="rounded-lg bg-good-soft px-3 py-2 text-[12.5px] text-good">追加の条件はありません。契約書・PI に決済条件を明記して進めましょう。</p>}
                <details className="text-[12px] text-ink-2"><summary className="cursor-pointer font-semibold">たどった経路</summary><ol className="mt-1.5 list-decimal space-y-1 pl-5">{result.path.map((p) => <li key={p}>{p}</li>)}</ol></details>
                <div className="flex flex-wrap gap-2 pt-1">
                  {deal && <button className="btn btn-primary" onClick={save} disabled={saved}>{saved ? "案件に記録しました" : "この判定を案件に記録"}</button>}
                  <button className="btn" onClick={reset}><RotateCcw size={14} />最初からやり直す</button>
                </div>
                {!deal && <p className="text-[11.5px] text-ink-3">案件を選ぶと、判定結果を案件・活動履歴に記録できます。</p>}
              </div>
            </section>
          )}

          {answers.length > 0 && (
            <section className="card p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="card-t">これまでの回答</h3><div className="flex gap-1"><button className="btn btn-sm" onClick={() => { setAnswers(answers.slice(0, -1)); setSaved(false); }}><ArrowLeft size={12} />1つ戻る</button><button className="btn btn-sm btn-ghost" onClick={reset}>最初から</button></div></div>
              <ol className="space-y-1.5">{answers.map((a, i) => { const n = byId(a.node); return n.kind === "q" ? <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-[12px]"><span className="text-ink-3">{n.text}</span><br /><b>{n.options[a.option].label}</b></li> : null; })}</ol>
            </section>
          )}
        </div>

        <section className="card min-w-0 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="card-t">判定フロー図（辿った経路を赤でハイライト）</h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-2"><button className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} aria-label="縮小">−</button><button className="btn btn-sm" onClick={() => setZoom(Math.min(1.4, Math.max(0.3, ((boxRef.current?.clientWidth ?? 900) - 16) / lay.width)))}>全体</button><button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(1.4, z + 0.2))} aria-label="拡大">＋</button>{[["#17171a", "質問"], ["#17784a", "契約へ"], ["#9a5a00", "保留"], ["#c0362c", "撤退"]].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}</div></div>
          <div ref={boxRef} className="overflow-auto rounded-xl bg-surface-2 p-2" style={{ maxHeight: "74vh" }}>
            <svg width={lay.width * zoom} height={lay.height * zoom} viewBox={`0 0 ${lay.width} ${lay.height}`} role="img" aria-label="契約可否の判定フロー図">
              <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker></defs>
              {lay.edges.map((e, i) => {
                const on = visited.includes(e.from) && visited.includes(e.to) && answers.some((a) => a.node === e.from && byId(e.from).kind === "q" && (byId(e.from) as { options: { next: string; label: string }[] }).options[a.option].next === e.to && (byId(e.from) as { options: { label: string }[] }).options[a.option].label === e.label);
                const path = e.points.map((p, j) => `${j === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
                const mid = e.points[1];
                return (
                  <g key={i}>
                    <path d={path} fill="none" stroke={on ? "#c8102e" : "var(--line-strong)"} strokeWidth={on ? 2.6 : 1.3} markerEnd="url(#arr)" />
                    <text x={mid[0] + 4} y={(e.points[0][1] + mid[1]) / 2 - 3} fontSize="9.5" fill={on ? "#c8102e" : "var(--ink-3)"} fontWeight={on ? 700 : 400}>{e.label.length > 14 ? e.label.slice(0, 13) + "…" : e.label}</text>
                  </g>
                );
              })}
              {FLOW.map((n) => {
                const p = lay.placed.get(n.id)!;
                const on = visited.includes(n.id), cur = node?.id === n.id;
                const fill = n.kind === "q" ? "#17171a" : n.end === "stop" ? "#c0362c" : n.end === "hold" ? "#9a5a00" : "#17784a";
                const text = n.kind === "q" ? n.text : n.text;
                const lines = text.length > 17 ? [text.slice(0, 17), text.slice(17, 33) + (text.length > 33 ? "…" : "")] : [text];
                return (
                  <g key={n.id} opacity={visited.length > 1 && !on ? 0.45 : 1}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={n.kind === "q" ? 10 : 30} fill={fill} stroke={on ? "#c8102e" : "none"} strokeWidth={cur ? 4 : 3} />
                    {lines.map((l, i) => <text key={i} x={p.x + p.w / 2} y={p.y + p.h / 2 + (i - (lines.length - 1) / 2) * 15 + 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#fff">{l}</text>)}
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      </div>
    </div>
  );
}
