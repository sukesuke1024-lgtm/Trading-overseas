"use client";
import { useMemo, useState } from "react";
import { BUYER_TERM_PRESETS, PRODUCER_TERM_PRESETS, SCHEMES, cashCycle, type Flow, type Kind, type Level, type Scheme } from "@/lib/schemes";
import { yen } from "@/lib/format";
import { Field, PageHeader } from "@/components/ui";

const KIND_STYLE: Record<Kind, { color: string; dash?: string; label: string; top: boolean }> = {
  money: { color: "#c8102e", label: "お金", top: true }, insurance: { color: "#17784a", dash: "2 4", label: "保険", top: true },
  goods: { color: "#17171a", label: "商品", top: false }, docs: { color: "#2f6fd0", dash: "6 4", label: "書類", top: false },
};

/** 取引スキーム図：登場人物を横に並べ、商品・お金・書類・保険の流れを線で描く（重ならないよう段に分ける） */
function Diagram({ s }: { s: Scheme }) {
  const W = 920, bw = 150, bh = 58, n = s.actors.length;
  const xs = s.actors.map((_, i) => (n === 1 ? W / 2 : 90 + (i * (W - 180)) / (n - 1)));
  const idx = (id: string) => s.actors.findIndex((a) => a.id === id);
  const lay = (top: boolean) => {
    const fs = s.flows.filter((f) => KIND_STYLE[f.kind].top === top).map((f) => ({ f, a: Math.min(idx(f.from), idx(f.to)), b: Math.max(idx(f.from), idx(f.to)) })).sort((x, y) => (x.b - x.a) - (y.b - y.a));
    const lanes: { a: number; b: number }[][] = [];
    const out = new Map<Flow, number>();
    for (const x of fs) { let l = 0; while (lanes[l]?.some((r) => !(x.b <= r.a || x.a >= r.b) || (x.a === x.b))) l++; (lanes[l] ??= []).push({ a: x.a, b: x.b }); out.set(x.f, l); }
    return { out, count: lanes.length };
  };
  const T = lay(true), B = lay(false);
  const LANE = 34, y0 = 36 + T.count * LANE, H = y0 + bh + 36 + B.count * LANE + 10;
  const role = { producer: "#e8eef7", us: "#17171a", buyer: "#f6ecec", bank: "#f1f1ee", other: "#f1f1ee" } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${s.name}の取引の流れ`}>
      <defs>{(Object.keys(KIND_STYLE) as Kind[]).map((k) => <marker key={k} id={`ar-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill={KIND_STYLE[k].color} /></marker>)}</defs>
      {s.flows.map((f, i) => {
        const st = KIND_STYLE[f.kind], lane = (st.top ? T : B).out.get(f) ?? 0;
        const a = idx(f.from), b = idx(f.to);
        const yb = st.top ? y0 : y0 + bh, ly = st.top ? y0 - 18 - lane * LANE : y0 + bh + 18 + lane * LANE;
        const x1 = xs[a] + (b > a ? 12 : -12), x2 = xs[b] + (b > a ? -12 : 12);
        return (
          <g key={i}>
            <path d={`M${x1},${yb} V${ly} H${x2} V${yb}`} fill="none" stroke={st.color} strokeWidth="2" strokeDasharray={st.dash} markerEnd={`url(#ar-${f.kind})`} />
            <text x={(x1 + x2) / 2} y={ly + (st.top ? -5 : 14)} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={st.color} style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>{f.label}</text>
          </g>
        );
      })}
      {s.actors.map((a, i) => (
        <g key={a.id}>
          <rect x={xs[i] - bw / 2} y={y0} width={bw} height={bh} rx={12} fill={role[a.role]} stroke={a.role === "us" ? "#c8102e" : "var(--line-strong)"} strokeWidth={a.role === "us" ? 2.5 : 1} />
          {a.label.split("\n").map((l, j, arr) => <text key={j} x={xs[i]} y={y0 + bh / 2 + (j - (arr.length - 1) / 2) * 15 + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill={a.role === "us" ? "#fff" : "#17171a"}>{l}</text>)}
        </g>
      ))}
    </svg>
  );
}

