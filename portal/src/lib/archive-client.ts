"use client";
import { archiveRec, runRetention } from "./archive";
import { newFileId, storeLocal } from "./files";

/** デモ版：保存期間を超えた履歴をCSVにして端末内に保管し、現役のデータから外す（サーバー版はサーバーが1日1回自動で実行） */
export async function runLocalArchive(s: Parameters<typeof runRetention>[0], today: string) {
  const { next, exports } = runRetention(s, today, s.retention);
  const recs = [];
  for (const e of exports) {
    const blob = new Blob(["\ufeff", e.content.replace(/^\ufeff/, "")], { type: "text/csv;charset=utf-8" });
    const id = newFileId();
    await storeLocal(id, blob);
    recs.push(archiveRec(e, id, today, blob.size));
  }
  return { next, recs };
}
