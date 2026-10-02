"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon, BarChart3, Building2, CheckSquare, ChevronsUpDown, Contact as ContactIcon, ExternalLink, Handshake, KanbanSquare, LogOut,
  Menu, Moon, Plus, Search, Settings, Sun, X, BookOpen, Plane, Calculator, GitBranch, Landmark, LifeBuoy, Mail, Megaphone, Network, Package, Paperclip, Radar, Receipt, ScanSearch, ShieldCheck,
} from "lucide-react";
import { SERVER } from "@/lib/mode";
import { clearNotice, getSnapshot, initStore, logout, openQuickLog, switchUser, toggleTheme, useMe, useStore } from "@/lib/store";
import { Avatar, ROLE_LABEL } from "./ui";
import { LoginScreen } from "./LoginScreen";
import { QuickLog } from "./QuickLog";
import { IdleGuard } from "./IdleGuard";
import { flag } from "@/lib/constants";
import { dashboardStats, permsFor } from "@/lib/selectors";
import { AITREK_OS_URL, PORTAL_URL, asset } from "@/lib/asset";
import { SALES_DEPT } from "@/lib/roster";

/** 表示中の顧客／案件を「活動を記録」の初期値にする（画面に応じて入力を減らす） */
function contextPreset() {
  const id = new URLSearchParams(window.location.search).get("id");
  const data = getSnapshot().data;
  if (!id || !data) return {};
  if (window.location.pathname.includes("/customers/view")) return { orgId: id };
  const deal = window.location.pathname.includes("/deals/view") ? data.deals.find((x) => x.id === id) : undefined;
  return deal ? { orgId: deal.orgId, dealId: deal.id, contactId: deal.contactId ?? undefined } : {};
}

