"use client";
// ファイルの保管・取得。サーバー版は /api/files（本体はサーバー、台帳は共有State）、デモ版はブラウザ内（IndexedDB）。
import { BASE, STATIC } from "./auth";
import { checkUpload, needsStepUp, type FileRec } from "./ops";
import { stepUpValid } from "./stepup";

const DB = "hlink-files", STORE = "blobs";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idbOp<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction(STORE, mode), rq = fn(tx.objectStore(STORE)); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
}
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export type Uploaded = { id: string; name: string; size: number; mime: string };
export async function uploadFile(file: File): Promise<Uploaded | { error: string }> {
  const bad = checkUpload(file.name, file.size);
  if (bad) return { error: bad };
  const mime = file.type || "application/octet-stream";
  if (STATIC) {
    const id = rnd();
    try { await idbOp("readwrite", (s) => s.put(file, id)); } catch { return { error: "この端末に保存できませんでした。" }; }
    return { id, name: file.name, size: file.size, mime };
  }
  const r = await fetch(`${BASE}/api/files`, { method: "POST", credentials: "same-origin", headers: { "content-type": mime, "x-file-name": encodeURIComponent(file.name) }, body: file });
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
  return r.ok && j.id ? { id: j.id, name: file.name, size: file.size, mime } : { error: j.error ?? "アップロードできませんでした。" };
}

export async function fetchFile(rec: FileRec): Promise<{ blob: Blob } | { error: string; stepup?: boolean }> {
  if (STATIC) {
    if (needsStepUp(rec) && !stepUpValid()) return { error: "PINの再入力が必要です。", stepup: true };
    const b = await idbOp<Blob | undefined>("readonly", (s) => s.get(rec.id));
    return b ? { blob: b } : { error: "このファイルはこの端末に保存されていません（デモ版では、アップロードした端末でのみ開けます）。" };
  }
  const r = await fetch(`${BASE}/api/files/${rec.id}`, { credentials: "same-origin", cache: "no-store" });
  if (r.ok) return { blob: await r.blob() };
  const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
  return { error: j.error ?? "ダウンロードできませんでした。", stepup: j.code === "stepup" };
}
export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** デモ版：アーカイブCSVなど、画面側で作ったファイルを保管する */
export async function storeLocal(id: string, blob: Blob) { await idbOp("readwrite", (s) => s.put(blob, id)); }
export const newFileId = rnd;
