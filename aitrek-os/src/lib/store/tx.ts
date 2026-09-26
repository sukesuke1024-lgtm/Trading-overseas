import type { Database, Row, TableName } from "../types";
import type { Op } from "./adapter";

type Mutable = Record<TableName, Record<string, unknown>[]>;

/**
 * 1 回の操作（例：Deal 作成 → Checklist 自動生成 → Activity 記録）を
 * まとめて適用するための軽量トランザクション。
 * 変更したテーブルだけ配列をコピーするので、React の再描画は最小限になる。
 */
export class Tx {
  readonly ops: Op[] = [];
  private copied = new Set<TableName>();
  private data: Mutable;

  constructor(db: Database, readonly actor: string) {
    this.data = { ...(db as unknown as Mutable) };
  }

  get db(): Database {
    return this.data as unknown as Database;
  }

  private table(t: TableName) {
    if (!this.copied.has(t)) {
      this.data[t] = [...this.data[t]];
      this.copied.add(t);
    }
    return this.data[t];
  }

  find<T extends TableName>(t: T, id: string | null | undefined): Row<T> | undefined {
    if (!id) return undefined;
    return (this.data[t] as unknown as Row<T>[]).find((r) => (r as { id: string }).id === id);
  }

  all<T extends TableName>(t: T): Row<T>[] {
    return this.data[t] as unknown as Row<T>[];
  }

  insert<T extends TableName>(t: T, row: Omit<Row<T>, "id" | "created_at" | "updated_at"> & Partial<Pick<Row<T>, "id">>) {
    const now = new Date().toISOString();
    const full = {
      id: crypto.randomUUID(),
      created_at: now,
      ...(t === "activities" ? {} : { updated_at: now }),
      ...row,
    } as unknown as Row<T>;
    this.table(t).unshift(full as unknown as Record<string, unknown>);
    this.ops.push({ kind: "insert", table: t, row: full as unknown as Record<string, unknown> });
    return full;
  }

  update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>) {
    const arr = this.table(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    const p = { ...(patch as Record<string, unknown>), ...(t === "activities" ? {} : { updated_at: new Date().toISOString() }) };
    arr[i] = { ...arr[i], ...p };
    this.ops.push({ kind: "update", table: t, id, patch: p });
    return arr[i] as unknown as Row<T>;
  }

  remove(t: TableName, id: string) {
    const arr = this.table(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i >= 0) arr.splice(i, 1);
    this.ops.push({ kind: "remove", table: t, id });
  }
}

export function nextCode(rows: { code: string }[], prefix: string) {
  let max = 0;
  for (const r of rows) {
    const m = r.code?.match(/(\d+)$/);
    if (m && r.code.startsWith(prefix)) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
