// サーバー運用：画面とAPIを起動し、公的情報（為替・制裁リスト・官公庁ニュース）を毎時、自動更新する（24時間365日）。
//   npm run build && npm run serve        （LAN内の端末からも開く場合: HOST=0.0.0.0）
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const port = process.env.PORT ?? "3000";
const host = process.env.HOST ?? "0.0.0.0";
const everyMin = Number(process.env.CRM_REFRESH_MINUTES ?? 60);

const urls = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:${port}`);
console.log(`\n  H-LINK CRM（サーバー版）\n  ${[`http://localhost:${port}`, ...urls].join("\n  ")}\n  ※ 社内ネットワーク（またはVPN）内でのみ使い、インターネットへ直接公開しないでください。\n`);

const web = spawn("npx", ["next", "start", "-H", host, "-p", port], { stdio: "inherit", shell: process.platform === "win32" });
web.on("exit", (c) => process.exit(c ?? 0));

const refresh = () => { const p = spawn(process.execPath, ["scripts/refresh-data.mjs"], { stdio: "inherit" }); p.on("error", () => {}); };
if (everyMin > 0) { setTimeout(refresh, 5_000); setInterval(refresh, everyMin * 60_000); }
