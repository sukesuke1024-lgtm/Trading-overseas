import type { Attachment, CompanySettings, Database, TableName } from "../types";

export type Op =
  | { kind: "insert"; table: TableName; row: Record<string, unknown> }
  | { kind: "update"; table: TableName; id: string; patch: Record<string, unknown> }
  | { kind: "remove"; table: TableName; id: string };

export interface Snapshot {
  db: Database;
  settings: CompanySettings;
}

/**
 * 永続化層。ローカル（ブラウザ保存・デモ用）と Supabase を同じ API で扱う。
 * Store はトランザクション単位で ops を渡し、adapter が保存方法を決める。
 */
export interface Adapter {
  mode: "local" | "supabase";
  load(): Promise<Snapshot | null>;
  apply(ops: Op[], next: Snapshot): Promise<void>;
  saveSettings(settings: CompanySettings, next: Snapshot): Promise<void>;
  upload(file: File): Promise<Attachment>;
  reset?(): Promise<void>;
}

export const TABLES: TableName[] = [
  "producers",
  "buyers",
  "products",
  "deals",
  "activities",
  "tasks",
  "quotations",
  "documents",
  "finance",
  "members",
];

export const emptyDb = (): Database => ({
  producers: [],
  buyers: [],
  products: [],
  deals: [],
  activities: [],
  tasks: [],
  quotations: [],
  documents: [],
  finance: [],
  members: [],
});
