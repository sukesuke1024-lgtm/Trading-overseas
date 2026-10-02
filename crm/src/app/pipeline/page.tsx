"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMe, useStore } from "@/lib/store";
import { dealJPY, nextActionOf, permsFor, weighted } from "@/lib/selectors";
import { STAGES, flag, stageOf } from "@/lib/constants";
import type { Data, Deal, StageId } from "@/lib/types";
import { yenShort, money } from "@/lib/format";
import { Avatar, DueChip, PageHeader, StageChip, stageColor } from "@/components/ui";
import { NewDealDrawer, useStageMove } from "@/components/forms";
import { dueInfo } from "@/lib/dates";

export default function Pipeline() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const [owner, setOwner] = useState("");
  const [q, setQ] = useState("");
  const [showClosed, setShowClosed] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StageId | null>(null);
  const [adding, setAdding] = useState(false);
  const { move, modal } = useStageMove();

  const deals = useMemo(() => d.deals.filter((x) => {
    if (owner && x.ownerId !== owner) return false;
    if (q) { const org = d.organizations.find((o) => o.id === x.orgId); if (!(x.name + (org?.name ?? "")).toLowerCase().includes(q.toLowerCase())) return false; }
    return true;
  }), [d, owner, q]);

  const cols = STAGES.filter((s) => showClosed || s.kind === "open");
  const total = deals.filter((x) => stageOf(x.stage).kind === "open").reduce((a, x) => a + dealJPY(x), 0);

  return (
    <div>
      <PageHeader title="パイプライン" sub={`進行中 ${deals.filter((x) => stageOf(x.stage).kind === "open").length}件・総額 ${yenShort(total)}　カードをドラッグしてステージを変更（スマホは「⋯」から）`}
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />案件を追加</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-56 !pl-8" placeholder="案件・顧客を絞り込み" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">担当：全員</option>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        {me.role === "sales" && <button className={`btn ${owner === me.id ? "btn-primary" : ""}`} onClick={() => setOwner(owner === me.id ? "" : me.id)}>自分の案件のみ</button>}
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-2"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />受注・失注・保留も表示</label>
      </div>

      <div className="kanban">
        {cols.map((s) => {
          const xs = deals.filter((x) => x.stage === s.id).sort((a, b) => (a.expectedCloseDate ?? "9").localeCompare(b.expectedCloseDate ?? "9"));
          const sum = xs.reduce((a, x) => a + dealJPY(x), 0);
          return (
            <section key={s.id} className={`kcol ${overCol === s.id ? "over" : ""}`}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCol(s.id); } }}
              onDragLeave={() => setOverCol((c) => (c === s.id ? null : c))}
              onDrop={(e) => { e.preventDefault(); if (dragId) { const x = d.deals.find((y) => y.id === dragId); if (x && x.stage !== s.id) move(dragId, s.id); } setDragId(null); setOverCol(null); }}>
              <header className="px-3 pb-2 pt-3">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: stageColor(s.id) }} /><h2 className="text-[13px] font-bold">{s.label}</h2><span className="num rounded-full bg-surface px-1.5 text-[11px] font-semibold text-ink-2">{xs.length}</span><span className="ml-auto text-[11px] text-ink-3">{s.kind === "open" ? `${s.probability}%` : ""}</span></div>
                <div className="mt-0.5 flex justify-between text-[11.5px] text-ink-3 num"><span>{yenShort(sum)}</span>{s.kind === "open" && <span>加重 {yenShort(xs.reduce((a, x) => a + weighted(x), 0))}</span>}</div>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {xs.map((x) => <Card key={x.id} d={d} x={x} editable={perms.canEdit(x.ownerId)} dragging={dragId === x.id} onDragStart={() => setDragId(x.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} onMove={(st) => move(x.id, st)} />)}
                {xs.length === 0 && <div className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-[11.5px] text-ink-3">ここにドロップ</div>}
              </div>
            </section>
          );
        })}
      </div>
      <NewDealDrawer key={String(adding)} d={d} open={adding} onClose={() => setAdding(false)} />
      {modal}
    </div>
  );
}

function Card({ d, x, editable, dragging, onDragStart, onDragEnd, onMove }: { d: Data; x: Deal; editable: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove: (s: StageId) => void }) {
  const org = d.organizations.find((o) => o.id === x.orgId);
  const owner = d.users.find((u) => u.id === x.ownerId);
  const na = nextActionOf(d, x.id);
  const open = stageOf(x.stage).kind === "open";
  const tone = na ? dueInfo(na.dueDate).tone : "none";
  return (
    <article draggable={editable} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.id); onDragStart(); }} onDragEnd={onDragEnd}
      className={`kcard ${dragging ? "dragging" : ""} ${editable ? "" : "!cursor-default"}`}>
      <div className="flex items-start gap-2">
        <Link href={`/deals/view/?id=${x.id}`} className="min-w-0 flex-1 text-[13px] font-semibold leading-snug hover:text-accent-2">{x.name}</Link>
        {editable && (
          <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2" title="ステージを移動">
            <MoreHorizontal size={15} />
            <select aria-label="ステージを移動" value={x.stage} onChange={(e) => onMove(e.target.value as StageId)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}へ移動</option>)}
            </select>
          </span>
        )}
      </div>
      <div className="mt-1 truncate text-[11.5px] text-ink-3">{flag(org?.country ?? "")} {org?.name}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="num text-[13px] font-bold">{money(x.amount, x.currency)}{x.currency !== "JPY" && <span className="ml-1 text-[10.5px] font-normal text-ink-3">≈{yenShort(dealJPY(x))}</span>}</span>
        <span className="flex items-center gap-1.5">{open && <span className="num text-[11px] text-ink-3">{x.probability}%</span>}<Avatar user={owner} size={20} /></span>
      </div>
      {open && (
        <div className={`mt-2 rounded-lg px-2 py-1.5 text-[11.5px] leading-snug ${!na ? "bg-bad-soft text-bad" : tone === "overdue" ? "bg-bad-soft" : tone === "today" ? "bg-warn-soft" : "bg-surface-2"}`}>
          {na ? (<div className="flex items-start gap-1.5"><span className="line-clamp-2 flex-1">{na.title}</span><DueChip due={na.dueDate} /></div>)
            : (<span className="inline-flex items-center gap-1 font-semibold"><AlertTriangle size={12} />Next Action 未設定</span>)}
        </div>
      )}
      {!open && x.stage === "lost" && <div className="mt-2 text-[11.5px] text-bad">失注理由：{x.lostReason}</div>}
      {!open && x.stage !== "lost" && <div className="mt-2"><StageChip stage={x.stage} /></div>}
    </article>
  );
}
