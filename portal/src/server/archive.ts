// 保存期間を超えた履歴の自動アーカイブ（サーバー版）。1日1回、状態の読み書きのついでに実行し、CSVを管理者専用のファイルとして保管する。
import { loadDb, saveDb } from "./db";
import { blobMeta, purgeOrphans, saveBlob } from "./files";
import { append } from "../lib/chain.ts";
import { archiveDue, archiveRec, runRetention } from "../lib/archive.ts";
import { DEFAULT_RETENTION } from "../lib/ops.ts";
import type { State } from "../lib/store.tsx";

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function maybeArchive(): boolean {
  const db = loadDb(), s = db.state as State | null;
  if (!s) return false;
  const today = todayLocal();
  if (!archiveDue(s, today)) return false;
  const { next, exports } = runRetention(s, today, s.retention ?? DEFAULT_RETENTION);
  const bom = "﻿";
  const recs = exports.map((e) => {
    const buf = Buffer.from(e.content.startsWith(bom) ? e.content : bom + e.content, "utf8");
    const id = saveBlob("system", e.name, "text/csv", buf);
    return archiveRec(e, id, today, buf.length);
  });
  const audit = recs.length ? (append((next.audit ?? []) as never, { at: new Date().toISOString(), actor: "system", action: `履歴アーカイブ: ${recs.map((r) => `${r.name}（${r.note}）`).join("、")}` } as never) as State["audit"]) : next.audit; // 対象がない日は記録しない
  db.state = { ...next, audit, files: [...recs, ...(next.files ?? [])] };
  purgeOrphans(new Set((db.state as State).files.map((f) => f.id)));
  void blobMeta;
  saveDb();
  return true;
}
