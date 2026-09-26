import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { AI_GUARDRAIL } from "@/lib/ai";

// Claude による下書き生成。ANTHROPIC_API_KEY が未設定なら 501 を返し、画面側でテンプレートに切り替える。
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 501 });
  }

  // Supabase 運用時はログイン中のメンバーのみ利用可能
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data } = token ? await createClient(url, anon).auth.getUser(token) : { data: { user: null } };
    if (!data.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { prompt } = (await req.json()) as { prompt?: string };
  if (!prompt || prompt.length > 60000) return Response.json({ error: "invalid prompt" }, { status: 400 });

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: process.env.AITREK_AI_MODEL || "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      // 安全分類器で拒否された場合はサーバー側で自動的に代替モデルへ切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: AI_GUARDRAIL,
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      return Response.json({ error: "このリクエストは生成できませんでした。内容を変えて再度お試しください。" }, { status: 422 });
    }
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return Response.json({ text, model: msg.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "混雑しています。少し待って再度お試しください。" }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "ANTHROPIC_API_KEY が無効です" }, { status: 500 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: `AI API error ${e.status}` }, { status: 502 });
    return Response.json({ error: "AI 呼び出しに失敗しました" }, { status: 502 });
  }
}
