"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActivityFeed, DealTable, NewDealModal, contractTone } from "@/components/common";
import { EntityDetail } from "@/components/entity-detail";
import { Badge, Button, Card, Empty, KV, Table } from "@/components/ui";
import { yen } from "@/lib/format";
import { PRODUCER_FIELDS } from "@/lib/schemas";
import { useStore } from "@/lib/store/store";

export default function ProducerDetail() {
  const { id } = useParams<{ id: string }>();
  const { db } = useStore();
  const [newDeal, setNewDeal] = useState(false);
  const p = db.producers.find((x) => x.id === id);
  const products = db.products.filter((x) => x.producer_id === id);
  const deals = db.deals.filter((d) => d.producer_id === id);
  const acts = db.activities.filter((a) => (a.entity_type === "producer" && a.entity_id === id) || deals.some((d) => d.id === a.deal_id));
  const won = deals.filter((d) => d.stage !== "lost");

  return (
    <EntityDetail
      table="producers"
      row={p as never}
      fields={PRODUCER_FIELDS}
      title={p?.company_name ?? ""}
      subtitle={
        p && (
          <>
            <span>{p.code}</span>
            {p.brand_name && <span>・{p.brand_name}</span>}
            <Badge tone={contractTone(p.contract_status)}>{p.contract_status}</Badge>
          </>
        )
      }
      backHref="/producers"
      backLabel="Producers"
      deleteAction="producer.delete"
      entityType="producer"
      actions={
        <>
          <Link href={`/products?new=1&producer=${id}`} className="inline-flex h-8.5 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
            <Plus size={14} /> 商品追加
          </Link>
          <Button onClick={() => setNewDeal(true)}>
            <Plus size={14} /> Deal
          </Button>
        </>
      }
      side={
        <>
          <Card title="取引サマリー">
            <dl className="grid grid-cols-2 gap-3">
              <KV label="商品数">{products.length}</KV>
              <KV label="Deal数">{deals.length}</KV>
              <KV label="見込売上">{yen(won.reduce((s, d) => s + d.expected_revenue, 0))}</KV>
              <KV label="見込粗利">{yen(won.reduce((s, d) => s + d.expected_profit, 0))}</KV>
            </dl>
          </Card>
          <Card title="Activity">
            <ActivityFeed items={acts} showDeal limit={15} />
          </Card>
        </>
      }
    >
      <Card title={`商品（${products.length}）`} pad={false}>
        {products.length === 0 ? (
          <div className="p-4">
            <Empty>登録された商品はありません</Empty>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>商品</th>
                <th>Category</th>
                <th>HS Code</th>
                <th className="text-right">原価</th>
                <th className="text-right">MOQ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link href={`/products/${x.id}`} className="font-medium hover:text-accent-2">
                      {x.name}
                    </Link>
                  </td>
                  <td>{x.category}</td>
                  <td className="font-mono text-[12px]">{x.hs_code || "—"}</td>
                  <td className="tabular text-right">{yen(x.cost_price)}</td>
                  <td className="tabular text-right">{x.moq ?? "—"}</td>
                  <td>
                    <Badge>{x.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title={`Deal（${deals.length}）`} pad={false}>
        <DealTable deals={deals} />
      </Card>
      {newDeal && <NewDealModal open onClose={() => setNewDeal(false)} preset={{ producer_id: id }} />}
    </EntityDetail>
  );
}
