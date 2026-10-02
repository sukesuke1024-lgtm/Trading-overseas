// サーバーモードの同期：画面の操作を「変更されたレコードだけ」のかたまり（Op）にして送り、サーバーが現在のデータに適用する。
// データ全体を送り直さないので、別の人が同時に別のレコードを編集しても上書きし合わない。
import type { AuditEntry, Data } from "./types.ts";

export const LIST_KEYS = ["teams", "users", "organizations", "contacts", "deals", "activities", "tasks", "products", "sales", "journals", "forwards", "notices", "mailLogs", "creditReviews"] as const;
export type ListKey = (typeof LIST_KEYS)[number];
export type Op =
  | { k: ListKey; up?: Record<string, unknown>[]; del?: string[] }
  | { k: "creditPolicy"; set: unknown }
  | { k: "audit"; add: AuditEntry[] };

type Rec = { id: string };

/** 変更前と変更後のデータの差分（変更・追加されたレコード／削除されたレコード／新しい監査ログ） */
export function diffData(prev: Data, next: Data): Op[] {
  const ops: Op[] = [];
  for (const k of LIST_KEYS) {
    const a = prev[k] as unknown as Rec[], b = next[k] as unknown as Rec[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    const up: Record<string, unknown>[] = [];
    for (const x of b) { const o = before.get(x.id); if (o !== x && JSON.stringify(o) !== JSON.stringify(x)) up.push(x as unknown as Record<string, unknown>); }
    const now = new Set(b.map((x) => x.id));
    const del = a.filter((x) => !now.has(x.id)).map((x) => x.id);
    if (up.length || del.length) ops.push({ k, ...(up.length ? { up } : {}), ...(del.length ? { del } : {}) } as Op);
  }
  if (prev.creditPolicy !== next.creditPolicy && JSON.stringify(prev.creditPolicy) !== JSON.stringify(next.creditPolicy)) ops.push({ k: "creditPolicy", set: next.creditPolicy });
  if (prev.audit !== next.audit) { const seen = new Set(prev.audit.map((x) => x.id)); const add = next.audit.filter((x) => !seen.has(x.id)); if (add.length) ops.push({ k: "audit", add }); }
  return ops;
}
