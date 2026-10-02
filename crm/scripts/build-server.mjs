// サーバー版のビルド（Mac / Windows / Linux 共通。環境変数の書き方がOSで違うため Node から指定する）
import { spawnSync } from "node:child_process";
const r = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_MODE: "server" } });
process.exit(r.status ?? 1);