const LV: Record<Level, string> = { 1: "#17784a", 2: "#6aa84f", 3: "#c47a1c", 4: "#d0572f", 5: "#c0362c" };
const Dots = ({ n }: { n: Level }) => <span className="inline-flex gap-0.5" aria-label={`リスク ${n}/5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className="h-2.5 w-2.5 rounded-sm" style={{ background: i <= n ? LV[n] : "var(--surface-3)" }} />)}</span>;

export default function Schemes() {
  const [id, setId] = useState(SCHEMES[0].id);
  const s = SCHEMES.find((x) => x.id === id)!;
  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader title="海外事業のスキーム集" sub="海外取引のスキーム（取引の仕組み）を、お金・商品・書類・保険の流れと、リスクを誰が負うかで整理しました。取引の形を選ぶときの判断材料です。" />
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="card max-h-[calc(100vh-120px)] overflow-y-auto p-2 lg:sticky lg:top-20" aria-label="スキーム一覧">
          {SCHEMES.map((x) => <button key={x.id} onClick={() => setId(x.id)} className={`mb-0.5 block w-full rounded-lg px-3 py-2 text-left ${x.id === id ? "bg-accent text-accent-ink" : "hover:bg-surface-2"}`}><span className="block text-[13px] font-semibold leading-snug">{x.name}</span><span className={`block text-[11px] ${x.id === id ? "opacity-75" : "text-ink-3"}`}>{x.tag}</span></button>)}
        </nav>
        <div className="min-w-0 space-y-5">
          <section className="card anim-rise p-5" key={s.id}>
            <div className="chip chip-accent mb-2">{s.tag}</div>
            <h2 className="text-[20px] font-bold leading-tight">{s.name}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.summary}</p>
            <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><b>向く場面：</b>{s.when}</p>
            <div className="mt-4 overflow-x-auto rounded-xl bg-surface p-2 ring-1 ring-line"><div className="min-w-[640px]"><Diagram s={s} /></div></div>
            <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-ink-2">{(Object.keys(KIND_STYLE) as Kind[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke={KIND_STYLE[k].color} strokeWidth="2" strokeDasharray={KIND_STYLE[k].dash} /></svg>{KIND_STYLE[k].label}</span>)}</div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="card p-5"><h3 className="card-t mb-3">取引の流れ</h3><ol className="space-y-2.5">{s.steps.map((t, i) => <li key={t} className="flex gap-3 text-[13px] leading-relaxed"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</span>{t}</li>)}</ol></section>
            <section className="card overflow-hidden"><div className="px-5 pt-4"><h3 className="card-t">リスクは誰が負うか</h3></div>
              <table className="tbl mt-2"><tbody>{s.risks.map((r) => <tr key={r.risk}><td className="w-[120px] align-top text-[12.5px] font-semibold">{r.risk}</td><td className="align-top"><Dots n={r.level} /><div className="mt-1 text-[12px] font-medium">{r.bearer}</div>{r.note && <div className="text-[11.5px] text-ink-3">{r.note}</div>}</td></tr>)}</tbody></table></section>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <List title="必要な書類" items={s.docs} /><List title="守りの手当て（保全）" items={s.safeguards} tone="good" /><List title="よくある失敗" items={s.pitfalls} tone="bad" />
          </div>
          <section className="card grid gap-4 p-5 text-[13px] md:grid-cols-2"><div><h3 className="card-t mb-1">価格・利益への影響</h3><p className="text-ink-2">{s.margin}</p></div><div><h3 className="card-t mb-1">H-LINK にとっての位置づけ</h3><p className="text-ink-2">{s.fit}</p></div></section>
        </div>
      </div>

      <Compare onPick={setId} />
      <CashCycle />
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "good" | "bad" }) {
  return <section className="card p-5"><h3 className="card-t mb-2">{title}</h3><ul className="space-y-1.5">{items.map((t) => <li key={t} className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-relaxed ${tone === "good" ? "bg-good-soft" : tone === "bad" ? "bg-bad-soft" : "bg-surface-2"}`}><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />{t}</li>)}</ul></section>;
}

