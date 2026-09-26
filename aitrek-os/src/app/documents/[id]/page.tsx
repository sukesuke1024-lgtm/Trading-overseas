"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer, Save, Trash2 } from "lucide-react";
import { DocPrint } from "@/components/doc-print";
import { LineItemsEditor } from "@/components/line-items";
import { Badge, Button, Card, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { log } from "@/lib/automation";
import { CURRENCIES, INCOTERMS, docTypeLabel } from "@/lib/constants";
import { DOC_FIELDS, hasPrices } from "@/lib/documents";
import { useStore } from "@/lib/store/store";
import type { TradeDocument } from "@/lib/types";

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { db } = useStore();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return <Empty action={<Link href="/documents" className="text-accent-2">一覧へ</Link>}>書類が見つかりません</Empty>;
  return <Editor key={doc.updated_at} doc={doc} />;
}

function Editor({ doc }: { doc: TradeDocument }) {
  const { db, run, can } = useStore();
  const router = useRouter();
  const [v, setV] = useState<TradeDocument>(doc);
  const deal = db.deals.find((d) => d.id === doc.deal_id);
  const priced = hasPrices(doc.type);
  const isContract = doc.type === "contract" || doc.type === "sales_confirmation";

  function save(status?: TradeDocument["status"]) {
    const next = { ...v, ...(status ? { status } : {}) };
    // 契約書の締結（signed）は Owner/Admin の契約承認が必要
    const need = status === "signed" && isContract ? "contract.approve" : "record.edit";
    const ok = run(
      (tx) => {
        const { id: _i, created_at: _c, updated_at: _u, ...rest } = next;
        void _i; void _c; void _u;
        tx.update("documents", doc.id, rest);
        if (status && status !== doc.status) log(tx, status === "signed" ? "approval" : "document", `${docTypeLabel(doc.type)} ${doc.code}：${doc.status} → ${status}`, { deal_id: doc.deal_id });
        return true;
      },
      { need, ok: "保存しました" },
    );
    if (ok && status) setV(next);
  }

  return (
    <>
      <div className="no-print">
        <Link href="/documents" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Documents
        </Link>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold">
              {doc.code}・{docTypeLabel(doc.type)}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
              <Badge>{v.status}</Badge>
              {deal && (
                <Link href={`/deals/${deal.id}`} className="hover:text-accent-2">
                  {deal.code} {deal.title}
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save()}>
              <Save size={14} /> 保存
            </Button>
            {v.status === "draft" && <Button onClick={() => save("issued")}>発行済みにする</Button>}
            {isContract && v.status !== "signed" && (
              <Button onClick={() => save("signed")} disabled={!can("contract.approve")} title={!can("contract.approve") ? "Owner / Admin のみ" : undefined}>
                締結（承認）
              </Button>
            )}
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={14} /> PDF出力
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm("削除しますか？")) return;
                if (run((tx) => (tx.remove("documents", doc.id), true), { need: "record.delete" })) router.push("/documents");
              }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <Card className="mb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="タイトル" className="col-span-2">
              <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
            </Field>
            <Field label="発行日">
              <Input type="date" value={v.issue_date} onChange={(e) => setV({ ...v, issue_date: e.target.value })} />
            </Field>
            {priced ? (
              <Field label="通貨">
                <Select value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Incoterms">
                <Select value={v.incoterm} onChange={(e) => setV({ ...v, incoterm: e.target.value as TradeDocument["incoterm"] })}>
                  {INCOTERMS.map((i) => (
                    <option key={i.key}>{i.key}</option>
                  ))}
                </Select>
              </Field>
            )}
            {DOC_FIELDS[doc.type].map((f) => (
              <Field key={f.key} label={f.label} className={["marks", "bank", "description", "ingredients", "shipper", "consignee", "documents_required"].includes(f.key) ? "col-span-2" : ""}>
                {["marks", "bank", "description", "ingredients", "shipper", "consignee"].includes(f.key) ? (
                  <Textarea value={v.fields[f.key] ?? ""} onChange={(e) => setV({ ...v, fields: { ...v.fields, [f.key]: e.target.value } })} className="min-h-16" />
                ) : (
                  <Input value={v.fields[f.key] ?? ""} onChange={(e) => setV({ ...v, fields: { ...v.fields, [f.key]: e.target.value } })} />
                )}
              </Field>
            ))}
          </div>
          {doc.type !== "spec_sheet" && doc.type !== "origin_info" && (
            <div className="mt-4">
              <LineItemsEditor items={v.items} onChange={(items) => setV({ ...v, items })} currency={v.currency} priced={priced} priceLocked={priced && !can("price.change")} />
            </div>
          )}
        </Card>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">プレビュー（PDF出力：ブラウザの印刷 →「PDFに保存」）</h2>
      </div>
      <DocPrint doc={v} />
    </>
  );
}
