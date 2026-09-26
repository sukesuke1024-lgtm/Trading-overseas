"use client";

import Link from "next/link";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8.5 px-3.5 text-[13px]",
        variant === "primary" && "bg-accent text-white hover:bg-[#162b47] shadow-sm",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "border border-bad/30 bg-surface text-bad hover:bg-bad-soft",
        className,
      )}
    />
  );
}

export function LinkButton({ href, children, variant = "secondary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex h-8.5 items-center justify-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium transition-colors whitespace-nowrap",
        variant === "primary" && "bg-accent text-white hover:bg-[#162b47] shadow-sm",
        variant === "secondary" && "border border-line-strong bg-surface hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}

const width = (c?: string) => (/(^|\s)w-/.test(c ?? "") ? "" : "w-full");

const fieldBase =
  "rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent-2 focus:outline-none focus:ring-2 focus:ring-accent-2/15 disabled:bg-surface-2 disabled:text-ink-2";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldBase, width(props.className), "h-8.5", props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(fieldBase, width(props.className), "h-8.5 pr-7", props.className)}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldBase, width(props.className), "min-h-20 py-2 leading-relaxed", props.className)} />;
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(16,16,20,0.04)]", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

const tones = {
  gray: "bg-surface-2 text-ink-2 border-line",
  blue: "bg-accent-soft text-accent border-accent/15",
  green: "bg-good-soft text-good border-good/20",
  amber: "bg-warn-soft text-warn border-warn/20",
  red: "bg-bad-soft text-bad border-bad/20",
  gold: "bg-[#f6efe0] text-gold border-gold/25",
};
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "gray", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11.5px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-3 pt-[6vh] backdrop-blur-[1px] no-print" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("w-full rounded-xl border border-line bg-surface shadow-2xl", wide ? "max-w-4xl" : "max-w-xl")}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="閉じる">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center text-ink-2">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(16,16,20,0.04)]">
      <div className="text-[12px] font-medium text-ink-2">{label}</div>
      <div className={cx("tabular mt-1 text-[22px] font-semibold tracking-tight", tone === "bad" && "text-bad", tone === "warn" && "text-warn", tone === "good" && "text-good")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[13px] [&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[11.5px] [&_th]:font-medium [&_th]:text-ink-2 [&_th]:whitespace-nowrap [&_tbody_tr:hover]:bg-surface-2/50">
        {children}
      </table>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium",
            value === it.key ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent-2" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-ink">{children || <span className="text-ink-3">—</span>}</dd>
    </div>
  );
}
