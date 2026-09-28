// 夜間更新で使用：マージした PR から更新履歴（src/lib/changelog.ts）を追記し、
// バージョン（package.json）を上げる。
//   node scripts/release-notes.mjs '<JSON: [{ "number": 12, "title": "..." , "labels": ["fix-proposal"] }]>' 2026-09-28
import { readFileSync, writeFileSync } from "node:fs";

const prs = JSON.parse(process.argv[2] || "[]");
const date = process.argv[3] || new Date().toISOString().slice(0, 10);
if (!prs.length) process.exit(0);

const clPath = new URL("../src/lib/changelog.ts", import.meta.url);
const pkgPath = new URL("../package.json", import.meta.url);
const cl = readFileSync(clPath, "utf8");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const current = cl.match(/version: "(\d+)\.(\d+)\.(\d+)"/);
if (!current) throw new Error("changelog.ts から現在のバージョンを読み取れません");
const isFeature = prs.some((p) => (p.labels || []).includes("feature"));
const [maj, min, pat] = current.slice(1).map(Number);
const next = isFeature ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
const kind = prs.some((p) => (p.labels || []).includes("security")) ? "security" : isFeature ? "feature" : "fix";

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const items = prs.map((p) => `      "${esc(p.title.replace(/^\[?fix\]?:?\s*/i, ""))}（#${p.number}）",`).join("\n");
const entry = `  {\n    version: "${next}",\n    date: "${date}",\n    kind: "${kind}",\n    items: [\n${items}\n    ],${prs.length === 1 ? `\n    pr: ${prs[0].number},` : ""}\n  },\n`;

const marker = "export const CHANGELOG: Release[] = [\n";
if (!cl.includes(marker)) throw new Error("changelog.ts の形式が想定と異なります");
writeFileSync(clPath, cl.replace(marker, marker + entry));
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(next);
