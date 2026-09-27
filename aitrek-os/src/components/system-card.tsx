"use client";

import Link from "next/link";
import { useState } from "react";
import { Bug, ExternalLink } from "lucide-react";
import { buildReport, readBugLog, submitReport } from "@/lib/bug-report";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { fmtDateTime } from "@/lib/format";
import { getSupabase } from "@/lib/store/supabase";
import { useStore } from "@/lib/store/store";
import { Badge, Button, Card, Textarea } from "./ui";

const REPO = "https://github.com/sukesuke1024-lgtm/Trading-overseas";

/** システム更新の状態と、不具合報告 */
export function SystemCard() {
  const { toast } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(() => (typeof window === "undefined" ? [] : readBugLog()));

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
    const r = await submitReport(buildReport("manual", new Error("利用者からの報告"), text.trim()), token);
    setBusy(false);
    setLog(readBugLog());
    if (r.ok) {
      setText("");
      toast("不具合を報告しました。修正案は夜間に作成され、承認後に反映されます");
    } else toast(r.reason === "offline" ? "通信できないため、この端末に記録しました" : `この端末に記録しました（${r.reason}）`, "error");
  }

  return (
    <Card title="システム更新・不具合報告">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="text-ink-3">現在のバージョン</span>
            <span className="font-semibold">v{APP_VERSION}</span>
            <span className="text-[12px] text-ink-3">（{CHANGELOG[0].date}）</span>
            <Link href="/history" className="text-[12px] text-accent-2 hover:underline">
              更新履歴
            </Link>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-ink-2">
            <li>不具合は自動で検知・記録されます（取引データ・個人情報は匿名化）</li>
            <li>毎晩 1:00 頃に Claude が不具合を調査し、修正案（PR）を作成します。本番には反映しません</li>
            <li>
              あなたが修正案を確認し、GitHub で <Badge tone="green">approved</Badge> ラベルを付けたものだけが対象になります
            </li>
            <li>毎晩 2:00（日本時間）に、承認済み・テスト合格の修正だけを本番へ反映します</li>
            <li>アプリは次回起動時、または「更新」ボタンで新しいバージョンに切り替わります</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={`${REPO}/pulls?q=is%3Apr+is%3Aopen+label%3Afix-proposal`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-accent-2 hover:underline">
              承認待ちの修正案 <ExternalLink size={12} />
            </a>
            <a href={`${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Abug`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-accent-2 hover:underline">
              未解決の不具合 <ExternalLink size={12} />
            </a>
            <a href={`${REPO}/actions/workflows/nightly-release.yml`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-accent-2 hover:underline">
              夜間更新の実行記録 <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div id="bugs" className="flex flex-col gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="どの画面で・何をしたら・どうなったか" className="min-h-24" />
          <p className="text-[11.5px] text-ink-3">報告は公開リポジトリの Issue になります。顧客名・金額などの取引情報は書かないでください。</p>
          <Button onClick={send} disabled={busy || !text.trim()} className="self-start">
            <Bug size={14} /> {busy ? "送信中…" : "不具合を報告"}
          </Button>
          {log.length > 0 && (
            <details className="mt-1 text-[12px]">
              <summary className="cursor-pointer text-ink-2">この端末の不具合ログ（{log.length}）</summary>
              <ul className="mt-1 max-h-48 divide-y divide-line overflow-y-auto">
                {log.map((l, i) => (
                  <li key={i} className="py-1">
                    <span className={l.sent ? "text-good" : "text-warn"}>{l.sent ? "報告済" : "未送信"}</span>
                    <span className="ml-2 text-ink-3">{fmtDateTime(l.at)}</span>
                    <div className="truncate text-ink-2">{l.description ?? l.message}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}
