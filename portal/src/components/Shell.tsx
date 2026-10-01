"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Home, Megaphone, FileCheck2, Clock, Users, Search, Bell, Menu, X, ShieldCheck, CornerDownLeft, LogOut, Ellipsis, Cloud, CloudOff,
  Landmark, BookText, FileSearch, Rocket, FileSpreadsheet, KeyRound, CalendarDays, NotebookPen, Target, Receipt, FileSignature, FolderOpen, Network, CalendarCheck2, MonitorUp,
} from "lucide-react";
import { COMPANY, ROLE_LABEL } from "@/lib/data";
import { BASE, STATIC, AuthProvider, useAuth } from "@/lib/auth";
import { can, type RoleName } from "@/lib/perm";
import { StoreProvider, useStore } from "@/lib/store";
import { LoginScreen, PinInput, ResetScreen } from "./Login";
import { PIN_HINT } from "@/lib/pin";
import { Logo } from "./ui";

type NavItem = { href: string; label: string; icon: typeof Home; show?: (r: RoleName) => boolean; group?: string };
const NAV: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/attendance", label: "勤怠", icon: Clock },
  { href: "/workflow", label: "申請・承認", icon: FileCheck2 },
  { href: "/news", label: "お知らせ", icon: Megaphone },
  { href: "/calendar", label: "業務カレンダー", icon: CalendarDays, group: "業務" },
  { href: "/reports", label: "業務日報", icon: NotebookPen, group: "業務" },
  { href: "/kpi", label: "KPI管理", icon: Target, group: "業務" },
  { href: "/workflow?type=経費精算", label: "経費精算", icon: Receipt, group: "業務" },
  { href: "/workflow?type=稟議", label: "決裁・稟議書", icon: FileSignature, group: "業務" },
  { href: "/leave", label: "有給管理", icon: CalendarCheck2, group: "業務" },
  { href: "/docs", label: "文書管理・社内規程", icon: FolderOpen, group: "社内情報" },
  { href: "/directory", label: "従業員名簿・組織図", icon: Network, group: "社内情報" },
  { href: "/remote", label: "リモート接続", icon: MonitorUp, group: "社内情報" },
  { href: "/employees", label: "従業員・権限", icon: Users, show: can.viewEmployees, group: "管理" },
  { href: "/excel", label: "Excel連携・CSV", icon: FileSpreadsheet, show: can.excel, group: "管理" },
  { href: "/accounting", label: "決算書・販管費", icon: Landmark, show: can.viewAccounting, group: "経理・会計" },
  { href: "/journal", label: "仕訳帳", icon: BookText, show: can.viewAccounting, group: "経理・会計" },
  { href: "/audit", label: "監査・税務調査出力", icon: FileSearch, show: can.audit, group: "監査・統制" },
  { href: "/ipo", label: "上場準備", icon: Rocket, show: can.viewAccounting, group: "監査・統制" },
  { href: "/admin", label: "監査ログ", icon: ShieldCheck, show: can.audit, group: "監査・統制" },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}

const IDLE_MS = 30 * 60 * 1000; // 無操作30分で自動ログアウト

function Gate({ children }: { children: ReactNode }) {
  const { user, ready, logout, mustChange } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const signOut = () => logout().then(() => router.replace("/")); // ログアウト後は必ずログイン画面（トップ）へ
  useEffect(() => {
    if (!user) return;
    let t = setTimeout(() => { logout().then(() => router.replace("/")); }, IDLE_MS);
    const reset = () => { clearTimeout(t); t = setTimeout(() => { logout().then(() => router.replace("/")); }, IDLE_MS); };
    const ev = ["pointerdown", "keydown", "visibilitychange"] as const;
    ev.forEach((e) => window.addEventListener(e, reset));
    return () => { clearTimeout(t); ev.forEach((e) => window.removeEventListener(e, reset)); };
  }, [user, logout, router]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
  }, []);

  if (!ready) return <div className="grid min-h-dvh place-items-center text-ink-3">読み込み中…</div>;
  if (!user) return path.startsWith("/reset") ? <ResetScreen /> : <LoginScreen />;
  return (
    <StoreProvider meId={user.id} role={user.role}>
      <Frame onLogout={signOut}>{children}</Frame>
      {mustChange && !STATIC && <PinDialog forced onClose={() => {}} onLogout={signOut} />}
    </StoreProvider>
  );
}

