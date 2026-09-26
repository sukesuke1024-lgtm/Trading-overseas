"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, LayoutGrid, List, CalendarClock } from "lucide-react";
import { DealTable, NewDealModal } from "@/components/common";
import { Button, Card, Input, PageHeader, Select, cx } from "@/components/ui";
import { COUNTRIES, LOST_STAGE, STAGES, countryOf } from "@/lib/constants";
import { moveDeal } from "@/lib/deal-actions";
import { fmtDate, today, yenShort } from "@/lib/format";
import { useLookup, useStore } from "@/lib/store/store";
import type { Deal, DealStage } from "@/lib/types";

export default function DealsPage() {
  const { db, run, can } = useStore();
  const lk = useLookup();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [owner, setOwner] = useState("");
  const [showLost, setShowLost] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<DealStage | null>(null);

  const deals = useMemo(() => {
    const n = q.trim().toLowerCase();
    return db.deals.filter(
      (d) =>
        (!country || d.country === country) &&
        (!owner || d.owner_id === owner) &&
        (!n || [d.code, d.title, lk.buyer.get(d.buyer_id ?? "")?.company_name, lk.product.get(d.product_id ?? "")?.name].join(" ").toLowerCase().includes(n)),
    );
  }, [db.deals, q, country, owner, lk]);

  const columns = showLost ? [...STAGES, LOST_STAGE] : STAGES;
  const now = today();

  function drop(stage: DealStage) {
    const d = db.deals.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (d) moveDeal(run, d, stage);
  }

  return (
    <>
      <PageHeader
        title="Deal Pipeline"
        subtitle="カードをドラッグしてStatusを変更（Contract以降への移動は Owner/Admin の契約承認）"
        actions={
          <>
            <div className="flex rounded-md border border-line-strong bg-surface p-0.5">
              <button onClick={() => setView("board")} className={cx("rounded px-2 py-1", view === "board" ? "bg-surface-2 text-ink" : "text-ink-3")} aria-label="ボード">
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setView("list")} className={cx("rounded px-2 py-1", view === "list" ? "bg-surface-2 text-ink" : "text-ink-3")} aria-label="リスト">
                <List size={15} />
              </button>
            </div>
            <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!can("record.edit")}>
              <Plus size={15} /> 新規 Deal
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索（Deal / Buyer / 商品）" className="w-64" />
        <Select value={country} onChange={(e) => setCountry(e.target.value)} className="w-auto">
          <option value="">国：すべて</option>
          {COUNTRIES.filter((c) => db.deals.some((d) => d.country === c.code)).map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </Select>
        <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-auto">
          <option value="">担当：すべて</option>
          {db.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} /> Lost を表示
        </label>
      </div>

      {view === "list" ? (
        <Card pad={false}>
          <DealTable deals={deals} />
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-6 lg:px-6">
          <div className="flex gap-3" style={{ minWidth: columns.length * 252 }}>
            {columns.map((s) => {
              const items = deals.filter((d) => d.stage === s.key);
              const total = items.reduce((sum, d) => sum + d.expected_revenue, 0);
              return (
                <div
                  key={s.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(s.key);
                  }}
                  onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
                  onDrop={() => drop(s.key)}
                  className={cx("flex w-60 shrink-0 flex-col rounded-lg border bg-surface-2/60 transition-colors", over === s.key ? "border-accent-2 bg-accent-soft" : "border-line")}
                >
                  <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                    <span className="text-[12.5px] font-semibold">{s.label}</span>
                    <span className="rounded bg-surface px-1.5 text-[11px] text-ink-3">{items.length}</span>
                  </div>
                  <div className="tabular px-3 pb-2 text-[11.5px] text-ink-3">{yenShort(total)}</div>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                    {items.map((d) => (
                      <DealCard key={d.id} d={d} now={now} onDragStart={() => setDragId(d.id)} dragging={dragId === d.id} onMove={(st) => moveDeal(run, d, st)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {newOpen && <NewDealModal open onClose={() => setNewOpen(false)} />}
    </>
  );
}

function DealCard({ d, now, onDragStart, dragging, onMove }: { d: Deal; now: string; onDragStart: () => void; dragging: boolean; onMove: (s: DealStage) => void }) {
  const lk = useLookup();
  const { db } = useStore();
  const buyer = lk.buyer.get(d.buyer_id ?? "");
  const product = lk.product.get(d.product_id ?? "");
  const producer = lk.producer.get(d.producer_id ?? "");
  const overdue = d.deadline && d.deadline < now && d.stage !== "repeat" && d.stage !== "lost";
  const tasks = db.tasks.filter((t) => t.deal_id === d.id && t.kind === "checklist");
  const done = tasks.filter((t) => t.status === "done" || t.status === "na").length;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", d.id);
        onDragStart();
      }}
      className={cx("cursor-grab rounded-md border border-line bg-surface p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-line-strong active:cursor-grabbing", dragging && "opacity-40")}>
      <Link href={`/deals/${d.id}`} className="block">
        <div className="flex items-center justify-between text-[11px] text-ink-3">
          <span>{d.code}</span>
          <span>
            {countryOf(d.country)?.flag} {d.country}
          </span>
        </div>
        <div className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-snug">{buyer?.company_name ?? d.title}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-2">{product?.name ?? "—"}</div>
        {producer && <div className="truncate text-[11px] text-ink-3">{producer.company_name}</div>}
        <div className="tabular mt-1.5 flex items-center justify-between text-[11.5px]">
          <span>{yenShort(d.expected_revenue)}</span>
          <span className="text-good">粗利 {yenShort(d.expected_profit)}</span>
        </div>
        {tasks.length > 0 && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent-2" style={{ width: `${(done / tasks.length) * 100}%` }} />
          </div>
        )}
        <div className={cx("mt-1.5 flex items-center gap-1 text-[11px]", overdue ? "font-medium text-bad" : "text-ink-3")}>
          <CalendarClock size={11} /> {fmtDate(d.deadline)}
          <span className="ml-1 truncate">{d.next_action}</span>
        </div>
      </Link>
      {/* タッチ端末向け：ドラッグの代わりにセレクトで移動 */}
      <select
        value={d.stage}
        onChange={(e) => onMove(e.target.value as DealStage)}
        className="mt-1.5 w-full rounded border border-line bg-surface-2 px-1 py-0.5 text-[11px] text-ink-2 lg:hidden"
        aria-label="Status変更"
      >
        {[...STAGES, LOST_STAGE].map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
