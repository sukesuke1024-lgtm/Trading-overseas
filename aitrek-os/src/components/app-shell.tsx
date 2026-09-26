"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Factory,
  Globe2,
  Package,
  KanbanSquare,
  Ship,
  FileSpreadsheet,
  FileText,
  Wallet,
  CheckSquare,
  Megaphone,
  Settings,
  Menu,
  Bell,
  X,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store/store";
import { alerts as buildAlerts } from "@/lib/insights";
import { roleLabel } from "@/lib/constants";
import { cx } from "./ui";
import { LoginScreen } from "./login";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/producers", label: "Producers", icon: Factory },
  { href: "/buyers", label: "Buyers", icon: Globe2 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/deals", label: "Deals", icon: KanbanSquare },
  { href: "/export", label: "Export", icon: Ship },
  { href: "/quotations", label: "Quotations", icon: FileSpreadsheet },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, mode, session, me, db, toasts } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const alertList = useMemo(() => buildAlerts(db), [db]);
  const openTasks = db.tasks.filter((t) => t.status !== "done" && t.status !== "na" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length;

  if (mode === "supabase" && ready && !session) return <LoginScreen />;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cx(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.75 text-[13px] transition-colors",
            isActive(href) ? "bg-white/10 font-medium text-white" : "text-[#c9cad1] hover:bg-white/5 hover:text-white",
          )}
        >
          <Icon size={16} strokeWidth={1.8} className={isActive(href) ? "text-white" : "text-[#8a8c96]"} />
          <span className="flex-1">{label}</span>
          {href === "/tasks" && openTasks > 0 && <span className="rounded bg-[#c0362c] px-1.5 text-[10.5px] font-semibold text-white">{openTasks}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (PC) */}
      <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-[var(--sidebar)] py-4 lg:flex">
        <Brand />
        {nav}
        <UserBox />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[var(--sidebar)] py-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} className="text-white/70" aria-label="閉じる">
                <X size={18} />
              </button>
            </div>
            {nav}
            <UserBox />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur lg:px-6">
          <button className="rounded p-1 text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="メニュー">
            <Menu size={18} />
          </button>
          <span className="font-semibold lg:hidden">AITREK OS</span>
          <div className="flex-1" />
          {mode === "local" && <span className="hidden rounded border border-line-strong px-1.5 py-px text-[11px] text-ink-3 sm:inline">Local mode</span>}
          <Link href="/marketing" className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2">
            <Sparkles size={14} className="text-gold" /> AI
          </Link>
          <div className="relative">
            <button onClick={() => setBell((b) => !b)} className="relative rounded-md p-1.5 text-ink-2 hover:bg-surface-2" aria-label="アラート">
              <Bell size={17} />
              {alertList.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-bad px-1 text-[10px] font-semibold leading-4 text-white">{alertList.length}</span>
              )}
            </button>
            {bell && (
              <div className="absolute right-0 top-9 z-50 w-[min(92vw,380px)] rounded-lg border border-line bg-surface shadow-xl" onMouseLeave={() => setBell(false)}>
                <div className="border-b border-line px-3 py-2 text-[12.5px] font-semibold">Alert（{alertList.length}）</div>
                <div className="max-h-96 overflow-y-auto">
                  {alertList.length === 0 && <p className="px-3 py-6 text-center text-ink-3">アラートはありません</p>}
                  {alertList.map((a, i) => (
                    <Link key={i} href={a.href} onClick={() => setBell(false)} className="block border-b border-line px-3 py-2 last:border-0 hover:bg-surface-2">
                      <div className={cx("text-[12.5px] font-medium", a.level === "critical" ? "text-bad" : a.level === "warning" ? "text-warn" : "text-ink")}>{a.title}</div>
                      <div className="truncate text-[11.5px] text-ink-3">{a.detail}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {me && <span className="hidden text-[12.5px] text-ink-2 sm:inline">{me.name}</span>}
        </header>

        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 lg:px-6 lg:py-6">{ready ? children : <Loading />}</main>
      </div>

      <div className="no-print fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx("max-w-sm rounded-md px-3.5 py-2.5 text-[13px] shadow-lg", t.kind === "error" ? "bg-bad text-white" : "bg-[#16161a] text-white")}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="mb-5 flex items-center gap-2 px-5">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#c9a45a] to-[#8a6a2a] text-[12px] font-bold text-white">A</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[14px] font-semibold tracking-wide text-white">AITREK OS</span>
        <span className="text-[10.5px] text-[#8a8c96]">Trade Operating System</span>
      </span>
    </Link>
  );
}

function UserBox() {
  const { me, mode, signOut } = useStore();
  if (!me) return null;
  return (
    <div className="mx-2.5 mt-3 rounded-md border border-white/10 px-3 py-2">
      <div className="truncate text-[12.5px] font-medium text-white">{me.name}</div>
      <div className="flex items-center justify-between text-[11px] text-[#8a8c96]">
        <span>{roleLabel(me.role)}</span>
        {mode === "supabase" ? (
          <button onClick={signOut} className="hover:text-white">
            ログアウト
          </button>
        ) : (
          <Link href="/settings#users" className="hover:text-white">
            切替
          </Link>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center py-32 text-ink-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
    </div>
  );
}
