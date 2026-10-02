"use client";
import { useEffect, useRef, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { lastActive, loadSecurity, logout, touchActive } from "@/lib/store";

const WARN_SEC = 60;
/** 無操作で自動ログアウト（終了の60秒前に警告）。別のタブで操作していれば、その操作も「操作あり」として数える */
export function IdleGuard() {
  const [left, setLeft] = useState<number | null>(null);
  const cfg = useRef(loadSecurity());
  useEffect(() => {
    cfg.current = loadSecurity();
    let last = 0;
    const mark = () => { const n = Date.now(); if (n - last > 5000) { last = n; touchActive(); } };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    touchActive();
    const id = setInterval(() => {
      cfg.current = loadSecurity();
      const limit = cfg.current.idleMinutes * 60;
      const idle = (Date.now() - lastActive()) / 1000;
      if (idle >= limit) { logout("idle"); return; }
      setLeft(limit - idle <= WARN_SEC ? Math.ceil(limit - idle) : null);
    }, 1000);
    return () => { evs.forEach((e) => window.removeEventListener(e, mark)); clearInterval(id); };
  }, []);
  if (left === null) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4 no-print" role="alertdialog" aria-modal="true" aria-label="自動ログアウトの予告">
      <div className="anim-fade absolute inset-0 bg-black/50" />
      <div className="anim-rise relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-pop)]">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-warn-soft text-warn"><ShieldCheck size={22} /></div>
        <h2 className="text-[16px] font-bold">まもなく自動でログアウトします</h2>
        <p className="mt-1.5 text-[13px] text-ink-2">しばらく操作がありません。<b className="num text-[18px] text-warn"> {left} </b>秒後に、安全のためログアウトします。</p>
        <div className="mt-5 flex gap-2"><button className="btn flex-1" onClick={() => logout()}><LogOut size={14} />今すぐログアウト</button><button className="btn btn-primary flex-1" autoFocus onClick={() => { touchActive(); setLeft(null); }}>続ける</button></div>
      </div>
    </div>
  );
}
