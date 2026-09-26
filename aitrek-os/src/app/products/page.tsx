"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CrudList } from "@/components/crud-list";
import { EntityForm } from "@/components/entity-form";
import { Badge, Modal } from "@/components/ui";
import { log, prepareProduct } from "@/lib/automation";
import { PRODUCT_CATEGORIES, PRODUCT_STATUS, COUNTRIES } from "@/lib/constants";
import { yen } from "@/lib/format";
import { PRODUCT_FIELDS } from "@/lib/schemas";
import { blanks } from "@/lib/seed";
import { useStore } from "@/lib/store/store";
import { nextCode } from "@/lib/store/tx";
import type { Product } from "@/lib/types";

function ProductsInner() {
  const { db, run, can } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const presetProducer = params.get("producer");
  const [open, setOpen] = useState(params.get("new") === "1");
  const producerName = new Map(db.producers.map((p) => [p.id, p.company_name]));

  return (
    <>
      <CrudList<Product>
        title="Products"
        subtitle="輸出候補商品データベース"
        rows={db.products}
        csvName="products"
        href={(r) => `/products/${r.id}`}
        onNew={() => setOpen(true)}
        canCreate={can("record.edit")}
        search={(r) => [r.code, r.name, r.name_en, r.sku, r.jan, r.hs_code, producerName.get(r.producer_id ?? "")].join(" ")}
        filters={[
          { label: "Category", options: PRODUCT_CATEGORIES, test: (r, v) => r.category === v },
          { label: "Producer", options: db.producers.map((p) => ({ value: p.id, label: p.company_name })), test: (r, v) => r.producer_id === v },
          { label: "対応国", options: COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })), test: (r, v) => r.target_countries.includes(v) },
          { label: "Status", options: PRODUCT_STATUS, test: (r, v) => r.status === v },
        ]}
        columns={[
          {
            label: "商品名",
            render: (r) => (
              <span className="flex items-center gap-2">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="h-7 w-7 rounded object-cover" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded bg-surface-2 text-[10px] text-ink-3">{r.category.slice(0, 2)}</span>
                )}
                <span>
                  {r.name}
                  <span className="block text-[11.5px] font-normal text-ink-3">{r.code}{r.name_en ? ` ・ ${r.name_en}` : ""}</span>
                </span>
              </span>
            ),
            sort: (r) => r.name,
            csv: (r) => r.name,
          },
          { label: "Producer", render: (r) => producerName.get(r.producer_id ?? "") ?? "—", csv: (r) => producerName.get(r.producer_id ?? "") ?? "" },
          { label: "Category", render: (r) => r.category, sort: (r) => r.category, csv: (r) => r.category },
          { label: "HS Code", render: (r) => <span className="font-mono text-[12px]">{r.hs_code || "—"}</span>, csv: (r) => r.hs_code },
          { label: "原価", render: (r) => yen(r.cost_price), sort: (r) => r.cost_price ?? 0, className: "tabular text-right", csv: (r) => r.cost_price ?? "" },
          { label: "輸出価格", render: (r) => yen(r.export_price), sort: (r) => r.export_price ?? 0, className: "tabular text-right", csv: (r) => r.export_price ?? "" },
          { label: "MOQ", render: (r) => r.moq ?? "—", className: "tabular text-right", csv: (r) => r.moq ?? "" },
          { label: "保存", render: (r) => r.storage || "—", csv: (r) => r.storage },
          { label: "Status", render: (r) => <Badge tone={r.status === "販売中" ? "green" : r.status === "輸出可能" ? "blue" : r.status === "停止" ? "red" : "gray"}>{r.status}</Badge>, sort: (r) => r.status, csv: (r) => r.status },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="商品登録" wide>
        <EntityForm
          fields={PRODUCT_FIELDS}
          initial={{ ...blanks.product(), producer_id: presetProducer }}
          onCancel={() => setOpen(false)}
          submitLabel="登録"
          onSubmit={(v) => {
            const p = run(
              (tx) => {
                const prepared = prepareProduct(tx, v as Partial<Product>);
                const row = tx.insert("products", { ...(prepared as Omit<Product, "id" | "created_at" | "updated_at">), code: (v.code as string) || nextCode(tx.all("products"), "PD-") });
                log(tx, "created", `商品登録：${row.name}（Producer：${tx.find("producers", row.producer_id)?.company_name ?? "—"}）`, { entity_type: "product", entity_id: row.id });
                return row;
              },
              { ok: "商品を登録しました" },
            );
            if (p) {
              setOpen(false);
              router.push(`/products/${p.id}`);
            }
          }}
        />
      </Modal>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
