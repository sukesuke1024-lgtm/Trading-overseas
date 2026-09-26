"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { log } from "@/lib/automation";
import type { Action } from "@/lib/permissions";
import { useStore } from "@/lib/store/store";
import type { Tx } from "@/lib/store/tx";
import type { TableName } from "@/lib/types";
import { EntityForm, EntityView, type FieldDef } from "./entity-form";
import { Button, Card, Empty, Modal } from "./ui";

/** Producer / Buyer / Product 共通の詳細画面の枠 */
export function EntityDetail({
  table,
  row,
  fields,
  title,
  subtitle,
  backHref,
  backLabel,
  deleteAction,
  entityType,
  prepare,
  actions,
  children,
  side,
}: {
  table: TableName;
  row: Record<string, unknown> & { id: string } | undefined;
  fields: FieldDef[];
  title: string;
  subtitle?: ReactNode;
  backHref: string;
  backLabel: string;
  deleteAction: Action;
  entityType: "producer" | "buyer" | "product";
  prepare?: (tx: Tx, v: Record<string, unknown>) => Record<string, unknown>;
  actions?: ReactNode;
  children?: ReactNode;
  side?: ReactNode;
}) {
  const { run, can } = useStore();
  const router = useRouter();
  const [edit, setEdit] = useState(false);

  if (!row) return <Empty action={<Link href={backHref} className="text-accent-2">一覧へ戻る</Link>}>データが見つかりません</Empty>;

  return (
    <>
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button onClick={() => setEdit(true)} disabled={!can("record.edit")}>
            <Pencil size={14} /> 編集
          </Button>
          <Button
            variant="danger"
            disabled={!can(deleteAction)}
            title={!can(deleteAction) ? "Owner / Admin のみ" : undefined}
            onClick={() => {
              if (!confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return;
              const ok = run(
                (tx) => {
                  tx.remove(table, row.id);
                  log(tx, "system", `${entityType}削除：${title}`, { entity_type: entityType, entity_id: row.id });
                  return true;
                },
                { need: deleteAction, ok: "削除しました" },
              );
              if (ok) router.push(backHref);
            }}
          >
            <Trash2 size={14} /> 削除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <EntityView fields={fields} values={row} />
          </Card>
          {children}
        </div>
        {side && <div className="flex min-w-0 flex-col gap-4">{side}</div>}
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title={`${title} を編集`} wide>
        <EntityForm
          fields={fields}
          initial={row}
          onCancel={() => setEdit(false)}
          onSubmit={(v) => {
            const ok = run(
              (tx) => {
                const patch = prepare ? prepare(tx, v) : v;
                const { id: _id, created_at: _c, updated_at: _u, ...rest } = patch;
                void _id; void _c; void _u;
                tx.update(table, row.id, rest as never);
                return true;
              },
              { ok: "保存しました" },
            );
            if (ok) setEdit(false);
          }}
        />
      </Modal>
    </>
  );
}
