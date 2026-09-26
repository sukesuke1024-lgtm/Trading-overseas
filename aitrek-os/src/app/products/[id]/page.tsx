"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AiPanel } from "@/components/ai-panel";
import { ActivityFeed, DealTable, NewDealModal } from "@/components/common";
import { EntityDetail } from "@/components/entity-detail";
import { Badge, Button, Card, KV } from "@/components/ui";
import { prepareProduct } from "@/lib/automation";
import { pct, yen } from "@/lib/format";
import { PRODUCT_FIELDS } from "@/lib/schemas";
import { useStore } from "@/lib/store/store";
import type { Product } from "@/lib/types";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { db } = useStore();
  const [newDeal, setNewDeal] = useState(false);
  const p = db.products.find((x) => x.id === id);
  const producer = db.producers.find((x) => x.id === p?.producer_id);
  const deals = db.deals.filter((d) => d.product_id === id);
  const acts = db.activities.filter((a) => (a.entity_type === "product" && a.entity_id === id) || deals.some((d) => d.id === a.deal_id));
  const margin = p?.export_price && p.cost_price ? (p.export_price - p.cost_price) / p.export_price : null;

  return (
    <EntityDetail
      table="products"
      row={p as never}
      fields={PRODUCT_FIELDS}
      title={p?.name ?? ""}
      subtitle={
        p && (
          <>
            <span>{p.code}</span>
            {p.name_en && <span>・{p.name_en}</span>}
            <Badge>{p.category}</Badge>
            <Badge tone="blue">{p.status}</Badge>
          </>
        )
      }
      backHref="/products"
      backLabel="Products"
      deleteAction="record.delete"
      entityType="product"
      prepare={(tx, v) => prepareProduct(tx, v as Partial<Product>) as Record<string, unknown>}
      actions={
        <>
          <Link href={`/documents?new=spec_sheet&product=${id}`} className="inline-flex h-8.5 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
            Spec Sheet
          </Link>
          <Button variant="primary" onClick={() => setNewDeal(true)}>
            <Plus size={14} /> Deal
          </Button>
        </>
      }
      side={
        p && (
          <>
            <Card title="価格サマリー">
              <dl className="grid grid-cols-2 gap-3">
                <KV label="原価">{yen(p.cost_price)}</KV>
                <KV label="国内卸">{yen(p.domestic_wholesale_price)}</KV>
                <KV label="輸出価格">{yen(p.export_price)}</KV>
                <KV label="想定粗利率">{margin == null ? "—" : pct(margin)}</KV>
              </dl>
              {producer && (
                <p className="mt-3 border-t border-line pt-3 text-[12.5px]">
                  Producer：
                  <Link href={`/producers/${producer.id}`} className="text-accent-2 hover:underline">
                    {producer.company_name}
                  </Link>
                </p>
              )}
            </Card>
            <AiPanel context={{ kind: "product", product: p }} />
            <Card title="Activity">
              <ActivityFeed items={acts} showDeal limit={12} />
            </Card>
          </>
        )
      }
    >
      <Card title={`Deal（${deals.length}）`} pad={false}>
        <DealTable deals={deals} />
      </Card>
      {newDeal && <NewDealModal open onClose={() => setNewDeal(false)} preset={{ product_id: id }} />}
    </EntityDetail>
  );
}