const NAV: { href: string; label: string; icon: typeof BarChart3; group: string; only?: "manager" | "salesBoard" }[] = [
  { href: "/", label: "ダッシュボード", icon: BarChart3, group: "ホーム" },
  { href: "/tasks/", label: "Task / Next Action", icon: CheckSquare, group: "ホーム" },
  { href: "/pipeline/", label: "パイプライン", icon: KanbanSquare, group: "営業" },
  { href: "/deals/", label: "案件", icon: Handshake, group: "営業" },
  { href: "/customers/", label: "顧客", icon: Building2, group: "営業" },
  { href: "/contacts/", label: "担当者", icon: ContactIcon, group: "営業" },
  { href: "/activities/", label: "活動履歴", icon: ActivityIcon, group: "営業" },
  { href: "/credit/", label: "与信管理", icon: ShieldCheck, group: "与信・リスク" },
  { href: "/screening/", label: "制裁リスト照会", icon: ScanSearch, group: "与信・リスク" },
  { href: "/schemes/", label: "海外事業スキーム集", icon: Network, group: "与信・リスク" },
  { href: "/intel/", label: "公的情報（自動更新）", icon: Radar, group: "与信・リスク" },
  { href: "/calculator/", label: "見積・粗利の計算", icon: Calculator, group: "営業ツール" },
  { href: "/decision/", label: "契約可否の判定", icon: GitBranch, group: "営業ツール" },
  { href: "/fx/", label: "為替・為替予約", icon: Landmark, group: "営業ツール" },
  { href: "/catalog/", label: "商品マスタ", icon: Package, group: "営業ツール" },
  { href: "/library/", label: "資料ライブラリ", icon: Paperclip, group: "営業ツール" },
  { href: "/mail/", label: "メール配信", icon: Mail, group: "営業ツール" },
  { href: "/board/", label: "営業部のお知らせ", icon: Megaphone, group: "情報", only: "salesBoard" },
  { href: "/help/", label: "困った時は（逆引き）", icon: LifeBuoy, group: "情報" },
  { href: "/accounting/", label: "売上と仕訳", icon: Receipt, group: "管理", only: "manager" },
  { href: "/settings/", label: "設定・名簿・監査ログ", icon: Settings, group: "管理" },
  { href: "/manual/", label: "マニュアル", icon: BookOpen, group: "管理" },
];
/** 営業部のお知らせは、従業員名簿で営業部の人と Manager 以上だけが見られる */
export const canSeeBoard = (me: { dept: string; role: string } | null) => !!me && (me.dept === SALES_DEPT || me.role !== "sales");

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const me = useMe();
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const path = usePathname();
  const mobileNav = navOpenAt === path; // ページ遷移で自動的に閉じる
  const setMobileNav = (v: boolean) => setNavOpenAt(v ? path : null);

  useEffect(() => { initStore(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) { e.preventDefault(); openQuickLog(contextPreset()); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const overdue = useMemo(() => (s.data && me ? dashboardStats(s.data, me.role === "sales" ? me.id : null).overdue.length : 0), [s.data, me]);

  if (SERVER ? !s.ready : !s.data) return <div className="grid min-h-screen place-items-center text-sm text-ink-3"><span className="anim-fade">読み込み中…</span></div>;
  if (!me || (SERVER && s.mustChange)) return <LoginScreen />;

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));
  const groups = ["ホーム", "営業", "与信・リスク", "営業ツール", "情報", "管理"];
  const perms = permsFor(me);
  const visibleNav = NAV.filter((n) => (n.only === "manager" ? perms.isManager : n.only === "salesBoard" ? canSeeBoard(me) : true));

  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--side)] text-[var(--side-ink)]">
      <div className="flex h-16 items-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/brand/logo-horizontal-night.png")} alt="H-LINK" className="h-9 w-auto" />
        <span className="ml-2 self-end pb-2.5 text-[10.5px] font-semibold tracking-[.14em] text-[var(--side-ink-2)]">CRM</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 pt-1">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold tracking-[.12em] text-[var(--side-ink-2)]">{g}</div>
            {visibleNav.filter((n) => n.group === g).map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={`mb-0.5 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${active(n.href) ? "bg-[var(--side-active)] text-white" : "hover:bg-[var(--side-hover)] hover:text-white"}`}>
                <n.icon size={16} strokeWidth={1.9} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/tasks/" && overdue > 0 && <span className="rounded-full bg-[#c0362c] px-1.5 text-[10.5px] font-bold text-white num">{overdue}</span>}
              </Link>
            ))}
          </div>
        ))}
        <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold tracking-[.12em] text-[var(--side-ink-2)]">社内リンク</div>
        {[
          { href: PORTAL_URL, label: "H-LINK 社内ポータル", icon: Building2 },
          { href: AITREK_OS_URL, label: "AITREK OS（輸出管理）", icon: Plane },
        ].map((l) => (
          <a key={l.label} href={l.href} className="mb-0.5 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium hover:bg-[var(--side-hover)] hover:text-white">
            <l.icon size={16} strokeWidth={1.9} /><span className="flex-1">{l.label}</span><ExternalLink size={12} className="opacity-50" />
          </a>
        ))}
      </nav>
      <UserMenu />
    </div>
  );

  return (
    <div className="min-h-screen">
      {SERVER && s.syncError && <div role="status" className="fixed inset-x-0 top-0 z-[90] bg-warn px-3 py-1.5 text-center text-xs font-semibold text-white no-print">{s.syncError}</div>}
      {SERVER && s.notice && <div role="status" className="fixed inset-x-0 top-0 z-[89] flex items-center justify-center gap-3 bg-ink px-3 py-1.5 text-xs text-white no-print">{s.notice}<button className="underline" onClick={clearNotice}>閉じる</button></div>}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:block no-print">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div className="anim-fade absolute inset-0 bg-black/45" onClick={() => setMobileNav(false)} />
          <aside className="anim-slide absolute inset-y-0 left-0 w-[260px]">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 backdrop-blur lg:px-8 no-print">
          <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setMobileNav(true)} aria-label="メニュー"><Menu size={18} /></button>
          <button onClick={() => setPalette(true)} className="flex h-8 w-full max-w-md items-center gap-2 rounded-lg bg-surface px-3 text-left text-[13px] text-ink-3 shadow-[0_0_0_1px_var(--line-strong)] hover:text-ink-2">
            <Search size={14} /><span className="flex-1 truncate">顧客・担当者・案件を検索</span><span className="kbd hidden sm:inline">⌘K</span>
          </button>
          <div className="flex-1" />
          <button className="btn btn-primary" onClick={() => openQuickLog(contextPreset())} title="活動を記録（N）"><Plus size={15} /><span className="hidden sm:inline">活動を記録</span></button>
          <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("ログアウトしますか？")) logout(); }} aria-label="ログアウト" title="ログアウト"><LogOut size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="テーマ切替">{s.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
      <QuickLog />
      <IdleGuard />
      {palette && <Palette onClose={() => setPalette(false)} />}
    </div>
  );
}

