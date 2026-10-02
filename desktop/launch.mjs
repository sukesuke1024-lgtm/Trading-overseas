// H-LINK 社内ポータル + 営業CRM を、Mac / Windows で1コマンド起動するランチャー
//   node desktop/launch.mjs [--lan] [--rebuild] [--no-open]
//   既定: ポータル http://localhost:3000 / CRM http://localhost:3001 （このPCだけ）
//   --lan: 同じネットワークの他の端末（スマホ等）からも開けるようにする
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const lan = args.has("--lan");
const host = lan ? "0.0.0.0" : "127.0.0.1";
const dataRoot = process.env.HLINK_DATA_DIR ?? join(homedir(), "H-LINK-data"); // 更新しても消えない保存先
const apps = [
  { name: "社内ポータル", dir: "portal", port: process.env.PORTAL_PORT ?? "3000", env: { PORTAL_DATA_DIR: join(dataRoot, "portal") } },
  { name: "営業CRM", dir: "crm", port: process.env.CRM_PORT ?? "3001", env: { CRM_DATA_DIR: join(dataRoot, "crm"), NEXT_PUBLIC_MODE: "server" } },
];

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) { console.error(`Node.js 20 以上が必要です（現在 ${process.version}）。https://nodejs.org/ から LTS を入れてください。`); process.exit(1); }

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, a, cwd, env = {}) => spawnSync(cmd, a, { cwd, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } }).status === 0;
const next = (dir) => join(root, dir, "node_modules", "next", "dist", "bin", "next");

for (const a of apps) {
  const cwd = join(root, a.dir);
  mkdirSync(a.env[Object.keys(a.env).find((k) => k.endsWith("DATA_DIR"))], { recursive: true });
  if (!existsSync(join(cwd, "node_modules"))) { console.log(`\n[${a.name}] 初回の準備（数分かかります）…`); if (!run(npm, ["ci"], cwd)) process.exit(1); }
  if (args.has("--rebuild") || !existsSync(join(cwd, ".next", "BUILD_ID"))) {
    console.log(`\n[${a.name}] ビルド中…`);
    if (!run(process.execPath, [next(a.dir), "build"], cwd, a.env)) process.exit(1);
  }
}

const children = apps.map((a) => {
  const cwd = join(root, a.dir);
  const env = { ...process.env, ...a.env, PORT: a.port, HOST: host };
  const c = a.dir === "crm"
    ? spawn(process.execPath, ["scripts/serve.mjs"], { cwd, stdio: "inherit", env })
    : spawn(process.execPath, [next(a.dir), "start", "-H", host, "-p", a.port], { cwd, stdio: "inherit", env });
  c.on("exit", (code) => { if (code) { console.error(`[${a.name}] が終了しました（コード ${code}）。他のアプリも止めます。`); stop(code); } });
  return c;
});
function stop(code = 0) { for (const c of children) c.kill(); process.exit(code); }
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

const lanIps = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
setTimeout(() => {
  console.log("\n  H-LINK を起動しました。終了するには、このウィンドウで Ctrl+C（または閉じる）。");
  for (const a of apps) console.log(`  ${a.name}: http://localhost:${a.port}` + (lan ? lanIps.map((ip) => `  /  http://${ip}:${a.port}`).join("") : ""));
  console.log(`  データの保存先: ${dataRoot}（バックアップ対象）`);
  console.log("  初回ログイン: 従業員番号（社長は 001）+ 初期PIN 000000 → 認証アプリの登録 → PIN変更\n");
  if (!args.has("--no-open")) {
    const url = `http://localhost:${apps[0].port}`;
    const [cmd, a] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
    spawn(cmd, a, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
}, 6000);
