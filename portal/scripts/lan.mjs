// 同じネットワーク（社内LAN・自宅Wi-Fi）の他の端末（スマホ等）から開けるよう、全インターフェースで待ち受けて接続URLを表示する。
// 使い方:  npm run start:lan  /  npm run dev:lan
import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

const mode = process.argv[2] === "dev" ? "dev" : "start";
const port = process.env.PORT ?? "3000";
const urls = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:${port}`);

console.log("\n  同じネットワークの端末から、次のURLで開けます：");
for (const u of urls.length ? urls : ["（LANのIPアドレスが見つかりません）"]) console.log(`    ${u}`);
console.log("  ※ 初回ログイン時に認証アプリの登録が必要です。https でない場合、ホーム画面へのインストール（PWA）は一部端末で制限されます。\n");

const child = spawn("npx", ["next", mode, "-H", "0.0.0.0", "-p", port], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (c) => process.exit(c ?? 0));
