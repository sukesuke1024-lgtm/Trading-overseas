"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ActivityType, Currency, Role, StageId, User } from "@/lib/types";
import { stageOf } from "@/lib/constants";
import { dueInfo } from "@/lib/dates";
import { money, yenShort } from "@/lib/format";
import { ACTIVITY_ICON } from "./icons";

export function Avatar({ user, size = 24 }: { user?: User | null; size?: number }) {
  if (!user) return <span className="inline-block rounded-full bg-surface-3" style={{ width: size, height: size }} />;
  return (
    <span title={user.name} className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.44, background: `hsl(${user.hue} 48% 44%)` }}>
      {user.name.replace(/\s+/g, "").slice(0, 1)}
    </span>
  );
}

export function UserCell({ user }: { user?: User | null }) {
  return <span className="inline-flex items-center gap-2"><Avatar user={user} size={20} /><span className="truncate">{user?.name ?? "未割当"}</span></span>;
}

const STAGE_TONE: Record<string, string> = {
  lead: "#8a8c95", contact: "#5b8def", hearing: "#3b82c4", proposal: "#8b6fd6", quotation: "#c47a1c", negotiation: "#d0572f", won: "#17784a", lost: "#c0362c", hold: "#7a7d87",
};
export const stageColor = (id: StageId) => STAGE_TONE[id];
export function StageChip({ stage }: { stage: StageId }) {
  const s = stageOf(stage);
  return (
    <span className="chip" style={{ background: `color-mix(in srgb, ${STAGE_TONE[stage]} 14%, transparent)`, color: STAGE_TONE[stage] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_TONE[stage] }} />{s.label}
    </span>
  );
}

export function DueChip({ due, done }: { due: string | null; done?: boolean }) {
  const i = dueInfo(due);
  if (done) return <span className="chip">完了</span>;
  const cls = i.tone === "overdue" ? "chip-bad" : i.tone === "today" ? "chip-warn" : i.tone === "soon" ? "chip-accent" : "";
  return <span className={`chip num ${cls}`}>{i.label}</span>;
}

export function Money({ amount, currency, jpy, className = "" }: { amount: number; currency: Currency; jpy?: number; className?: string }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {money(amount, currency)}
      {currency !== "JPY" && jpy !== undefined && <span className="ml-1.5 text-[11px] text-ink-3">≈{yenShort(jpy)}</span>}
    </span>
  );
}

export function ActivityIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  const I = ACTIVITY_ICON[type];
  return <I size={size} strokeWidth={1.9} />;
}

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-xs text-ink-3 hover:text-ink">← {back.label}</Link>}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <div className="text-[13px] font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-xs text-ink-3">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

/** 右からスライドインするパネル（活動記録・新規作成など。画面遷移させずに入力できる） */
export function Drawer({ open, onClose, title, children, footer, width = 440 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div ref={ref} className="anim-slide absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-[var(--shadow-pop)]" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="閉じる"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-rise relative w-full max-w-md rounded-2xl bg-surface p-5 shadow-[var(--shadow-pop)]">
        <h2 className="mb-3 text-[15px] font-bold">{title}</h2>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", sales: "Sales" };

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className="tab" onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
