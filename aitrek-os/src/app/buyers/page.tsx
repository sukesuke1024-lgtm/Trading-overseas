"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CrudList } from "@/components/crud-list";
import { EntityForm } from "@/components/entity-form";
import { Badge, Modal } from "@/components/ui";
import { log, prepareBuyer } from "@/lib/automation";
import { BUSINESS_TYPES, BUYER_STATUS, COUNTRIES, countryLabel } from "@/lib/constants";
import { fmtDate, today } from "@/lib/format";
import { BUYER_FIELDS } from "@/lib/schemas";
import { blanks } from "@/lib/seed";
import { useStore } from "@/lib/store/store";
import { nextCode } from "@/lib/store/tx";
import type { Buyer } from "@/lib/types";

export default function BuyersPage() {
  const { db, run, can } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dealCount = (id: string) => db.deals.filter((d) => d.buyer_id === id).length;
  const now = today();

  return (
    <>
      <CrudList<Buyer>
        title="Buyers"
        subtitle="海外の輸入業者・卸・小売・飲食企業"
        rows={db.buyers}
        csvName="buyers"
        href={(r) => `/buyers/${r.id}`}
        onNew={() => setOpen(true)}
        canCreate={can("record.edit")}
        search={(r) => [r.code, r.company_name, r.contact_name, r.city, r.country, r.email, r.desired_products].join(" ")}
        filters={[
          { label: "国", options: COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })), test: (r, v) => r.country === v },
          { label: "業態", options: BUSINESS_TYPES, test: (r, v) => r.business_type === v },
          { label: "Status", options: BUYER_STATUS, test: (r, v) => r.status === v },
        ]}
        columns={[
          { label: "企業名", render: (r) => <span>{r.company_name}<span className="ml-1.5 text-[11.5px] font-normal text-ink-3">{r.code}</span></span>, sort: (r) => r.company_name, csv: (r) => r.company_name },
          { label: "国・都市", render: (r) => `${countryLabel(r.country)}${r.city ? ` / ${r.city}` : ""}`, sort: (r) => r.country, csv: (r) => `${r.country} ${r.city}` },
          { label: "業態", render: (r) => r.business_type || "—", csv: (r) => r.business_type },
          { label: "担当者", render: (r) => (r.contact_name ? `${r.contact_name}${r.position ? `（${r.position}）` : ""}` : "—"), csv: (r) => r.contact_name },
          { label: "希望商品", render: (r) => <span className="line-clamp-1 max-w-56">{r.desired_products || "—"}</span>, csv: (r) => r.desired_products },
          { label: "Status", render: (r) => <Badge tone={r.status === "取引中" ? "green" : r.status === "商談中" ? "blue" : r.status === "NG" ? "red" : "gray"}>{r.status}</Badge>, sort: (r) => r.status, csv: (r) => r.status },
          { label: "Deal", render: (r) => dealCount(r.id), sort: (r) => dealCount(r.id), className: "tabular text-right" },
          {
            label: "次回Contact",
            render: (r) => <span className={r.next_contact_at && r.next_contact_at < now ? "font-medium text-bad" : ""}>{fmtDate(r.next_contact_at)}</span>,
            sort: (r) => r.next_contact_at || "9",
            csv: (r) => r.next_contact_at,
          },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Buyer 登録" wide>
        <EntityForm
          fields={BUYER_FIELDS}
          initial={blanks.buyer()}
          onCancel={() => setOpen(false)}
          submitLabel="登録"
          onSubmit={(v) => {
            const b = run(
              (tx) => {
                const prepared = prepareBuyer(v as Partial<Buyer>);
                const row = tx.insert("buyers", { ...(prepared as Omit<Buyer, "id" | "created_at" | "updated_at">), code: (v.code as string) || nextCode(tx.all("buyers"), "BY-") });
                log(tx, "created", `Buyer登録：${row.company_name}（${countryLabel(row.country)}）${!v.country && row.country ? "※国を自動設定" : ""}`, { entity_type: "buyer", entity_id: row.id });
                return row;
              },
              { ok: "Buyer を登録しました" },
            );
            if (b) {
              setOpen(false);
              router.push(`/buyers/${b.id}`);
            }
          }}
        />
      </Modal>
    </>
  );
}
