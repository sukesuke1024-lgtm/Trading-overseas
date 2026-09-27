import { createClient } from "@supabase/supabase-js";

// 不具合報告を GitHub Issue（label: bug）にする。夜間の修正担当（Claude）はこの Issue を見て修正案 PR を作る。
// 必要な環境変数：GITHUB_REPORT_TOKEN（Issues: Read and write のみ許可した fine-grained token）
//                 GITHUB_REPO（例 sukesuke1024-lgtm/Trading-overseas）
export async function POST(req: Request) {
  const token = process.env.GITHUB_REPORT_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return Response.json({ error: "報告先（GitHub）が未設定です" }, { status: 501 });

  // Supabase 運用時はログイン中のメンバーのみ
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data } = bearer ? await createClient(url, anon).auth.getUser(bearer) : { data: { user: null } };
    if (!data.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!r || typeof r.fingerprint !== "string" || !/^[0-9a-f]{1,16}$/.test(r.fingerprint)) return Response.json({ error: "invalid report" }, { status: 400 });
  const clip = (v: unknown, n: number) => String(v ?? "").replace(/```/g, "'''").slice(0, n);

  const gh = (path: string, init?: RequestInit) =>
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(init?.headers ?? {}) },
    });

  const marker = `fp-${r.fingerprint}`;
  const body = [
    `**種類**: ${clip(r.kind, 20)}　**画面**: \`${clip(r.path, 120)}\`　**バージョン**: ${clip(r.version, 20)}`,
    `**発生日時**: ${clip(r.at, 30)}　**端末**: ${clip(r.userAgent, 160)}`,
    r.description ? `\n### 利用者からの説明\n${clip(r.description, 2000)}` : "",
    "\n### エラー\n```\n" + clip(r.message, 600) + "\n```",
    r.stack ? "\n### スタック（ファイル・行のみ）\n```\n" + clip(r.stack, 1500) + "\n```" : "",
    `\n<sub>${marker}・AITREK OS から自動送信（取引データ・個人情報は匿名化済み）</sub>`,
  ].join("\n");

  try {
    if (r.kind !== "manual") {
      const q = encodeURIComponent(`repo:${repo} is:issue is:open label:bug "${marker}" in:body`);
      const found = await gh(`/search/issues?q=${q}&per_page=1`).then((x) => x.json());
      const existing = found?.items?.[0];
      if (existing) {
        await gh(`/repos/${repo}/issues/${existing.number}/comments`, { method: "POST", body: JSON.stringify({ body: `再発しました（${clip(r.at, 30)}・${clip(r.path, 120)}・v${clip(r.version, 20)}）` }) });
        return Response.json({ url: existing.html_url, duplicate: true });
      }
    }
    const title = r.kind === "manual" ? `[不具合報告] ${clip(r.description, 60).split("\n")[0]}` : `[自動検知] ${clip(r.message, 80)}`;
    const res = await gh(`/repos/${repo}/issues`, { method: "POST", body: JSON.stringify({ title, body, labels: ["bug", r.kind === "manual" ? "user-report" : "auto-report"] }) });
    if (!res.ok) return Response.json({ error: `GitHub ${res.status}` }, { status: 502 });
    const issue = await res.json();
    return Response.json({ url: issue.html_url });
  } catch {
    return Response.json({ error: "GitHub への送信に失敗しました" }, { status: 502 });
  }
}
