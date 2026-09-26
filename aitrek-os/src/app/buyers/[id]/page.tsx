"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus, Mail, MessageCircle } from "lucide-react";
import { ActivityFeed, DealTable, NewDealModal } from "@/components/common";
import { EntityDetail } from "@/components/entity-detail";
import { AiPanel } from "@/components/ai-panel";
import { Badge, Button, Card, KV } from "@/components/ui";
import { log, prepareBuyer } from "@/lib/automation";
import { countryLabel, countryOf } from "@/lib/constants";
import { yen } from "@/lib/format";
import { matchProductsForBuyer } from "@/lib/ai";
import { BUYER_FIELDS } from "@/lib/schemas";
import { useStore } from "@/lib/store/store";
import type { Buyer } from "@/lib/types";
import Link from "next/link";

export default function BuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const { db, run } = useStore();
  const [newDeal, setNewDeal] = useState<string | null>(null);
  const b = db.buyers.find((x) => x.id === id);
  const deals = db.deals.filter((d) => d.buyer_id === id);
  const acts = db.activities.filter((a) => (a.entity_type === "buyer" && a.entity_id === id) || deals.some((d) => d.id === a.deal_id));
  const matches = b ? matchProductsForBuyer(db, b).slice(0, 5) : [];

  return (
    <EntityDetail
      table="buyers"
      row={b as never}
      fields={BUYER_FIELDS}
      title={b?.company_name ?? ""}
      subtitle={
        b && (
          <>
            <span>{b.code}</span>
            <span>・{countryLabel(b.country)}{b.city ? ` / ${b.city}` : ""}</span>
            <Badge tone="blue">{b.status}</Badge>
            <Badge>{b.currency}</Badge>
          </>
        )
      }
      backHref="/buyers"
      backLabel="Buyers"
      deleteAction="buyer.delete"
      entityType="buyer"
      prepare={(_tx, v) => {
        const p = prepareBuyer(v as Partial<Buyer>);
        const country = countryOf(p.country);
        return { ...p, currency: v.country !== b?.country && country ? country.currency : p.currency };
      }}
      actions={
        b && (
          <>
            {b.email && (
              <a href={`mailto:${b.email}`} className="inline-flex h-8.5 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
                <Mail size={14} /> Email
              </a>
            )}
            {b.whatsapp && (
              <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-8.5 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            <Button
              onClick={() =>
                run((tx) => {
                  const d = new Date().toISOString().slice(0, 10);
                  tx.update("buyers", b.id, { last_contact_at: d });
                  log(tx, "call", `接触記録：${b.company_name}`, { entity_type: "buyer", entity_id: b.id });
                }, { ok: "最終接触日を更新しました" })
              }
            >
              接触を記録
            </Button>
            <Button variant="primary" onClick={() => setNewDeal("")}>
              <Plus size={14} /> Deal
            </Button>
          </>
        )
      }
      side={
        b && (
          <>
            <Card title="取引サマリー">
              <dl className="grid grid-cols-2 gap-3">
                <KV label="Deal数">{deals.length}</KV>
                <KV label="進行中">{deals.filter((d) => !["lost", "repeat"].includes(d.stage)).length}</KV>
                <KV label="見込売上">{yen(deals.reduce((s, d) => s + (d.stage === "lost" ? 0 : d.expected_revenue), 0))}</KV>
                <KV label="見込粗利">{yen(deals.reduce((s, d) => s + (d.stage === "lost" ? 0 : d.expected_profit), 0))}</KV>
              </dl>
            </Card>
            <Card title="おすすめ商品（Matching）">
              {matches.length === 0 ? (
                <p className="text-[12.5px] text-ink-3">候補がありません</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {matches.map((m) => (
                    <li key={m.product.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/products/${m.product.id}`} className="block truncate text-[12.5px] font-medium hover:text-accent-2">
                          {m.product.name}
                        </Link>
                        <div className="text-[11.5px] text-ink-3">{m.reasons.join("・")}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={m.score >= 60 ? "green" : "gray"}>{m.score}</Badge>
                        <Button size="sm" onClick={() => setNewDeal(m.product.id)}>
                          Deal
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <AiPanel context={{ kind: "buyer", buyer: b }} />
            <Card title="Activity">
              <ActivityFeed items={acts} showDeal limit={15} />
            </Card>
          </>
        )
      }
    >
      <Card title={`Deal（${deals.length}）`} pad={false}>
        <DealTable deals={deals} />
      </Card>
      {newDeal !== null && <NewDealModal open onClose={() => setNewDeal(null)} preset={{ buyer_id: id, product_id: newDeal || undefined }} />}
    </EntityDetail>
  );
}