/** PINの変更。forced=初期PINのままのとき（変更するまで他の操作はできない） */
function PinDialog({ forced = false, onClose, onLogout }: { forced?: boolean; onClose: () => void; onLogout: () => void }) {
  const { changePin } = useAuth();
  const [cur, setCur] = useState(""), [next, setNext] = useState(""), [next2, setNext2] = useState("");
  const [err, setErr] = useState(""), [ok, setOk] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="PINの変更" onClick={forced ? undefined : onClose}>
      <form className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        if (next !== next2) { setErr("確認用のPINが一致しません。"); return; }
        const r = await changePin(cur, next);
        if (r) setErr(r); else if (forced) setOk(true); else setOk(true);
      }}>
        <h2 className="text-lg font-bold">{forced ? "PINの設定（必須）" : "PINの変更"}</h2>
        {ok ? <><p className="text-[13px] text-good">PINを変更しました。</p><div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={onClose}>閉じる</button></div></> : <>
          {forced && <p className="text-[13px] text-ink-2">初期PINのままではご利用いただけません。新しいPINを設定してください。</p>}
          <p className="text-[12px] text-ink-3">{PIN_HINT}</p>
          <PinInput id="cp" value={cur} onChange={setCur} label="現在のPIN" />
          <PinInput id="np" value={next} onChange={setNext} autoComplete="new-password" label="新しいPIN" />
          <PinInput id="np2" value={next2} onChange={setNext2} autoComplete="new-password" label="新しいPIN（確認）" />
          {err && <p role="alert" className="text-[13px] text-bad">{err}</p>}
          <div className="flex justify-between">{forced ? <button type="button" className="btn" onClick={onLogout}>ログアウト</button> : <button type="button" className="btn" onClick={onClose}>キャンセル</button>}<button className="btn btn-primary" disabled={cur.length < 4 || next.length < 4}>変更する</button></div>
        </>}
      </form>
    </div>
  );
}

