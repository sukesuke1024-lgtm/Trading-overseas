"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Home, Megaphone, FileCheck2, Clock, Users, Library, DoorOpen, LifeBuoy, GraduationCap,
  Search, Bell, Menu, X, ShieldCheck, CornerDownLeft,
} from "lucide-react";
import { COMPANY, DOCS, EMPLOYEES, FAQ, ROLE_LABEL, empById, type Role } from "@/lib/data";
import { StoreProvider, useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/news", label: "お知らせ", icon: Megaphone },
  { href: "/workflow", label: "ワークフロー", icon: FileCheck2 },
  { href: "/attendance", label: "勤怠", icon: Clock },
  { href: "/directory", label: "社員名簿・組織図", icon: Users },
  { href: "/documents", label: "文書ライブラリ", icon: Library },
  { href: "/rooms", label: "会議室予約", icon: DoorOpen },
  { href: "/helpdesk", label: "ヘルプデスク", icon: LifeBuoy },
  { href: "/training", label: "研修・eラーニング", icon: GraduationCap },
  { href: "/admin", label: "管理・監査ログ", icon: ShieldCheck },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { s, d, meId } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(false);
  const me = empById(meId)!;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQ(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pending = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((st) => st.state === "承認待ち")?.approverId === meId).length;
  const unread = s.news.filter((n) => !s.read.includes(n.id)).length;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">本文へスキップ</a>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[236px] overflow-y-auto bg-side text-side-text transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} aria-label="メインメニュー">
        <div className="px-5 pb-4 pt-5">
          <div className="text-[15px] font-bold text-white">{COMPANY.short} ポータル</div>
          <div className="mt-0.5 text-[11px] text-side-text/70">{COMPANY.name}<br />{COMPANY.market}上場（{COMPANY.code}）</div>
        </div>
        <nav className="px-2 pb-6">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            const badge = href === "/workflow" ? pending : href === "/news" ? unread : 0;
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${active ? "bg-white/12 font-semibold text-white" : "hover:bg-white/8"}`}>
                <Icon size={17} aria-hidden />
                <span className="flex-1">{label}</span>
                {badge > 0 && <span className="rounded-full bg-brand-2 px-1.5 text-[11px] font-bold text-white tabular">{badge}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <button className="btn !h-9 !w-9 !p-0 lg:hidden" aria-label="メニューを開く" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <button onClick={() => setQ(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-bg px-3 text-left text-ink-3 sm:max-w-md">
            <Search size={15} aria-hidden /><span className="flex-1 truncate">社員・文書・お知らせ・FAQを検索</span>
            <kbd className="hidden rounded border border-line-strong bg-white px-1.5 text-[11px] sm:block">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/news" className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2" aria-label={`未読のお知らせ ${unread}件`}>
              <Bell size={17} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bad" />}
            </Link>
            <label className="hidden items-center gap-2 text-[12px] text-ink-3 md:flex">
              表示ロール
              <select className="input !h-8 !w-auto !text-[12px]" value={s.role} onChange={(e) => d({ t: "role", role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-semibold">{me.name}</div>
              <div className="text-[11px] text-ink-3">{me.dept}・{me.title}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[13px] font-bold text-white" aria-hidden>{me.name[0]}</div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1180px] px-4 py-6 lg:px-8">{children}</main>
        <footer className="border-t border-line px-4 py-5 text-[12px] text-ink-3 lg:px-8">
          © {COMPANY.name}　社外秘（Confidential）。無断での転載・社外共有を禁じます。　※デモ環境：データはこのブラウザ内にのみ保存されます。
        </footer>
      </div>
      {q && <Palette onClose={() => setQ(false)} />}
    </div>
  );
}

type Hit = { kind: string; title: string; sub: string; href: string };

function Palette({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const { s } = useStore();
  const all = useMemo<Hit[]>(() => [
    ...EMPLOYEES.map((e) => ({ kind: "社員", title: e.name, sub: `${e.dept} ${e.title}・内線${e.ext}`, href: `/directory?q=${encodeURIComponent(e.name)}` })),
    ...DOCS.map((x) => ({ kind: "文書", title: x.title, sub: `${x.kind}・${x.owner}`, href: `/documents?q=${encodeURIComponent(x.title)}` })),
    ...s.news.map((n) => ({ kind: "お知らせ", title: n.title, sub: `${n.category}・${n.date}`, href: `/news?id=${n.id}` })),
    ...FAQ.map((f) => ({ kind: "FAQ", title: f.q, sub: f.cat, href: `/helpdesk?q=${encodeURIComponent(f.q.slice(0, 8))}` })),
  ], [s.news]);
  const hits = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return all.filter((h) => h.kind === "文書").slice(0, 6);
    return all.filter((h) => `${h.title} ${h.sub}`.toLowerCase().includes(t)).slice(0, 12);
  }, [text, all]);
  useEffect(() => { ref.current?.focus(); }, []);

  const go = (h?: Hit) => { if (h) { window.location.href = h.href; } };
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 px-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal="true" aria-label="全社検索">
      <div className="card mx-auto w-full max-w-xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-ink-3" />
          <input ref={ref} value={text} onChange={(e) => { setText(e.target.value); setI(0); }} placeholder="キーワードを入力（例：出張、山田、セキュリティ）"
            className="h-12 flex-1 bg-transparent outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
              if (e.key === "Enter") go(hits[i]);
            }} />
          <button onClick={onClose} aria-label="閉じる" className="text-ink-3"><X size={16} /></button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.length === 0 && <li className="px-3 py-8 text-center text-ink-3">該当する結果がありません</li>}
          {hits.map((h, idx) => (
            <li key={h.kind + h.title}>
              <button onClick={() => go(h)} onMouseEnter={() => setI(idx)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${idx === i ? "bg-brand-soft" : ""}`}>
                <span className="w-16 shrink-0 text-[11px] font-semibold text-brand">{h.kind}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.title}</span><span className="block truncate text-[12px] text-ink-3">{h.sub}</span></span>
                {idx === i && <CornerDownLeft size={14} className="text-ink-3" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