function UserMenu() {
  const s = useStore();
  const me = useMe()!;
  const [open, setOpen] = useState(false);
  return (
    <div className="relative border-t border-white/10 p-2.5">
      {open && (
        <div className="anim-rise absolute bottom-[58px] left-2.5 right-2.5 rounded-xl bg-[#1b1e26] p-1.5 shadow-[var(--shadow-pop)]">
          {!SERVER && <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] text-[var(--side-ink-2)]">ユーザー切替（デモ：権限の違いを確認）</div>}
          {!SERVER && s.data!.users.map((u) => (
            <button key={u.id} onClick={() => { switchUser(u.id); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/10 ${u.id === me.id ? "text-white" : ""}`}>
              <Avatar user={u} size={20} /><span className="flex-1 truncate">{u.name}</span><span className="text-[10.5px] text-[var(--side-ink-2)]">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
          <button onClick={() => logout()} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-2.5 py-2 text-left text-[12.5px] hover:bg-white/10"><LogOut size={14} />ログアウト</button>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/10">
        <Avatar user={me} size={28} />
        <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-semibold text-white">{me.name}</div><div className="text-[10.5px] text-[var(--side-ink-2)]">{ROLE_LABEL[me.role]}</div></div>
        <ChevronsUpDown size={14} className="opacity-60" />
      </button>
    </div>
  );
}

type Hit = { key: string; group: string; label: string; sub: string; href?: string; run?: () => void };
function Palette({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const hits = useMemo<Hit[]>(() => {
    const d = s.data!;
    const n = q.trim().toLowerCase();
    const actions: Hit[] = [
      { key: "a-log", group: "操作", label: "活動を記録", sub: "電話・訪問・Email などを素早く記録", run: () => openQuickLog() },
      { key: "a-pipe", group: "移動", label: "パイプラインを開く", sub: "", href: "/pipeline/" },
      { key: "a-task", group: "移動", label: "Task / Next Action", sub: "", href: "/tasks/" },
      { key: "a-deals", group: "移動", label: "案件一覧", sub: "", href: "/deals/" },
      { key: "a-orgs", group: "移動", label: "顧客一覧", sub: "", href: "/customers/" },
      { key: "a-calc", group: "移動", label: "見積・粗利の自動計算", sub: "", href: "/calculator/" },
      { key: "a-flow", group: "移動", label: "契約可否の判定フロー", sub: "", href: "/decision/" },
      { key: "a-fx", group: "移動", label: "為替レート・為替予約", sub: "", href: "/fx/" },
      { key: "a-cat", group: "移動", label: "商品マスタ", sub: "", href: "/catalog/" },
      { key: "a-lib", group: "移動", label: "資料ライブラリ（マイソク・カタログ・チラシ）", sub: "", href: "/library/" },
      { key: "a-credit", group: "移動", label: "与信管理", sub: "取引先の格付け・限度額・決済条件", href: "/credit/" },
      { key: "a-scr", group: "移動", label: "制裁リスト照会", sub: "", href: "/screening/" },
      { key: "a-sch", group: "移動", label: "海外事業スキーム集", sub: "", href: "/schemes/" },
      { key: "a-intel", group: "移動", label: "公的情報（自動更新）", sub: "", href: "/intel/" },
      { key: "a-mail", group: "移動", label: "メール配信", sub: "", href: "/mail/" },
      { key: "a-help", group: "移動", label: "困った時は（逆引き辞典）", sub: "", href: "/help/" },
    ];
    if (!n) return actions;
    const orgs: Hit[] = d.organizations.filter((o) => o.name.toLowerCase().includes(n) || o.country.includes(n) || o.city.toLowerCase().includes(n)).slice(0, 5)
      .map((o) => ({ key: o.id, group: "顧客", label: o.name, sub: `${flag(o.country)} ${o.country}・${o.city}`, href: `/customers/view/?id=${o.id}` }));
    const cons: Hit[] = d.contacts.filter((c) => c.name.toLowerCase().includes(n) || c.email.toLowerCase().includes(n)).slice(0, 5)
      .map((c) => ({ key: c.id, group: "担当者", label: c.name, sub: `${d.organizations.find((o) => o.id === c.orgId)?.name}・${c.title}`, href: `/customers/view/?id=${c.orgId}` }));
    const deals: Hit[] = d.deals.filter((x) => x.name.toLowerCase().includes(n)).slice(0, 6)
      .map((x) => ({ key: x.id, group: "案件", label: x.name, sub: d.organizations.find((o) => o.id === x.orgId)?.name ?? "", href: `/deals/view/?id=${x.id}` }));
    return [...orgs, ...deals, ...cons, ...actions.filter((a) => a.label.toLowerCase().includes(n))];
  }, [q, s.data]);

  const go = (h: Hit) => { onClose(); if (h.run) h.run(); else if (h.href) router.push(h.href); };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh] no-print" role="dialog" aria-modal="true" aria-label="検索">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-rise relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-ink-3" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="顧客・案件・担当者名で検索（Esc で閉じる）"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && hits[idx]) go(hits[idx]);
            }} />
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="閉じる"><X size={14} /></button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-ink-3">「{q}」に一致するものはありません</li>}
          {hits.map((h, i) => (
            <li key={h.key + h.group}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === idx ? "bg-surface-2" : ""}`}>
                <span className="w-12 shrink-0 text-[10.5px] font-semibold text-ink-3">{h.group}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{h.label}</span>{h.sub && <span className="block truncate text-[11.5px] text-ink-3">{h.sub}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
