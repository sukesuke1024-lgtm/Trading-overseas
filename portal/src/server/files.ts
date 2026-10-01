// アップロードされたファイルの本体の保管（data/files/<id>）。台帳（メタ情報）は共有State、実体と所有者はここ。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadDb, saveDb, type FileMeta } from "./db";

const DIR = path.join(process.env.PORTAL_DATA_DIR ?? path.join(process.cwd(), "data"), "files");
const ID = /^[a-f0-9]{24,40}$/;

export function saveBlob(owner: string, name: string, mime: string, buf: Buffer): string {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const id = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(DIR, id), buf, { mode: 0o600 });
  const db = loadDb();
  (db.files ??= {})[id] = { owner, name, size: buf.length, mime, at: Date.now() };
  saveDb();
  return id;
}
export const blobMeta = (id: string): FileMeta | undefined => (ID.test(id) ? loadDb().files?.[id] : undefined);
export function readBlob(id: string): Buffer | null {
  if (!ID.test(id)) return null;
  try { return fs.readFileSync(path.join(DIR, id)); } catch { return null; }
}
/** 台帳から外れて1時間以上たったファイルを削除（アップロード途中・削除済みのもの） */
export function purgeOrphans(referenced: Set<string>) {
  const db = loadDb(); let n = 0;
  for (const [id, m] of Object.entries(db.files ?? {})) {
    if (referenced.has(id) || Date.now() - m.at < 3600_000) continue;
    try { fs.unlinkSync(path.join(DIR, id)); } catch {}
    delete db.files![id]; n++;
  }
  if (n) saveDb();
}
