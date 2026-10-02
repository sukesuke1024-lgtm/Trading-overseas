"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, ChevronRight, Home, Lock, LogOut, ShieldAlert } from "lucide-react";
import { stepUp, useStepUp } from "@/lib/stepup";
import { PinInput } from "./Login";

// ---------- 画面の「住所」（戻る・進む・パンくず） ----------
type Crumb = { group?: string; label: string };
const WF_TYPES: Record<string, string> = { 経費精算: "経費精算", 稟議: "決裁・稟議書" };

function QueryCrumb({ base }: { base: string }) {
  const sp = useSearchParams();
  const type = sp.get("type"), isNew = sp.has("new");
  const extra = sp.get("id") ? "詳細" : isNew ? (sp.get("new") ? `${sp.get("new")}の申請` : "新規申請") : null;
  const typeLabel = base === "/workflow" && type ? WF_TYPES[type] ?? type : null;
  return <>{typeLabel && <><ChevronRight size={13} className="shrink-0 text-ink-3" aria-hidden /><span className="truncate">{typeLabel}</span></>}{extra && <><ChevronRight size={13} className="shrink-0 text-ink-3" aria-hidden /><span className="truncate text-ink">{extra}</span></>}</>;
}

export function NavBar({ table }: { table: Record<string, Crumb> }) {
  const router = useRouter();
  const path = usePathname();
  const base = "/" + (path.split("/").filter(Boolean)[0] ?? "");
  const cur = table[base];
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.altKey && e.key === "ArrowLeft") router.back(); if (e.altKey && e.key === "ArrowRight") router.forward(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);
  return (
    <nav aria-label="現在のページ" className="print:hidden mb-4 flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <button className="btn !h-8 !w-8 !p-0" aria-label="戻る" title="戻る（Alt+←）" onClick={() => router.back()}><ArrowLeft size={14} /></button>
      <button className="btn !h-8 !w-8 !p-0" aria-label="進む" title="進む（Alt+→）" onClick={() => router.forward()}><ArrowRight size={14} /></button>
      <ol className="ml-1 flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">
        <li className="shrink-0"><Link href="/" aria-label="ホーム" className="flex items-center text-ink-3 hover:text-ink"><Home size={13} /></Link></li>
        {cur && base !== "/" && <>
          {cur.group && <li className="flex shrink-0 items-center gap-1"><ChevronRight size={13} className="text-ink-3" aria-hidden /><span className="text-ink-3">{cur.group}</span></li>}
          <li className="flex min-w-0 items-center gap-1"><ChevronRight size={13} className="shrink-0 text-ink-3" aria-hidden /><Link href={base} className="truncate font-semibold text-ink hover:underline" aria-current="page">{cur.label}</Link>
            <Suspense fallback={null}><QueryCrumb base={base} /></Suspense></li></>}
        {base === "/" && <li className="flex items-center gap-1"><ChevronRight size={13} className="text-ink-3" aria-hidden /><span className="font-semibold text-ink">ホーム</span></li>}
      </ol>
    </nav>
  );
}

// ---------- ログアウトの二重確認 ----------
export function LogoutDialog({ onClose, onLogout }: { onClose: () => void; onLogout: (all: boolean) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [all, setAll] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, [step]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-label="ログアウトの確認" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card w-full max-w-sm space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-lg font-bold"><LogOut size={18} aria-hidden />ログアウト<span className="ml-auto text-[12px] font-normal text-ink-3">確認 {step} / 2</span></div>
        {step === 1 ? (
          <>
            <p className="text-[13.5px] leading-6">ログアウトしますか？<br /><span className="text-ink-2">入力中の内容は、保存されていないと失われます。</span></p>
            <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>キャンセル</button><button ref={ref} className="btn btn-primary" onClick={() => setStep(2)}>次へ</button></div>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn"><ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />もう一度の確認です。ログアウトの範囲を選んでください。</p>
            <fieldset className="space-y-2 text-[13.5px]"><legend className="sr-only">ログアウトの範囲</legend>
              <label className="flex items-start gap-2 rounded-lg border border-line-strong p-3"><input type="radio" name="lo" checked={!all} onChange={() => setAll(false)} className="mt-1" /><span><b>この端末だけ</b><span className="block text-[12px] text-ink-3">他のPC・スマホのログインはそのままです。</span></span></label>
              <label className="flex items-start gap-2 rounded-lg border border-line-strong p-3"><input type="radio" name="lo" checked={all} onChange={() => setAll(true)} className="mt-1" /><span><b>すべての端末からログアウト</b><span className="block text-[12px] text-ink-3">紛失・共有PCで使った場合などに選んでください。</span></span></label>
            </fieldset>
            <div className="flex justify-between gap-2"><button className="btn" onClick={() => setStep(1)}>戻る</button><button ref={ref} className="btn btn-primary" onClick={() => onLogout(all)}>ログアウトする</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- 役員・部長限定ページのPIN再入力 ----------
export function StepUpGate({ userId, label, children }: { userId: string; label: string; children: ReactNode }) {
  const ok = useStepUp();
  const [pin, setPin] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  if (ok) return <>{children}</>;
  return (
    <div className="mx-auto mt-6 max-w-sm">
      <form className="card space-y-4 p-6" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); const r = await stepUp(userId, pin); setBusy(false); if (r) { setErr(r); setPin(""); } }}>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Lock size={18} aria-hidden />PINの再入力</h1>
        <p className="text-[13px] leading-6 text-ink-2">「{label}」は、役員・部長など限られた人だけが開けるページです。本人確認のため、ログインPINをもう一度入力してください（15分間有効）。</p>
        <PinInput id="su" value={pin} onChange={setPin} autoFocus label="PIN" />
        {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
        <button className="btn btn-primary w-full !h-11" disabled={busy || pin.length < 4}>{busy ? "確認中…" : "開く"}</button>
      </form>
    </div>
  );
}
export const pathNeedsPin = (path: string) => /^\/(accounting|journal|audit|ipo|employees|excel|admin|security|payslips|archive|accounts)(\/|$)/.test(path);
export const pinLabel = (path: string) => ({ accounting: "決算書・販管費", journal: "仕訳帳", audit: "監査・税務調査出力", ipo: "上場準備", employees: "従業員・権限", excel: "Excel連携", admin: "監査ログ", security: "セキュリティ", payslips: "給与明細・源泉徴収票", archive: "履歴アーカイブ" } as Record<string, string>)[path.split("/")[1]] ?? "このページ";

// ---------- 通知（ベル）：対応が必要なものを一か所に ----------
export type Notice = { href: string; label: string; count: number; tone?: "bad" | "warn" };
export function NotifyBell({ items }: { items: Notice[] }) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, i) => s + i.count, 0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2" aria-label={`通知 ${total}件`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={17} />{total > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-bad px-1 text-center text-[10px] font-bold leading-4 text-white tabular">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 top-11 z-40 w-72 p-2 shadow-xl" role="menu" aria-label="通知">
          {items.filter((i) => i.count > 0).length === 0 ? <p className="px-3 py-6 text-center text-[13px] text-ink-3">対応が必要な通知はありません</p> : items.filter((i) => i.count > 0).map((i) => (
            <Link key={i.href + i.label} href={i.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] hover:bg-surface-2"><span className="flex-1">{i.label}</span><span className={`rounded-full px-2 text-[11.5px] font-bold tabular ${i.tone === "bad" ? "bg-bad-soft text-bad" : i.tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2"}`}>{i.count}</span></Link>
          ))}
        </div>
      )}
    </div>
  );
}
