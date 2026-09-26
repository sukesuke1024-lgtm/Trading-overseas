"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Checklist } from "@/components/checklist";
import { NewDealModal, StageBadge } from "@/components/common";
import { CostSimulator } from "@/components/cost-simulator";
import { Button, Card, Empty, Field, PageHeader, Progress, Select, Tabs, Table } from "@/components/ui";
import { applyCost } from "@/lib/automation";
import { buildChecklist } from "@/lib/checklist";
import { COUNTRIES, countryLabel } from "@/lib/constants";
import { defaultCost } from "@/lib/cost";
import { fmtDate, today } from "@/lib/format";
import { activeDeals } from "@/lib/insights";
import { useLookup, useStore } from "@/lib/store/store";
import type { CostInputs } from "@/lib/types";

type Tab = "simulator" | "checklist" | "preview";

export default function ExportPage() {
  const [tab, setTab] = useState<Tab>("simulator");
  return (
    <>
      <PageHeader title="Export" subtitle="輸出原価シミュレーター・輸出Checklist" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "simulator", label: "Export Cost Simulator" },
          { key: "checklist", label: "Export Checklist" },
          { key: "preview", label: "商品 × 輸出国 で確認" },
        ]}
      />
      <div className="mt-4">{tab === "simulator" ? <Simulator /> : tab === "checklist" ? <ChecklistBoard /> : <Preview />}</div>
    </>
  );
}

function Simulator() {
  const { db, settings, run } = useStore();
  const [dealId, setDealId] = useState("");
  const [productId, setProductId] = useState("");
  const [cost, setCost] = useState<CostInputs>(() => defaultCost({ fx_rate: settings.fx_rates.USD ?? 150, fee_value: settings.default_commission, quantity: 100 }));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-line pb-4">
        <Field label="Deal から読み込む" className="min-w-64">
          <Select
            value={dealId}
            onChange={(e) => {
              setDealId(e.target.value);
              const d = db.deals.find((x) => x.id === e.target.value);
              if (d) setCost(d.cost);
            }}
          >
            <option value="">— 新規シミュレーション —</option>
            {db.deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}｜{d.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="商品原価を商品DBから" className="min-w-64">
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = db.products.find((x) => x.id === e.target.value);
              const producer = db.producers.find((x) => x.id === p?.producer_id);
              if (p) setCost((c) => ({ ...c, unit_cost: p.cost_price ?? 0, quantity: c.quantity || p.moq || 0, fee_value: producer?.commission_rate ?? c.fee_value }));
            }}
          >
            <option value="">—</option>
            {db.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {dealId && (
          <Button variant="primary" onClick={() => run((tx) => applyCost(tx, dealId, cost), { ok: "Deal に保存しました（価格は再承認待ち）" })}>
            Deal に保存
          </Button>
        )}
      </div>
      <CostSimulator value={cost} onChange={setCost} />
    </Card>
  );
}

function ChecklistBoard() {
  const { db } = useStore();
  const lk = useLookup();
  const deals = activeDeals(db).filter((d) => db.tasks.some((t) => t.deal_id === d.id && t.kind === "checklist"));
  const [sel, setSel] = useState<string>(deals[0]?.id ?? "");
  const now = today();

  const stats = useMemo(
    () =>
      new Map(
        deals.map((d) => {
          const items = db.tasks.filter((t) => t.deal_id === d.id && t.kind === "checklist");
          const done = items.filter((t) => t.status === "done" || t.status === "na").length;
          const overdue = items.filter((t) => t.status !== "done" && t.status !== "na" && t.due_date && t.due_date < now).length;
          const next = items.filter((t) => t.status !== "done" && t.status !== "na").sort((a, b) => a.sort_order - b.sort_order)[0];
          return [d.id, { total: items.length, done, overdue, next }];
        }),
      ),
    [deals, db.tasks, now],
  );

  if (deals.length === 0) return <Empty>Checklist のある進行中 Deal はありません</Empty>;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
      <Card title="進行中の輸出案件" pad={false}>
        <ul className="divide-y divide-line">
          {deals.map((d) => {
            const s = stats.get(d.id)!;
            return (
              <li key={d.id}>
                <button onClick={() => setSel(d.id)} className={`block w-full px-4 py-2.5 text-left hover:bg-surface-2 ${sel === d.id ? "bg-accent-soft" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">
                      {d.code} {lk.buyer.get(d.buyer_id ?? "")?.company_name}
                    </span>
                    <StageBadge stage={d.stage} />
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
                    {countryLabel(d.country)}・{lk.product.get(d.product_id ?? "")?.name}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={s.total ? s.done / s.total : 0} />
                    <span className="tabular shrink-0 text-[11px] text-ink-3">
                      {s.done}/{s.total}
                    </span>
                    {s.overdue > 0 && <span className="shrink-0 text-[11px] font-medium text-bad">超過{s.overdue}</span>}
                  </div>
                  {s.next && <div className="mt-1 truncate text-[11.5px] text-ink-2">次：{s.next.title}（{fmtDate(s.next.due_date)}）</div>}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      {sel && (
        <Card title={<Link href={`/deals/${sel}`} className="hover:text-accent-2">{lk.deal.get(sel)?.code} {lk.deal.get(sel)?.title}</Link>}>
          <Checklist dealId={sel} />
        </Card>
      )}
    </div>
  );
}

function Preview() {
  const { db } = useStore();
  const [productId, setProductId] = useState(db.products[0]?.id ?? "");
  const [country, setCountry] = useState("SG");
  const [open, setOpen] = useState(false);
  const product = db.products.find((p) => p.id === productId);
  const items = buildChecklist(country, product);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="商品" className="min-w-64">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {db.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="輸出国" className="min-w-48">
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="primary" onClick={() => setOpen(true)}>
          この組み合わせで Deal 作成
        </Button>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-2">
        {product?.name} × {countryLabel(country)}：{items.length} 項目（国別・商品特性による追加項目を含む）。規制の最終判断は必ず当局・通関業者に確認してください。
      </p>
      <Table>
        <thead>
          <tr>
            <th>区分</th>
            <th>項目</th>
            <th className="text-right">目安（作成日+日）</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) =>
            items
              .filter((i) => i.group === g)
              .map((i, k) => (
                <tr key={i.key}>
                  <td className="text-ink-3">{k === 0 ? g : ""}</td>
                  <td>{i.title}</td>
                  <td className="tabular text-right">{i.offset}</td>
                </tr>
              )),
          )}
        </tbody>
      </Table>
      {open && <NewDealModal open onClose={() => setOpen(false)} preset={{ product_id: productId }} />}
    </Card>
  );
}
