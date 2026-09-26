"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { Badge, Button, Field, Modal, Select } from "@/components/ui";
import { DOC_TYPES, docTypeLabel } from "@/lib/constants";
import { createDocument } from "@/lib/documents";
import { fmtDate } from "@/lib/format";
import { useLookup, useStore } from "@/lib/store/store";
import type { DocType, TradeDocument } from "@/lib/types";

function DocumentsInner() {
  const { db, run, can, settings } = useStore();
  const lk = useLookup();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocType>("proforma_invoice");
  const [dealId, setDealId] = useState("");
  const [productId, setProductId] = useState("");
  const handled = useRef(false);

  function create(t: DocType, dId: string, pId: string) {
    if (t === "quotation") {
      router.push(`/quotations?new=1&deal=${dId}`);
      return;
    }
    const deal = db.deals.find((d) => d.id === dId);
    const product = db.products.find((p) => p.id === pId);
    const doc = run((tx) => createDocument(tx, t, { deal, product }, settings), { ok: `${docTypeLabel(t)} を生成しました` });
    if (doc) router.replace(`/documents/${doc.id}`);
  }

  // Deal / 商品画面からの「書類作成」
  useEffect(() => {
    const t = params.get("new") as DocType | null;
    if (t && !handled.current && (params.get("deal") || params.get("product"))) {
      handled.current = true;
      create(t, params.get("deal") ?? "", params.get("product") ?? "");
    }
  });

  const productOnly = type === "spec_sheet" || type === "origin_info" || type === "sample_request";

  return (
    <>
      <CrudList<TradeDocument>
        title="Documents"
        subtitle="登録データから貿易書類を自動生成・PDF出力"
        rows={db.documents}
        csvName="documents"
        href={(r) => `/documents/${r.id}`}
        onNew={() => setOpen(true)}
        newLabel="書類生成"
        canCreate={can("record.edit")}
        search={(r) => [r.code, r.title, lk.deal.get(r.deal_id ?? "")?.code].join(" ")}
        filters={[
          { label: "種類", options: DOC_TYPES.map((d) => ({ value: d.key, label: d.label })), test: (r, v) => r.type === v },
          { label: "Status", options: ["draft", "issued", "signed", "void"], test: (r, v) => r.status === v },
        ]}
        columns={[
          { label: "No.", render: (r) => r.code, sort: (r) => r.code, csv: (r) => r.code },
          { label: "種類", render: (r) => docTypeLabel(r.type), sort: (r) => r.type, csv: (r) => docTypeLabel(r.type) },
          { label: "タイトル", render: (r) => <span className="line-clamp-1">{r.title}</span>, csv: (r) => r.title },
          { label: "Deal", render: (r) => lk.deal.get(r.deal_id ?? "")?.code ?? "—", csv: (r) => lk.deal.get(r.deal_id ?? "")?.code ?? "" },
          { label: "発行日", render: (r) => fmtDate(r.issue_date), sort: (r) => r.issue_date, csv: (r) => r.issue_date },
          { label: "Status", render: (r) => <Badge tone={r.status === "signed" ? "green" : r.status === "issued" ? "blue" : r.status === "void" ? "red" : "gray"}>{r.status}</Badge>, csv: (r) => r.status },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="書類生成"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>キャンセル</Button>
            <Button variant="primary" disabled={!dealId && !(productOnly && productId)} onClick={() => create(type, dealId, productId)}>
              生成
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="書類の種類">
            <Select value={type} onChange={(e) => setType(e.target.value as DocType)}>
              {DOC_TYPES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deal" hint="Buyer・商品・数量・価格・Incoterms を自動で差し込みます">
            <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
              <option value="">{productOnly ? "（商品のみで作成）" : "選択してください"}</option>
              {db.deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}｜{d.title}
                </option>
              ))}
            </Select>
          </Field>
          {productOnly && !dealId && (
            <Field label="商品">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">選択してください</option>
                {db.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsInner />
    </Suspense>
  );
}
