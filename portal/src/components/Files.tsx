"use client";

import { useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { fetchFile, saveBlob, uploadFile } from "@/lib/files";
import { fmtBytes, type FileRec } from "@/lib/ops";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui";
import { StepUpGate } from "@/components/Nav";
import { useStepUp } from "@/lib/stepup";

/** ファイルを1件ダウンロード。PINの再入力が必要なファイルは、その場でPINを聞く */
export function FileDownload({ rec, children }: { rec: FileRec; children?: React.ReactNode }) {
  const { meId } = useStore();
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(false);
  const ok = useStepUp();
  const go = async () => {
    setErr("");
    const r = await fetchFile(rec);
    if ("blob" in r) { saveBlob(r.blob, rec.name); return; }
    if (r.stepup) setAsk(true); else setErr(r.error);
  };
  return (
    <>
      <button className="btn !h-8" onClick={go} aria-label={`${rec.name}をダウンロード`}>{children ?? <><Download size={13} />ダウンロード</>}</button>
      {err && <span role="alert" className="ml-2 text-[12px] text-bad">{err}</span>}
      {ask && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="PINの再入力" onClick={() => setAsk(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <StepUpGate userId={meId} label={rec.name}>
              <div className="card space-y-3 p-5"><p className="text-[13.5px]">PINを確認しました。もう一度ダウンロードしてください。</p><div className="flex justify-end gap-2"><button className="btn" onClick={() => setAsk(false)}>閉じる</button><button className="btn btn-primary" onClick={() => { setAsk(false); void go(); }}>ダウンロード</button></div></div>
            </StepUpGate>
            {ok && null}
          </div>
        </div>
      )}
    </>
  );
}

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** 台帳の一覧（ファイル名・範囲・事業部・登録者・日時）。canDelete が true の行に削除ボタンを出す */
export function FileTable({ files, empty, showTarget = false }: { files: FileRec[]; empty: string; showTarget?: boolean }) {
  const { d, meId, role, emp, nameOf } = useStore();
  if (files.length === 0) return <p className="px-4 py-10 text-center text-ink-3">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead><tr><th className="th">ファイル</th><th className="th">公開範囲</th><th className="th">事業部</th><th className="th">登録者</th><th className="th">日時</th><th className="th text-right">サイズ</th><th className="th"><span className="sr-only">操作</span></th></tr></thead>
        <tbody>{files.map((f) => {
          const up = emp(f.uploadedBy);
          const can = role === "admin" || (f.uploadedBy === meId && f.kind !== "給与明細" && f.kind !== "賞与明細" && f.kind !== "源泉徴収票" && f.kind !== "アーカイブ");
          return (
            <tr key={f.id}>
              <td className="td"><div className="flex items-center gap-2"><FileText size={15} className="shrink-0 text-ink-3" aria-hidden /><div className="min-w-0"><div className="break-all font-medium">{f.name}</div>{f.note && <div className="text-[11.5px] text-ink-3">{f.note}</div>}{showTarget && f.ownerId && <div className="text-[11.5px] text-ink-3">対象：{nameOf(f.ownerId)}{f.period ? `（${f.period}）` : ""}</div>}</div></div></td>
              <td className="td"><Badge tone={f.scope === "全社" ? "gray" : "warn"}>{f.scope}</Badge></td>
              <td className="td">{f.dept ?? "—"}</td>
              <td className="td">{f.uploadedBy === "system" ? "システム" : <>{nameOf(f.uploadedBy)}<span className="ml-1 text-[11.5px] text-ink-3">{up?.job}</span></>}</td>
              <td className="td tabular">{when(f.at)}</td><td className="td tabular text-right">{fmtBytes(f.size)}</td>
              <td className="td"><div className="flex items-center gap-1 whitespace-nowrap"><FileDownload rec={f} />{can && <button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${f.name}を削除`} onClick={() => confirm(`「${f.name}」を削除しますか？`) && d({ t: "file-del", id: f.id, by: meId })}><Trash2 size={13} /></button>}</div></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** ファイル選択→アップロード→台帳登録。meta は登録する台帳の項目（kind・scope など） */
export function UploadButton({ meta, label = "ファイルを選んでアップロード", disabled, onDone }: { meta: Omit<FileRec, "id" | "name" | "size" | "mime" | "uploadedBy" | "at">; label?: string; disabled?: boolean; onDone?: (rec: FileRec) => void }) {
  const { d, meId } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr("");
    const r = await uploadFile(file);
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if ("error" in r) { setErr(r.error); return; }
    const rec: FileRec = { ...meta, id: r.id, name: r.name, size: r.size, mime: r.mime, uploadedBy: meId, at: new Date().toISOString() };
    d({ t: "file-add", rec });
    onDone?.(rec);
  };
  return (
    <div>
      <input ref={ref} type="file" className="sr-only" id={`up-${meta.kind}-${meta.scope}`} disabled={disabled || busy} onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor={`up-${meta.kind}-${meta.scope}`} className={`btn btn-primary cursor-pointer ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}><Upload size={15} />{busy ? "アップロード中…" : label}</label>
      {err && <p role="alert" className="mt-1 text-[12px] text-bad">{err}</p>}
    </div>
  );
}
