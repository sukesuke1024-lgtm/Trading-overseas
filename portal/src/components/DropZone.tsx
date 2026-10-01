"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ALLOWED_EXT, MAX_FILE_BYTES } from "@/lib/ops";

/**
 * ファイルの添付枠。点線の枠に「ドラッグ＆ドロップ」するか、枠をクリック（タップ）して選びます。
 * 使える形式・サイズの上限も枠の中に表示します。
 */
export function DropZone({ onFiles, multiple = false, busy = false, disabled = false, label, hint, accept, compact = false }: { onFiles: (files: File[]) => void; multiple?: boolean; busy?: boolean; disabled?: boolean; label?: string; hint?: string; accept?: string; compact?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const off = disabled || busy;
  const take = (list: FileList | null) => { const a = Array.from(list ?? []); if (a.length) onFiles(multiple ? a : a.slice(0, 1)); if (ref.current) ref.current.value = ""; };
  return (
    <div>
      <input ref={ref} id={id} type="file" className="sr-only" multiple={multiple} accept={accept} disabled={off} onChange={(e) => take(e.target.files)} />
      <label htmlFor={id}
        onDragOver={(e) => { if (off) return; e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!off) take(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-colors ${compact ? "px-3 py-3" : "px-4 py-6"} ${over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2 hover:border-brand"} ${off ? "pointer-events-none opacity-50" : ""}`}>
        <UploadCloud size={compact ? 20 : 28} className="text-brand" aria-hidden />
        <span className="text-[13.5px] font-bold">{busy ? "アップロード中…" : label ?? (multiple ? "ここにファイルをドラッグ＆ドロップ（複数可）" : "ここにファイルをドラッグ＆ドロップ")}</span>
        <span className="text-[12.5px] text-ink-2">または<span className="mx-1 rounded-md border border-line-strong bg-surface px-2 py-0.5 font-bold text-brand">クリックして選ぶ</span></span>
        <span className="text-[11.5px] text-ink-3">{hint ?? `${ALLOWED_EXT.join("・").toUpperCase()}／1ファイル ${MAX_FILE_BYTES / 1024 / 1024}MBまで`}</span>
      </label>
    </div>
  );
}
