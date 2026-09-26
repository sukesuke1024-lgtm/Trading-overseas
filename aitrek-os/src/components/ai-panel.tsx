"use client";

import { useState } from "react";
import { Sparkles, Copy, Save } from "lucide-react";
import { AI_TASKS, buildPrompt, templateDraft, type AiContext, type AiTask } from "@/lib/ai";
import { log } from "@/lib/automation";
import { getSupabase } from "@/lib/store/supabase";
import { useStore } from "@/lib/store/store";
import { Button, Card, Select, Textarea } from "./ui";

export async function generate(prompt: string, fallback: () => string): Promise<{ text: string; source: "claude" | "template"; error?: string }> {
  try {
    const session = await getSupabase()?.auth.getSession();
    const token = session?.data.session?.access_token;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.text) return { text: j.text, source: "claude" };
    }
    const err = res.status === 501 ? undefined : (await res.json().catch(() => ({}))).error;
    return { text: fallback(), source: "template", error: err };
  } catch {
    return { text: fallback(), source: "template" };
  }
}

export function AiPanel({ context, compact = false, defaultTask }: { context: AiContext; compact?: boolean; defaultTask?: AiTask }) {
  const { db, run, toast } = useStore();
  const tasks = AI_TASKS.filter((t) => t.scope.includes(context.kind));
  const [task, setTask] = useState<AiTask>(defaultTask ?? tasks[0]?.key);
  const [note, setNote] = useState("");
  const [out, setOut] = useState("");
  const [src, setSrc] = useState<"claude" | "template" | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const r = await generate(buildPrompt(db, task, context, note), () => templateDraft(db, task, context, note));
    setOut(r.text);
    setSrc(r.source);
    if (r.error) toast(`AI: ${r.error}（テンプレートで作成）`, "error");
    setBusy(false);
  }

  const dealId = context.kind === "deal" ? context.deal.id : null;

  return (
    <Card
      title={
        <span className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-gold" /> AI Assist
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Select value={task} onChange={(e) => setTask(e.target.value as AiTask)}>
            {tasks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={go} disabled={busy}>
            {busy ? "生成中…" : "生成"}
          </Button>
        </div>
        {(task === "meeting_summary" || !compact) && (
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={task === "meeting_summary" ? "Meeting Note を貼り付け" : "追加の指示・メモ（任意）"} className="min-h-14" />
        )}
        {out && (
          <>
            <Textarea value={out} onChange={(e) => setOut(e.target.value)} className="min-h-56 font-mono text-[12px]" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-3">{src === "claude" ? "Claude による下書き" : "テンプレート下書き"}・送信/確定は人間が判断</span>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => navigator.clipboard.writeText(out).then(() => toast("コピーしました"))}>
                  <Copy size={13} />
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    run(
                      (tx) =>
                        log(tx, "ai", `AI下書き（${AI_TASKS.find((t) => t.key === task)?.label}）：${out.slice(0, 280)}${out.length > 280 ? "…" : ""}`, {
                          deal_id: dealId,
                          entity_type: context.kind === "global" ? "system" : context.kind,
                          entity_id: context.kind === "buyer" ? context.buyer.id : context.kind === "product" ? context.product.id : dealId,
                        }),
                      { ok: "Activity に保存しました" },
                    )
                  }
                >
                  <Save size={13} /> 保存
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
