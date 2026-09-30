// GitHub Pages 用の静的書き出し（out/）。API（サーバー認証・共有DB）は静的公開できないため、
// ビルド中だけ src/app/api を退避し、デモモード（端末内保存・デモ認証）で出力する。
import { renameSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const api = path.resolve("src/app/api");
const hold = path.resolve(".api-hold");
const moved = existsSync(api);
if (moved) renameSync(api, hold);
let code = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, STATIC: "1", NEXT_PUBLIC_MODE: "static", NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "" },
  });
  code = r.status ?? 1;
} finally {
  if (moved) { mkdirSync(path.dirname(api), { recursive: true }); renameSync(hold, api); }
}
process.exit(code);
