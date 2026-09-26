"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { Badge, Button, Field, Modal, Select } from "@/components/ui";
import { countryLabel } from "@/lib/constants";
import { createQuotation } from "@/lib/documents";
import { fmtDate, money } from "@/lib/format";
import { useLookup, useStore } from "@/lib/store/store";
import type { Quotation } from "@/lib/types";

const qTone = (s: Quotation["status"]) => (s === "accepted" ? "green" : s === "sent" ? "blue" : s === "rejected" ? "red" : "gray");

function QuotationsInner() {
  const { db, run, can } = useStore();
  const lk = useLookup();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [dealId, setDealId] = useState("");
  const handled = useRef(false);

  function create(id: string) {
    const deal = db.deals.find((d) => d.id === id);
    if (!deal) return;
    const q = run((tx) => createQuotation(tx, deal), { ok: "Quotation を作成しました" });
    if (q) router.replace(`/quotations/${q.id}`);
  }

  // Deal 画面からの「Quotation 作成」
  useEffect(() => {
    const id = params.get("deal");
    if (params.get("new") === "1" && id && !handled.current) {
      handled.current = true;
      create(id);
    }
  });

  const total = (q: Quotation) => q.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  return (
    <>
      <CrudList<Quotation>
        title="Quotations"
        subtitle="Deal の原価計算から見積を自動作成（作成時に Deal 履歴へ保存）"
        rows={db.quotations}
        csvName="quotations"
        href={(r) => `/quotations/${r.id}`}
        onNew={() => setOpen(true)}
        newLabel="見積作成"
        canCreate={can("record.edit")}
        search={(r) => [r.code, lk.buyer.get(r.buyer_id ?? "")?.company_name, lk.deal.get(r.deal_id ?? "")?.title].join(" ")}
        filters={[{ label: "Status", options: ["draft", "sent", "accepted", "rejected"], test: (r, v) => r.status === v }]}
        columns={[
          { label: "No.", render: (r) => r.code, sort: (r) => r.code, csv: (r) => r.code },
          { label: "Buyer", render: (r) => { const b = lk.buyer.get(r.buyer_id ?? ""); return b ? `${countryLabel(b.country)} ${b.company_name}` : "—"; }, csv: (r) => lk.buyer.get(r.buyer_id ?? "")?.company_name ?? "" },
          { label: "Deal", render: (r) => lk.deal.get(r.deal_id ?? "")?.code ?? "—", csv: (r) => lk.deal.get(r.deal_id ?? "")?.code ?? "" },
          { label: "発行日", render: (r) => fmtDate(r.issue_date), sort: (r) => r.issue_date, csv: (r) => r.issue_date },
          { label: "有効期限", render: (r) => fmtDate(r.valid_until), csv: (r) => r.valid_until },
          { label: "Incoterms", render: (r) => r.incoterm, csv: (r) => r.incoterm },
          { label: "金額", render: (r) => money(total(r), r.currency), sort: (r) => total(r), className: "tabular text-right", csv: (r) => `${r.currency} ${total(r)}` },
          { label: "Status", render: (r) => <Badge tone={qTone(r.status)}>{r.status}</Badge>, sort: (r) => r.status, csv: (r) => r.status },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="見積作成"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>キャンセル</Button>
            <Button variant="primary" disabled={!dealId} onClick={() => create(dealId)}>
              作成
            </Button>
          </>
        }
      >
        <Field label="Deal" hint="Deal の数量・Incoterms・通貨・原価計算の売価から明細を作成します">
          <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
            <option value="">選択してください</option>
            {db.deals.filter((d) => d.stage !== "lost").map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}｜{d.title}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>
    </>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense>
      <QuotationsInner />
    </Suspense>
  );
}
