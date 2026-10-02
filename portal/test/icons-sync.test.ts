import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ポータルと CRM のアイコン・ダウンロード用ファイルは常に同一（portal で npm run icons を実行して同期）
const P = join(process.cwd(), "public"), C = join(process.cwd(), "..", "crm", "public");
test("ポータルと CRM のアイコンが同期している", () => {
  for (const dir of ["icons", "brand"]) {
    for (const f of readdirSync(join(P, dir)).filter((n) => /^(favicon|icon-|apple-touch|app-icon|H-LINK-)/.test(n))) {
      assert.ok(readFileSync(join(P, dir, f)).equals(readFileSync(join(C, dir, f))), `${dir}/${f} が CRM と違います。npm run icons で再生成してください`);
    }
  }
});
