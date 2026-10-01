"use client";

import { useState } from "react";
import { Archive, Play, Save } from "lucide-react";
import { archiveDue } from "@/lib/archive";
import { runLocalArchive } from "@/lib/archive-client";
import { BASE, STATIC } from "@/lib/auth";
import { DEFAULT_RETENTION, RETENTION_LABEL, type Retention } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { FileTable } from "@/components/Files";

export default function ArchivePage() {
  const { s, d, meId, role, files: vfiles } = useStore();
  const [ret, setRet] = useState<Retention>(s.retention);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  if (!can.admin(role)) return <div className="card p-8 text-center text-ink-2">この画面は管理者のみ利用できます。</div>;
  const today = ymd(new Date());
  const files = vfiles.filter((f) => f.kind === "アーカイブ").sort((a, b) => b.at.localeCompare(a.at));
  const dirty = JSON.stringify(ret) !== JSON.stringify(s.retention);
  const min = { attendance: 36, reports: 1, mails: 1, workflows: 1, audit: 36 } as const;
  const valid = (Object.keys(ret) as (keyof Retention)[]).every((k) => Number.isInteger(ret[k]) && ret[k] >= min[k] && ret[k] <= 240);

  const runNow = async () => {
    setBusy(true); setMsg("");
    try {
      if (STATIC) {
        const { next, recs } = await runLocalArchive(s, today);
        d({ t: "archive-apply", next, recs });
        setMsg(recs.length ? `${recs.length}個のCSVに書き出しました。` : "保存期間を超えた履歴はありません。");
      } else {
        const r = await fetch(`${BASE}/api/archive`, { method: "POST", credentials: "same-origin" });
        setMsg(r.ok ? "実行しました。結果は少しして一覧に反映されます。" : "実行できませんでした。");
      }
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="履歴アーカイブ" sub="保存期間を超えた履歴を、Excelで開けるCSVに自動で書き出し、日々の画面から外します（1日1回の自動実行）。"
        actions={<button className="btn btn-primary" disabled={busy} onClick={runNow}><Play size={15} />{busy ? "実行中…" : "今すぐ実行"}</button>} />
      {msg && <p role="status" className="mb-3 rounded-lg bg-good-soft px-3 py-2 text-[13px] text-good">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="card self-start p-4" aria-label="保存期間">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Archive size={15} aria-hidden />保存期間（月）</h2>
          <div className="space-y-2.5">{(Object.keys(RETENTION_LABEL) as (keyof Retention)[]).map((k) => (
            <div key={k} className="flex items-center gap-2"><label className="flex-1 text-[13px]" htmlFor={`r-${k}`}>{RETENTION_LABEL[k]}</label><input id={`r-${k}`} type="number" min={min[k]} max={240} className="input tabular !h-8 !w-20 text-right" value={ret[k]} onChange={(e) => setRet({ ...ret, [k]: Number(e.target.value) })} /><span className="text-[12px] text-ink-3">か月</span></div>))}</div>
          <div className="mt-3 flex gap-2"><button className="btn btn-primary" disabled={!dirty || !valid} onClick={() => { d({ t: "retention-set", retention: ret, by: meId }); setMsg("保存しました。"); }}><Save size={14} />保存</button><button className="btn" onClick={() => setRet(DEFAULT_RETENTION)}>既定値</button></div>
          <ul className="mt-3 space-y-1 text-[11.5px] leading-5 text-ink-3"><li>勤怠・監査ログは36か月未満にできません（賃金台帳・出勤簿等の法定保存：5年、当分の間3年）。</li><li>監査ログはハッシュ連鎖を守るため、CSVに写すだけで削除しません。</li><li>書き出したCSVは管理者のみ（PIN再入力）でダウンロードできます。</li><li>最終実行：{s.archiveMeta?.at || "（未実行）"}{archiveDue(s, today) ? "（本日分は未実行）" : ""}</li></ul>
        </section>
        <section className="card" aria-label="書き出したCSV"><div className="border-b border-line px-4 py-2.5 font-bold">書き出したCSV（{files.length}件）</div>
          <FileTable files={files} empty="まだ書き出されたCSVはありません。保存期間を超えた履歴ができると、自動で作られます。" /></section>
      </div>
    </div>
  );
}
