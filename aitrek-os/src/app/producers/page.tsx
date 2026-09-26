"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CrudList } from "@/components/crud-list";
import { contractTone } from "@/components/common";
import { EntityForm } from "@/components/entity-form";
import { Badge, Modal } from "@/components/ui";
import { log } from "@/lib/automation";
import { PRODUCER_CONTRACT_STATUS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { PRODUCER_FIELDS } from "@/lib/schemas";
import { blanks } from "@/lib/seed";
import { useStore } from "@/lib/store/store";
import { nextCode } from "@/lib/store/tx";
import type { Producer } from "@/lib/types";

export default function ProducersPage() {
  const { db, run, can } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const productCount = (id: string) => db.products.filter((p) => p.producer_id === id).length;

  return (
    <>
      <CrudList<Producer>
        title="Producers"
        subtitle="北海道を中心とした生産者CRM"
        rows={db.producers}
        csvName="producers"
        href={(r) => `/producers/${r.id}`}
        onNew={() => setOpen(true)}
        canCreate={can("record.edit")}
        search={(r) => [r.code, r.company_name, r.brand_name, r.contact_name, r.address, r.main_products, r.categories.join(" ")].join(" ")}
        filters={[
          { label: "カテゴリー", options: PRODUCT_CATEGORIES, test: (r, v) => r.categories.includes(v) },
          { label: "契約状況", options: PRODUCER_CONTRACT_STATUS, test: (r, v) => r.contract_status === v },
        ]}
        columns={[
          { label: "会社名", render: (r) => <span>{r.company_name}<span className="ml-1.5 text-[11.5px] font-normal text-ink-3">{r.code}</span></span>, sort: (r) => r.company_name, csv: (r) => r.company_name },
          { label: "ブランド", render: (r) => r.brand_name || "—", csv: (r) => r.brand_name },
          { label: "カテゴリー", render: (r) => r.categories.join("、") || "—", csv: (r) => r.categories.join("/") },
          { label: "所在地", render: (r) => r.address || "—", csv: (r) => r.address },
          { label: "商品数", render: (r) => productCount(r.id), sort: (r) => productCount(r.id), className: "tabular text-right" },
          { label: "認証", render: (r) => <div className="flex flex-wrap gap-1">{r.certifications.slice(0, 3).map((c) => <Badge key={c}>{c}</Badge>)}</div>, csv: (r) => r.certifications.join("/") },
          { label: "契約", render: (r) => <Badge tone={contractTone(r.contract_status)}>{r.contract_status}</Badge>, sort: (r) => r.contract_status, csv: (r) => r.contract_status },
          { label: "次回アクション", render: (r) => (r.next_action ? `${fmtDate(r.next_action_date)} ${r.next_action}` : "—"), sort: (r) => r.next_action_date || "9", csv: (r) => r.next_action },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Producer 登録" wide>
        <EntityForm
          fields={PRODUCER_FIELDS}
          initial={blanks.producer()}
          onCancel={() => setOpen(false)}
          submitLabel="登録"
          onSubmit={(v) => {
            const p = run(
              (tx) => {
                const row = tx.insert("producers", { ...(v as Omit<Producer, "id" | "created_at" | "updated_at">), code: (v.code as string) || nextCode(tx.all("producers"), "PRD-") });
                log(tx, "created", `Producer登録：${row.company_name}`, { entity_type: "producer", entity_id: row.id });
                return row;
              },
              { ok: "Producer を登録しました" },
            );
            if (p) {
              setOpen(false);
              router.push(`/producers/${p.id}`);
            }
          }}
        />
      </Modal>
    </>
  );
}
