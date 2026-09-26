import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Adapter } from "./adapter";
import { TABLES, emptyDb } from "./adapter";
import type { CompanySettings, Database } from "../types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && anonKey);

let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!supabaseConfigured) return null;
  client ??= createClient(url!, anonKey!);
  return client;
}

const BUCKET = "attachments";

export function createSupabaseAdapter(): Adapter {
  const sb = getSupabase()!;

  const check = <T,>(res: { error: { message: string } | null; data?: T | null }) => {
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
  };

  return {
    mode: "supabase",
    async load() {
      const db = emptyDb();
      const results = await Promise.all(
        TABLES.map((t) => sb.from(t).select("*").order("created_at", { ascending: false }).limit(10000)),
      );
      results.forEach((res, i) => {
        (db as unknown as Record<string, unknown[]>)[TABLES[i]] = check<unknown[]>(res) ?? [];
      });
      const s = await sb.from("app_settings").select("data").eq("id", 1).maybeSingle();
      const settings = (check<{ data: CompanySettings } | null>(s)?.data ?? null) as CompanySettings | null;
      return { db: db as Database, settings: settings as CompanySettings };
    },
    async apply(ops) {
      // トランザクション内の操作を順番に反映する（自動生成タスク等を含む）
      for (const op of ops) {
        if (op.kind === "insert") check(await sb.from(op.table).insert(op.row));
        else if (op.kind === "update") check(await sb.from(op.table).update(op.patch).eq("id", op.id));
        else check(await sb.from(op.table).delete().eq("id", op.id));
      }
    },
    async saveSettings(settings) {
      check(await sb.from("app_settings").upsert({ id: 1, data: settings }));
    },
    async upload(file) {
      const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${file.name}`;
      check(await sb.storage.from(BUCKET).upload(path, file));
      const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
      return { name: file.name, url: check<{ signedUrl: string }>(signed).signedUrl, size: file.size };
    },
  };
}
