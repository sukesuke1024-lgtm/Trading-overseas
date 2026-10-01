"use client";

import { useEffect, useState } from "react";
import { Eye, KeyRound, Moon, Monitor, Settings as Gear, Sun, SunMoon, X } from "lucide-react";
import { BLUE_LABEL, setPrefs, usePrefs, applyPrefs, type Theme } from "@/lib/prefs";
import { COMPANY } from "@/lib/data";
import { BASE, STATIC } from "@/lib/auth";

/** ブルーライトカットのフィルター（常に画面の最前面・クリックは通す）と、時刻による自動切替 */
export function PrefsApplier() {
  const p = usePrefs();
  useEffect(() => {
    applyPrefs(p);
    const t = setInterval(() => applyPrefs(p), 60_000); // 夜間の自動切替のため1分ごとに再判定
    return () => clearInterval(t);
  }, [p]);
  return <div className="bluelight" aria-hidden />;
}

const THEMES: { id: Theme; label: string; desc: string; icon: typeof Sun }[] = [
  { id: "light", label: "ライト", desc: "明るい表示", icon: Sun },
  { id: "dark", label: "ナイト", desc: "暗い表示（目に優しい）", icon: Moon },
  { id: "auto", label: "端末に合わせる", desc: "OSの設定に従う", icon: Monitor },
  { id: "night", label: "夜間のみナイト", desc: "19時〜翌6時は自動でナイト", icon: SunMoon },
];

export function SettingsDialog({ onClose, onPin }: { onClose: () => void; onPin?: () => void }) {
  const p = usePrefs();
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="設定" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Gear size={18} aria-hidden />設定</h2><button className="btn !h-8 !w-8 !p-0" aria-label="閉じる" onClick={onClose}><X size={15} /></button></div>

        <section aria-label="表示モード">
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold"><Moon size={14} aria-hidden />ナイトモード（目の保護）</h3>
          <div className="grid gap-2 sm:grid-cols-2">{THEMES.map(({ id, label, desc, icon: I }) => (
            <button key={id} aria-pressed={p.theme === id} onClick={() => setPrefs({ theme: id })} className={`flex items-start gap-2 rounded-lg border p-3 text-left ${p.theme === id ? "border-brand bg-brand-soft" : "border-line-strong"}`}><I size={16} className="mt-0.5 shrink-0" aria-hidden /><span><span className="block text-[13px] font-semibold">{label}</span><span className="text-[11.5px] text-ink-3">{desc}</span></span></button>
          ))}</div>
        </section>

        <section aria-label="ブルーライトカット">
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold"><Eye size={14} aria-hidden />ブルーライトカット</h3>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2 p-1 text-[13px]" role="radiogroup" aria-label="強さ">
            {BLUE_LABEL.map((l, i) => <button key={l} role="radio" aria-checked={p.blue === i} onClick={() => setPrefs({ blue: i as 0 | 1 | 2 | 3 })} className={`rounded-md py-1.5 ${p.blue === i ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>{l}</button>)}
          </div>
          <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={p.blueAuto} onChange={(e) => setPrefs({ blueAuto: e.target.checked })} />夜間（19時〜翌6時）だけ有効にする</label>
          <p className="mt-1 text-[11.5px] text-ink-3">画面を少し暖色にして、青い光を和らげます（印刷には影響しません）。</p>
        </section>

        <section aria-label="文字サイズ">
          <h3 className="mb-2 text-[13px] font-bold">文字の大きさ</h3>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-[13px]">
            {([["normal", "標準"], ["large", "大きめ"]] as const).map(([k, l]) => <button key={k} aria-pressed={p.text === k} onClick={() => setPrefs({ text: k })} className={`rounded-md py-1.5 ${p.text === k ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>{l}</button>)}
          </div>
        </section>

        {onPin && <section aria-label="アカウント"><h3 className="mb-2 text-[13px] font-bold">アカウント</h3><button className="btn" onClick={() => { onClose(); onPin(); }}><KeyRound size={14} />PINを変更する</button></section>}
        <p className="border-t border-line pt-3 text-[11.5px] text-ink-3">この設定はこの端末のブラウザに保存されます。{COMPANY.version}{STATIC ? "（デモ）" : ""}{BASE ? "" : ""}</p>
      </div>
    </div>
  );
}

/** ログイン画面などで使う設定ボタン */
export function SettingsButton({ onPin, className = "" }: { onPin?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn !h-9 !w-9 !p-0 ${className}`} aria-label="設定" title="設定（ナイトモード・ブルーライトカット）" onClick={() => setOpen(true)}><Gear size={16} /></button>
      {open && <SettingsDialog onClose={() => setOpen(false)} onPin={onPin} />}
    </>
  );
}
