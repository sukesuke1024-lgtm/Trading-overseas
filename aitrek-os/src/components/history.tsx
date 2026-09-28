"use client";

import { useState } from "react";
import { RotateCcw, ChevronDown } from "lucide-react";
import { ACTION_LABELS, TABLE_LABELS, fieldLabel, formatValue } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store/store";
import type { AuditEntry } from "@/lib/types";
import { Badge, Button, cx, type Tone } from "./ui";

const TONE: Record<AuditEntry["action"], Tone> = { insert: "green", update: "blue", delete: "red", restore: "gold" };

/** 訂正履歴（変更前 → 変更後）。Owner / Admin は任意の時点に戻せる */
export function HistoryList({ entries, showRecord = false, limit = 50 }: { entries: AuditEntry[]; showRecord?: boolean; limit?: number }) {
  const { run, can } = useStore();
  const [shown, setShown] = useState(limit);
  const list = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (list.length === 0) return <p className="py-6 text-center text-[12.5px] text-ink-3">訂正履歴はまだありません</p>;

  return (
    <div>
      <ol className="flex flex-col divide-y divide-line">
        {list.slice(0, shown).map((e) => (
          <Entry
            key={e.id}
            e={e}
            showRecord={showRecord}
            canRestore={can("history.restore") && (e.action === "update" || (e.action === "delete" && !!e.snapshot))}
            onRestore={() => {
              if (!confirm(`この${ACTION_LABELS[e.action]}を元に戻しますか？（戻した操作も履歴に残ります）`)) return;
              run((tx) => (tx.restore(e), true), { need: "history.restore", ok: "元に戻しました" });
            }}
          />
        ))}
      </ol>
      {list.length > shown && (
        <div className="pt-3 text-center">
          <Button size="sm" onClick={() => setShown((s) => s + 100)}>
            さらに表示（残り {list.length - shown} 件）
          </Button>
        </div>
      )}
    </div>
  );
}

function Entry({ e, showRecord, canRestore, onRestore }: { e: AuditEntry; showRecord: boolean; canRestore: boolean; onRestore: () => void }) {
  const [open, setOpen] = useState(false);
  const fields = Object.entries(e.changes);
  const summary =
    e.action === "update"
      ? fields.map(([k]) => fieldLabel(k)).join("、")
      : e.action === "delete"
        ? "レコードを削除"
        : e.action === "restore"
          ? "削除したレコードを復元"
          : "新規作成";
  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <Badge tone={TONE[e.action]} className="mt-0.5">
          {ACTION_LABELS[e.action]}
        </Badge>
        <button className="min-w-0 flex-1 text-left" onClick={() => fields.length > 0 && setOpen((o) => !o)}>
          <div className="text-[12.5px] text-ink">
            {showRecord && (
              <span className="mr-1.5 font-medium">
                {TABLE_LABELS[e.table_name]}：{e.record_label}
              </span>
            )}
            <span className="text-ink-2">{summary}</span>
            {fields.length > 0 && <ChevronDown size={13} className={cx("ml-1 inline text-ink-3 transition-transform", open && "rotate-180")} />}
          </div>
          <div className="text-[11.5px] text-ink-3">
            {fmtDateTime(e.created_at)}・{e.actor}
          </div>
        </button>
        {canRestore && (
          <Button size="sm" variant="ghost" onClick={onRestore} title="この変更を元に戻す">
            <RotateCcw size={13} /> 戻す
          </Button>
        )}
      </div>
      {open && fields.length > 0 && (
        <table className="mt-1.5 w-full text-[12px]">
          <tbody>
            {fields.map(([k, c]) => (
              <tr key={k} className="align-top">
                <td className="w-28 py-0.5 pr-2 text-ink-3">{fieldLabel(k)}</td>
                <td className="py-0.5">
                  <span className="text-bad line-through decoration-bad/40">{formatValue(c.from)}</span>
                  <span className="mx-1.5 text-ink-3">→</span>
                  <span className="text-good">{formatValue(c.to)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
