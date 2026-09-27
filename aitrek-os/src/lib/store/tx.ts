import type { AuditEntry, Database, Row, TableName } from "../types";
import type { Op } from "./adapter";

type Mutable = Record<TableName, Record<string, unknown>[]>;

// 訂正履歴の対象外（履歴そのものと、履歴を兼ねる Activity）
const UNAUDITED: TableName[] = ["audit_log", "activities"];
const SKIP_FIELDS = new Set(["updated_at", "created_at", "id"]);

export function recordLabel(row: Record<string, unknown> | undefined) {
  if (!row) return "";
  const pick = ["code", "invoice_no"].map((k) => row[k]).find((v) => typeof v === "string" && v);
  const name = ["company_name", "name", "title"].map((k) => row[k]).find((v) => typeof v === "string" && v);
  return [pick, name].filter(Boolean).join(" ") || String(row.id ?? "");
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

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

  private audit(t: TableName, record: Record<string, unknown>, action: AuditEntry["action"], changes: AuditEntry["changes"], snapshot: Record<string, unknown> | null) {
    if (UNAUDITED.includes(t)) return;
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      table_name: t,
      record_id: String(record.id),
      record_label: recordLabel(record),
      action,
      actor: this.actor,
      changes,
      snapshot,
    };
    this.table("audit_log").unshift(entry as unknown as Record<string, unknown>);
    this.ops.push({ kind: "insert", table: "audit_log", row: entry as unknown as Record<string, unknown> });
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
    this.audit(t, full as unknown as Record<string, unknown>, "insert", {}, null);
    return full;
  }

  update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>) {
    const arr = this.table(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    const before = arr[i];
    const changes: AuditEntry["changes"] = {};
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      if (!SKIP_FIELDS.has(k) && !same(before[k], v)) changes[k] = { from: before[k] ?? null, to: v ?? null };
    }
    if (Object.keys(changes).length === 0) return before as unknown as Row<T>;
    const p = { ...(patch as Record<string, unknown>), ...(UNAUDITED.includes(t) ? {} : { updated_at: new Date().toISOString() }) };
    arr[i] = { ...before, ...p };
    this.ops.push({ kind: "update", table: t, id, patch: p });
    this.audit(t, arr[i], "update", changes, null);
    return arr[i] as unknown as Row<T>;
  }

  remove(t: TableName, id: string) {
    const arr = this.table(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i < 0) return;
    const [removed] = arr.splice(i, 1);
    this.ops.push({ kind: "remove", table: t, id });
    this.audit(t, removed, "delete", {}, removed);
  }

  /** 訂正履歴から元に戻す（戻した操作自体も履歴に残る） */
  restore(entry: AuditEntry) {
    const t = entry.table_name;
    if (entry.action === "delete" && entry.snapshot) {
      if (this.find(t, entry.record_id)) throw new Error("このレコードは既に存在します");
      const row = { ...entry.snapshot, updated_at: new Date().toISOString() };
      this.table(t).unshift(row);
      this.ops.push({ kind: "insert", table: t, row });
      this.audit(t, row, "restore", {}, null);
      return;
    }
    if (entry.action === "update") {
      const current = this.find(t, entry.record_id) as Record<string, unknown> | undefined;
      if (!current) throw new Error("このレコードは削除されています。先に削除を元に戻してください");
      const patch = Object.fromEntries(Object.entries(entry.changes).map(([k, c]) => [k, c.from]));
      this.update(t, entry.record_id, patch as never);
      return;
    }
    throw new Error("この履歴は元に戻せません");
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