function Frame({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const path = usePathname();
  const { s, meId, role, sync, me } = useStore();
  const [pinOpen, setPinOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setQ(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pending = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((st) => st.state === "承認待ち")?.approverId === meId).length;
  const unread = s.news.filter((n) => !(s.read[meId] ?? []).includes(n.id)).length;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_1fr] print:block">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">本文へスキップ</a>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`print:hidden fixed inset-y-0 left-0 z-40 w-[236px] overflow-y-auto bg-side text-side-text transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} aria-label="メインメニュー">
        <div className="px-5 pb-4 pt-6">
          <Logo variant="horizontal" dark height={46} />
          <div className="mt-2 text-[11px] text-side-text/70">社内ポータル</div>
        </div>
        <nav className="px-2 pb-6">
          {NAV.filter((n) => !n.show || n.show(role)).map(({ href, label, icon: Icon, group }, idx, arr) => {
            const head = group && group !== arr[idx - 1]?.group ? <div key={`g-${group}`} className="mb-1 mt-4 px-3 text-[10.5px] font-semibold tracking-wide text-side-text/60">{group}</div> : null;
            const base = href.split("?")[0], hasQuery = href.includes("?");
            const active = hasQuery ? false : href === "/" ? path === "/" : path.startsWith(base);
            const badge = href === "/workflow" ? pending : href === "/news" ? unread : 0;
            return (
              <div key={href}>{head}
              <Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${active ? "border-l-2 border-brand bg-white/10 font-semibold text-white" : "border-l-2 border-transparent hover:bg-white/8"}`}>
                <Icon size={17} aria-hidden />
                <span className="flex-1">{label}</span>
                {badge > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white tabular">{badge}</span>}
              </Link></div>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 overflow-x-clip">
        <header className="print:hidden sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <button className="btn !h-9 !w-9 !p-0 lg:hidden" aria-label="メニューを開く" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <button onClick={() => setQ(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-bg px-3 text-left text-ink-3 sm:max-w-md">
            <Search size={15} aria-hidden /><span className="flex-1 truncate">従業員・お知らせ・申請を検索</span>
            <kbd className="hidden rounded border border-line-strong bg-white px-1.5 text-[11px] sm:block">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/news" className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2" aria-label={`未読のお知らせ ${unread}件`}>
              <Bell size={17} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bad" />}
            </Link>
            <span className={`hidden items-center gap-1 text-[11.5px] md:flex ${sync === "offline" ? "text-bad" : "text-ink-3"}`} title={sync === "local" ? "この端末内に保存（デモ）" : sync === "offline" ? "サーバーに接続できません" : "サーバーと同期"}>
              {sync === "offline" ? <CloudOff size={14} aria-hidden /> : <Cloud size={14} aria-hidden />}{sync === "local" ? "端末内保存" : sync === "offline" ? "オフライン" : sync === "saving" ? "保存中…" : "同期済み"}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-semibold">{me.name}</div>
              <div className="text-[11px] text-ink-3">{me.job || ROLE_LABEL[role]}・{ROLE_LABEL[role]}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-[13px] font-bold text-white" aria-hidden>{me.name[0]}</div>
            <button className="btn !h-9 !w-9 !p-0" aria-label="PINを変更" title="PINを変更" onClick={() => setPinOpen(true)}><KeyRound size={16} /></button>
            <button className="btn !h-9 !w-9 !p-0" aria-label="ログアウト" title="ログアウト" onClick={onLogout}><LogOut size={16} /></button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1180px] px-4 py-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-8 lg:pb-6">{children}</main>
        <footer className="print:hidden border-t border-line px-4 py-5 text-[12px] text-ink-3 lg:px-8">
          © {COMPANY.name}　社外秘（Confidential）。無断での転載・社外共有を禁じます。　{STATIC ? "※デモ環境：データはこのブラウザ内にのみ保存されます。" : "※データは社内サーバーに保存され、ログイン中の端末間で同期されます。"}
        </footer>
      </div>
      <nav className="print:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="モバイルメニュー">
        {[["/", "ホーム", Home, 0], ["/attendance", "勤怠", Clock, 0], ["/workflow", "申請", FileCheck2, pending], ["/news", "お知らせ", Megaphone, unread]].map(([href, label, Icon, badge]) => {
          const I = Icon as typeof Home; const h = href as string;
          const active = h === "/" ? path === "/" : path.startsWith(h);
          return (
            <Link key={h} href={h} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${active ? "font-bold text-brand-2" : "text-ink-3"}`}>
              <I size={21} aria-hidden />{label as string}
              {(badge as number) > 0 && <span className="absolute right-[26%] top-1 rounded-full bg-bad px-1 text-[9px] font-bold text-white tabular">{badge as number}</span>}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] text-ink-3"><Ellipsis size={21} aria-hidden />メニュー</button>
      </nav>
      {q && <Palette onClose={() => setQ(false)} />}
      {pinOpen && <PinDialog onClose={() => setPinOpen(false)} onLogout={onLogout} />}
    </div>
  );
}

type Hit = { kind: string; title: string; sub: string; href: string };

function Palette({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const { s, role } = useStore();
  const router = useRouter();
  const all = useMemo<Hit[]>(() => [
    ...(can.viewEmployees(role) ? s.employees.map((e) => ({ kind: "従業員", title: e.name, sub: `${e.id}・${e.job}・${ROLE_LABEL[e.role]}`, href: `/employees?q=${encodeURIComponent(e.name)}` })) : []),
    ...s.news.map((n) => ({ kind: "お知らせ", title: n.title, sub: `${n.category}・${n.date}`, href: `/news?id=${n.id}` })),
    ...s.docs.map((x) => ({ kind: "文書", title: x.title, sub: `${x.category}・${x.version}`, href: `/docs?id=${x.id}` })),
    ...s.employees.map((e) => ({ kind: "名簿", title: e.name, sub: `${e.dept ?? ""} ${e.job}`.trim(), href: `/directory` })),
    ...s.workflows.map((w) => ({ kind: "申請", title: w.title, sub: `${w.type}・${w.status}`, href: `/workflow?id=${w.id}` })),
  ], [s.employees, s.news, s.workflows, s.docs, role]);
  const hits = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return all.slice(0, 6);
    return all.filter((h) => `${h.title} ${h.sub}`.toLowerCase().includes(t)).slice(0, 12);
  }, [text, all]);
  useEffect(() => { ref.current?.focus(); }, []);

  const go = (h?: Hit) => { if (h) { router.push(h.href); onClose(); } };
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 px-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal="true" aria-label="全社検索">
      <div className="card mx-auto w-full max-w-xl overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-ink-3" />
          <input ref={ref} value={text} onChange={(e) => { setText(e.target.value); setI(0); }} placeholder="キーワードを入力（例：経費、長尾、勤怠）"
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
              <button onClick={() => go(h)} onMouseEnter={() => setI(idx)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${idx === i ? "bg-surface-2" : ""}`}>
                <span className="w-16 shrink-0 text-[11px] font-semibold text-brand-2">{h.kind}</span>
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