function Compare({ onPick }: { onPick: (id: string) => void }) {
  const cols = ["信用（代金回収）", "為替", "物流・品質", "在庫・価格", "規制・許認可"] as const;
  return (
    <section className="card mt-8 overflow-x-auto">
      <div className="card-h"><h2 className="card-t">スキーム比較（自社が負うリスクの大きさ。小さいほど安全）</h2></div>
      <table className="tbl mt-2 min-w-[820px]"><thead><tr><th>スキーム</th>{cols.map((c) => <th key={c} className="text-center">{c}</th>)}</tr></thead>
        <tbody>{SCHEMES.map((s) => <tr key={s.id} className="cursor-pointer" onClick={() => { onPick(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}><td className="font-semibold">{s.name}</td>{cols.map((c) => { const r = s.risks.find((x) => x.risk === c)!; return <td key={c} className="text-center"><Dots n={r.level} /></td>; })}</tr>)}</tbody></table>
    </section>
  );
}

/** 資金繰り：生産者への支払いからバイヤーの入金までの『立て替え日数』と、資金コストを見る */
function CashCycle() {
  const [amount, setAmount] = useState("10000000");
  const [margin, setMargin] = useState("20");
  const [prod, setProd] = useState(0);
  const [buyer, setBuyer] = useState(60);
  const [rate, setRate] = useState("3");
  const r = useMemo(() => cashCycle({ amountJPY: Number(amount.replace(/\D/g, "")) || 0, marginRate: Number(margin) || 0, producerTerm: prod, buyerTerm: buyer, financeRate: Number(rate) || 0 }), [amount, margin, prod, buyer, rate]);
  const span = Math.max(Math.abs(prod), Math.abs(buyer), 30) * 1.2;
  const px = (d: number) => `${50 + (d / span) * 45}%`;
  return (
    <section className="card mt-8 p-5">
      <h2 className="card-t mb-1">資金繰りの試算（立て替えがいつまで続くか）</h2>
      <p className="mb-4 text-[12px] text-ink-3">船積み（B/L の日）を 0 日として、生産者へ支払う日と、バイヤーから入金される日の差が、自社が資金を立て替える日数です。</p>
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="仕入れ総額（円）"><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="粗利率（%）"><input className="input num" value={margin} onChange={(e) => setMargin(e.target.value)} /></Field>
        <Field label="生産者への支払い"><select className="select" value={prod} onChange={(e) => setProd(Number(e.target.value))}>{PRODUCER_TERM_PRESETS.map((p) => <option key={p.label} value={p.days}>{p.label}</option>)}</select></Field>
        <Field label="バイヤーからの入金"><select className="select" value={buyer} onChange={(e) => setBuyer(Number(e.target.value))}>{BUYER_TERM_PRESETS.map((p) => <option key={p.label} value={p.days}>{p.label}</option>)}</select></Field>
        <Field label="資金調達コスト（年率%）"><input className="input num" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      </div>
      <div className="relative mt-6 h-14 rounded-xl bg-surface-2" aria-hidden>
        <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 bg-line-strong" />
        <div className="absolute top-0 h-full w-px bg-ink-3" style={{ left: px(0) }}><span className="absolute -top-0.5 left-1 text-[10px] text-ink-3">B/L 0日</span></div>
        <div className="absolute top-2 h-10 rounded-md opacity-25" style={{ left: px(Math.min(prod, buyer)), width: `calc(${px(Math.max(prod, buyer))} - ${px(Math.min(prod, buyer))})`, background: r.gapDays > 0 ? "#c0362c" : "#17784a" }} />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink" style={{ left: px(prod) }}>仕入れ支払 {prod}日</div>
        <div className="absolute bottom-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent-2)] px-2 py-0.5 text-[11px] font-semibold text-white" style={{ left: px(buyer) }}>入金 {buyer}日</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["立て替え日数", r.financedByBuyer ? `${-r.gapDays}日（バイヤーが先に払う）` : `${r.gapDays}日`], ["必要な運転資金（最大）", yen(r.peakFundingJPY)], ["資金コスト", yen(r.financeCostJPY)], ["粗利", yen(r.profitJPY)], ["資金コスト後の利益", yen(r.netProfitJPY)]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-2 p-3"><div className="text-[11px] text-ink-3">{l}</div><div className="num mt-1 text-[16px] font-bold">{v}</div></div>)}
      </div>
      <p className="mt-3 text-[11.5px] text-ink-3">期間が長いほど、金利コストと与信リスクが増えます。後払いにするなら、資金コストと保険料を価格に織り込む（見積・粗利の計算の「決済手数料」に入れる）か、前払い・L/C に切り替えます。</p>
    </section>
  );
}
