"use client";
// 資料ライブラリ：マイソク（販売図面）・商品カタログ・チラシ・規格書などの実ファイル（PDF・画像・Office）を、この端末のブラウザ内（IndexedDB）に保存する。
// 本番ではクラウドのストレージ（Supabase Storage）に置き換える（関数のシグネチャはそのまま）。
import { useEffect, useState } from "react";

export type DocKind = "マイソク" | "商品カタログ" | "チラシ" | "規格書" | "見積・PI" | "契約書" | "その他";
export const DOC_KINDS: DocKind[] = ["マイソク", "商品カタログ", "チラシ", "規格書", "見積・PI", "契約書", "その他"];
export interface DocMeta { id: string; name: string; type: string; size: number; kind: DocKind; productId: string; note: string; addedAt: string; addedBy: string }
interface Row extends DocMeta { blob: Blob }

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // メール添付の合計の目安（多くのメールサーバーの上限は 20〜25MB）
const DB = "hlink-crm-library", STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("このブラウザでは資料を保存できません"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error("保存領域を開けませんでした"));
  });
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((res, rej) => { const t = db.transaction(STORE, mode); const rq = fn(t.objectStore(STORE)); t.oncomplete = () => { db.close(); res(rq.result); }; t.onerror = () => { db.close(); rej(t.error); }; t.onabort = () => { db.close(); rej(t.error); }; });
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function listDocs(): Promise<DocMeta[]> {
  const rows = await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>);
  return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, size: r.size, kind: r.kind, productId: r.productId, note: r.note, addedAt: r.addedAt, addedBy: r.addedBy })).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
export async function addDoc(file: File, meta: { kind: DocKind; productId?: string; note?: string; addedBy: string }): Promise<DocMeta> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}：ファイルが大きすぎます（上限 ${Math.round(MAX_FILE_BYTES / 1048576)}MB）`);
  const row: Row = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: file.name, type: file.type || guessType(file.name), size: file.size, kind: meta.kind, productId: meta.productId ?? "", note: meta.note ?? "", addedAt: new Date().toISOString(), addedBy: meta.addedBy, blob: file };
  await tx("readwrite", (s) => s.put(row));
  emit();
  const { blob: _b, ...m } = row; void _b;
  return m;
}
export async function updateDoc(id: string, patch: Partial<Pick<DocMeta, "name" | "kind" | "productId" | "note">>) {
  const row = await tx<Row | undefined>("readonly", (s) => s.get(id) as IDBRequest<Row | undefined>);
  if (!row) return;
  await tx("readwrite", (s) => s.put({ ...row, ...patch }));
  emit();
}
export async function deleteDoc(id: string) { await tx("readwrite", (s) => s.delete(id)); emit(); }
export async function getBlob(id: string): Promise<Blob | null> { const r = await tx<Row | undefined>("readonly", (s) => s.get(id) as IDBRequest<Row | undefined>); return r?.blob ?? null; }
export async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const guessType = (name: string) => ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", csv: "text/csv" } as Record<string, string>)[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
export const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 資料の一覧（保存・削除で自動更新） */
export function useDocs() {
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () => listDocs().then((d) => { if (live) { setDocs(d); setError(""); } }).catch((e: Error) => { if (live) { setDocs([]); setError(e.message); } });
    load(); listeners.add(load);
    return () => { live = false; listeners.delete(load); };
  }, []);
  return { docs, error };
}

/** 資料を新しいタブで開く（PDF・画像はそのまま表示） */
export async function openDoc(id: string) {
  const b = await getBlob(id); if (!b) return;
  const url = URL.createObjectURL(b); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function downloadDoc(d: DocMeta) {
  const b = await getBlob(d.id); if (!b) return;
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = d.name; a.click(); URL.revokeObjectURL(a.href);
}
