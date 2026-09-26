"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer, Save, Trash2 } from "lucide-react";
import { DocPrint } from "@/components/doc-print";
import { LineItemsEditor } from "@/components/line-items";
import { Badge, Button, Card, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { log } from "@/lib/automation";
import { CURRENCIES, INCOTERMS } from "@/lib/constants";
import { quotationToDoc } from "@/lib/documents";
import { useStore } from "@/lib/store/store";
import type { Quotation } from "@/lib/types";

export default function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const { db } = useStore();
  const q = db.quotations.find((x) => x.id === id);
  if (!q) return <Empty action={<Link href="/quotations" className="text-accent-2">一覧へ</Link>}>見積が見つかりません</Empty>;
  return <Editor key={q.updated_at} q={q} />;
}

function Editor({ q }: { q: Quotation }) {
  const { db, run, can } = useStore();
  const router = useRouter();
  const [v, setV] = useState<Quotation>(q);
  const deal = db.deals.find((d) => d.id === q.deal_id);
  // 単価の手動変更は Owner/Admin のみ（Deal の承認済み価格が基準）
  const priceLocked = !can("price.change");
  const pricesChanged = JSON.stringify(v.items.map((i) => i.unit_price)) !== JSON.stringify(q.items.map((i) => i.unit_price));

  function save(status?: Quotation["status"]) {
    const next = { ...v, ...(status ? { status } : {}) };
    const sending = status === "sent" && q.status !== "sent";
    if (sending && deal && !deal.price_approved && !can("price.change")) {
      alert("Deal の価格が未承認のため送付済みにできません。Owner / Admin の価格承認を取得してください。");
      return;
    }
    const ok = run(
      (tx) => {
        const { id: _i, created_at: _c, updated_at: _u, ...rest } = next;
        void _i; void _c; void _u;
        tx.update("quotations", q.id, rest);
        if (status && status !== q.status) log(tx, "quotation", `Quotation ${q.code}：${q.status} → ${status}`, { deal_id: q.deal_id });
        if (pricesChanged) log(tx, "approval", `Quotation ${q.code} の単価を変更`, { deal_id: q.deal_id });
        return true;
      },
      { need: pricesChanged ? "price.change" : "record.edit", ok: "保存しました" },
    );
    if (ok && status) setV(next);
  }

  return (
    <>
      <div className="no-print">
        <Link href="/quotations" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Quotations
        </Link>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold">{q.code}</h1>
            <div className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
              <Badge tone={q.status === "accepted" ? "green" : q.status === "sent" ? "blue" : q.status === "rejected" ? "red" : "gray"}>{q.status}</Badge>
              {deal && (
                <Link href={`/deals/${deal.id}`} className="hover:text-accent-2">
                  {deal.code} {deal.title}
                </Link>
              )}
              {deal && <Badge tone={deal.price_approved ? "green" : "amber"}>{deal.price_approved ? "価格承認済" : "価格未承認"}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save()}>
              <Save size={14} /> 保存
            </Button>
            {q.status === "draft" && <Button onClick={() => save("sent")}>送付済みにする</Button>}
            {q.status === "sent" && (
              <>
                <Button onClick={() => save("accepted")}>受諾</Button>
                <Button onClick={() => save("rejected")}>失注</Button>
              </>
            )}
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={14} /> PDF出力
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm("削除しますか？")) return;
                if (run((tx) => (tx.remove("quotations", q.id), true), { need: "record.delete" })) router.push("/quotations");
              }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <Card className="mb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="発行日">
              <Input type="date" value={v.issue_date} onChange={(e) => setV({ ...v, issue_date: e.target.value })} />
            </Field>
            <Field label="有効期限">
              <Input type="date" value={v.valid_until} onChange={(e) => setV({ ...v, valid_until: e.target.value })} />
            </Field>
            <Field label="通貨">
              <Select value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })} disabled={priceLocked}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Incoterms">
              <Select value={v.incoterm} onChange={(e) => setV({ ...v, incoterm: e.target.value as Quotation["incoterm"] })}>
                {INCOTERMS.map((i) => (
                  <option key={i.key}>{i.key}</option>
                ))}
              </Select>
            </Field>
            <Field label="仕向地 / Port">
              <Input value={v.port} onChange={(e) => setV({ ...v, port: e.target.value })} />
            </Field>
            <Field label="Payment Terms">
              <Input value={v.payment_terms} onChange={(e) => setV({ ...v, payment_terms: e.target.value })} />
            </Field>
            <Field label="Lead Time" className="sm:col-span-2">
              <Input value={v.lead_time} onChange={(e) => setV({ ...v, lead_time: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4">
            <LineItemsEditor items={v.items} onChange={(items) => setV({ ...v, items })} currency={v.currency} priceLocked={priceLocked} />
            {priceLocked && <p className="mt-1 text-[11.5px] text-ink-3">単価は Deal の原価計算から自動設定されています。変更は Owner / Admin のみ可能です。</p>}
          </div>
          <Field label="Remarks" className="mt-4">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </Card>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">プレビュー</h2>
      </div>
      <DocPrint doc={{ ...quotationToDoc(v), notes: v.notes }} />
    </>
  );
}
