"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDeal } from "@/lib/automation";
import { INCOTERMS, STAGES, countryLabel, isWon, stageLabel } from "@/lib/constants";
import { fmtDate, relative, yen, addDays, today } from "@/lib/format";
import { useLookup, useStore } from "@/lib/store/store";
import type { Activity, Deal, DealStage, Incoterm } from "@/lib/types";
import { Badge, Button, Empty, Field, Input, Modal, Select, Table, Textarea, type Tone } from "./ui";

export function stageTone(s: DealStage): Tone {
  if (s === "lost") return "red";
  if (s === "repeat" || s === "payment") return "green";
  if (isWon(s)) return "gold";
  if (["quotation", "sample", "negotiation"].includes(s)) return "blue";
  return "gray";
}

export const contractTone = (s: string): Tone => (s === "契約済" ? "green" : s === "交渉中" ? "amber" : s === "停止" ? "red" : "gray");

export function StageBadge({ stage }: { stage: DealStage }) {
  return <Badge tone={stageTone(stage)}>{stageLabel(stage)}</Badge>;
}

const ACT_ICON: Record<string, string> = {
  created: "＋",
  status_change: "→",
  note: "✎",
  call: "☏",
  email: "✉",
  meeting: "◎",
  quotation: "¥",
  document: "▤",
  payment: "₿",
  task: "✓",
  approval: "★",
  ai: "✦",
  system: "⚙",
};

export function ActivityFeed({ items, showDeal = false, limit }: { items: Activity[]; showDeal?: boolean; limit?: number }) {
  const lk = useLookup();
  const list = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit ?? items.length);
  if (list.length === 0) return <p className="py-6 text-center text-[12.5px] text-ink-3">Activity はまだありません</p>;
  return (
    <ol className="flex flex-col">
      {list.map((a) => {
        const deal = a.deal_id ? lk.deal.get(a.deal_id) : undefined;
        return (
          <li key={a.id} className="flex gap-3 border-b border-line py-2 last:border-0">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] text-ink-2">{ACT_ICON[a.type] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] leading-snug text-ink">{a.message}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-ink-3">
                <span>{relative(a.created_at)}</span>
                <span>{a.actor}</span>
                {showDeal && deal && (
                  <Link href={`/deals/${deal.id}`} className="text-accent-2 hover:underline">
                    {deal.code}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DealTable({ deals }: { deals: Deal[] }) {
  const lk = useLookup();
  if (deals.length === 0) return <Empty>関連する Deal はありません</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <th>Deal</th>
          <th>Buyer</th>
          <th>Product</th>
          <th>Status</th>
          <th className="text-right">Revenue</th>
          <th className="text-right">Profit</th>
          <th>Deadline</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => (
          <tr key={d.id}>
            <td>
              <Link href={`/deals/${d.id}`} className="font-medium hover:text-accent-2">
                {d.code}
              </Link>
            </td>
            <td>{lk.buyer.get(d.buyer_id ?? "")?.company_name ?? "—"}</td>
            <td>{lk.product.get(d.product_id ?? "")?.name ?? "—"}</td>
            <td>
              <StageBadge stage={d.stage} />
            </td>
            <td className="tabular text-right">{yen(d.expected_revenue)}</td>
            <td className="tabular text-right">{yen(d.expected_profit)}</td>
            <td>{fmtDate(d.deadline)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function NewDealModal({
  open,
  onClose,
  preset = {},
}: {
  open: boolean;
  onClose: () => void;
  preset?: { buyer_id?: string; product_id?: string; producer_id?: string };
}) {
  const { db, run, settings, me } = useStore();
  const router = useRouter();
  const [v, setV] = useState({
    buyer_id: preset.buyer_id ?? "",
    product_id: preset.product_id ?? "",
    quantity: "",
    incoterm: "" as Incoterm | "",
    stage: "lead" as DealStage,
    deadline: addDays(today(), 14),
    next_action: "",
    owner_id: me?.id ?? "",
    notes: "",
  });
  const buyer = db.buyers.find((b) => b.id === v.buyer_id);
  const product = db.products.find((p) => p.id === v.product_id);
  const products = preset.producer_id ? db.products.filter((p) => p.producer_id === preset.producer_id) : db.products;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const deal = run(
      (tx) =>
        createDeal(
          tx,
          {
            buyer_id: v.buyer_id || null,
            product_id: v.product_id || null,
            quantity: v.quantity ? Number(v.quantity) : undefined,
            incoterm: v.incoterm || undefined,
            stage: v.stage,
            deadline: v.deadline,
            next_action: v.next_action,
            owner_id: v.owner_id || null,
            notes: v.notes,
          },
          settings,
        ),
      { ok: "Deal を作成し、Export Checklist を生成しました" },
    );
    if (deal) {
      onClose();
      router.push(`/deals/${deal.id}`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新規 Deal">
      <form id="new-deal" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Buyer *" className="sm:col-span-2">
          <Select required value={v.buyer_id} onChange={(e) => setV({ ...v, buyer_id: e.target.value })}>
            <option value="">選択してください</option>
            {db.buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {countryLabel(b.country)}｜{b.company_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product *" className="sm:col-span-2" hint={product ? `Producer：${db.producers.find((p) => p.id === product.producer_id)?.company_name ?? "—"}（自動紐付け）` : undefined}>
          <Select required value={v.product_id} onChange={(e) => setV({ ...v, product_id: e.target.value })}>
            <option value="">選択してください</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}｜{p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity" hint={product?.moq ? `MOQ：${product.moq}` : undefined}>
          <Input type="number" min={0} value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} placeholder={product?.moq ? String(product.moq) : ""} />
        </Field>
        <Field label="Incoterms" hint={buyer?.incoterms ? `Buyer希望：${buyer.incoterms}` : undefined}>
          <Select value={v.incoterm} onChange={(e) => setV({ ...v, incoterm: e.target.value as Incoterm })}>
            <option value="">Buyer 設定に従う</option>
            {INCOTERMS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.key}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as DealStage })}>
            {STAGES.slice(0, 8).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} />
        </Field>
        <Field label="担当">
          <Select value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })}>
            <option value="">—</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next Action">
          <Input value={v.next_action} onChange={(e) => setV({ ...v, next_action: e.target.value })} placeholder="要件ヒアリング" />
        </Field>
        <Field label="メモ" className="sm:col-span-2">
          <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
        <p className="text-[12px] text-ink-3 sm:col-span-2">
          作成時に「{product?.name ?? "商品"} × {buyer ? countryLabel(buyer.country) : "輸出国"}」の Export Checklist と原価計算の初期値（商品原価・手数料率・為替）が自動設定されます。
        </p>
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="primary" type="submit" form="new-deal">
          作成
        </Button>
      </div>
    </Modal>
  );
}
