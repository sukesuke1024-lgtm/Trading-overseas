import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Package, BookOpen, Settings as Cog, RefreshCw, Users as UsersIcon, LogOut, Handshake, Siren, Phone } from 'lucide-react';
import * as C from './lib/core.js';
import type { Shipment } from './lib/core.js';
import { AuthProvider, useAuth, type User } from './lib/auth.tsx';
import { lastBackup, useCollection, useShipments } from './lib/store.ts';
import type { Contact, Deal, Incident } from './lib/domain.ts';
import { seedContacts, seedDeals, seedIncidents } from './lib/seed.ts';
import { refreshAll } from './lib/api.ts';
import { Mark, Wordmark } from './components/Brand.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Shipments } from './pages/Shipments.tsx';
import { Deals } from './pages/Deals.tsx';
import { Incidents } from './pages/Incidents.tsx';
import { Contacts } from './pages/Contacts.tsx';
import { Settings } from './pages/Settings.tsx';
import { Help } from './pages/Help.tsx';
import { Login } from './pages/Login.tsx';
import { Logout } from './pages/Logout.tsx';
import { ForceChange } from './pages/ForceChange.tsx';
import { TotpSetup } from './pages/TotpSetup.tsx';
import { Users } from './pages/Users.tsx';
import { ShipmentForm } from './components/ShipmentForm.tsx';
import { IncidentForm } from './components/IncidentForm.tsx';

type Page = 'dashboard' | 'shipments' | 'deals' | 'incidents' | 'contacts' | 'settings' | 'help' | 'users' | 'logout';
const pages: Page[] = ['dashboard', 'shipments', 'deals', 'incidents', 'contacts', 'settings', 'help', 'users', 'logout'];
const fromHash = (): Page => { const h = location.hash.replace('#/', ''); return (pages as string[]).includes(h) ? (h as Page) : 'dashboard'; };

export function App() {
  return <AuthProvider><Gate /></AuthProvider>;
}

function Gate() {
  const { state, retry } = useAuth();
  const loggedOut = state.status === 'anon' || (state.status === 'local' && !state.loggedIn);
  useEffect(() => { if (loggedOut) location.hash = ''; }, [loggedOut]);
  if (state.status === 'loading') return <div className="center muted" role="status">読み込み中…</div>;
  if (state.status === 'error') return (
    <div className="center"><div className="card" style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ fontSize: 18 }}>サーバーに接続できません</h1>
      <p className="muted">ネットワークまたはサーバーの状態を確認して、もう一度お試しください。</p>
      <button className="btn primary" onClick={retry}>再試行</button>
    </div></div>
  );
  if (state.status === 'anon') return <Login notice={state.notice} />;
  if (state.status === 'local' && !state.loggedIn) return <Login demo notice={state.notice} />;
  if (state.status === 'in' && state.user.mustChange) return <ForceChange name={state.user.name} />;
  if (state.status === 'in' && state.user.needTotp) return <TotpSetup name={state.user.name} />;
  return <Shell server={state.status === 'in'} user={state.status === 'in' ? state.user : null} />;
}

function Shell({ server, user }: { server: boolean; user: User | null }) {
  const [toast, setToast] = useState('');
  const say = useCallback((m: string) => setToast(m), []);
  const { list, upsert, remove, merge, replaceMany } = useShipments(server, say);
  const deals = useCollection<Deal>('deals', 'D', server, say, seedDeals);
  const contacts = useCollection<Contact>('contacts', 'C', server, say, seedContacts);
  const incidents = useCollection<Incident>('incidents', 'I', server, say, seedIncidents);
  const [page, setPage] = useState<Page>(fromHash);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Shipment> | null>(null);
  const [incForm, setIncForm] = useState<Partial<Incident> | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAdmin = !server || user?.role === 'admin';

  useEffect(() => { const f = () => setPage(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t); }, [toast]);
  const go = (p: Page) => { location.hash = `#/${p}`; };
  const effectivePage: Page = page === 'users' && !(server && isAdmin) ? 'dashboard' : page;

  const setTheme = (t: 'light' | 'dark' | 'auto') => {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    try { if (t === 'auto') localStorage.removeItem('hlink-tracker-theme'); else localStorage.setItem('hlink-tracker-theme', t); } catch { /* noop */ }
  };
  useEffect(() => { try { const t = localStorage.getItem('hlink-tracker-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch { /* noop */ } }, []);

  const refresh = useCallback(async (manual: boolean) => {
    if (busy || !server) { if (manual && !server) say('この画面はサーバーに接続していないため、自動更新は使えません。'); return; }
    setBusy(true);
    const r = await refreshAll(list);
    await replaceMany(r.changedList);
    setBusy(false);
    if (manual) say(r.targets > 0 && r.failed === r.targets
      ? '追跡サービスに接続できませんでした。時間をおいてやり直してください。'
      : `更新：${r.changedList.length} 件に変化／失敗 ${r.failed} 件${r.unsupported ? `／自動取得が未設定の手段 ${r.unsupported} 件（手入力のまま）` : ''}`);
  }, [busy, server, list, replaceMany, say]);
  useEffect(() => {
    if (!server) return;
    const t = setInterval(() => { void refresh(false); }, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [server, refresh]);

  const todo = list.filter((s) => C.severity(s) > 0).length;
  const openInc = incidents.list.filter((i) => i.status === 'open');
  const urgent = openInc.filter((i) => i.severity === 'urgent');
  const openShipment = (no: string) => { setSelected(no); go('shipments'); };
  const openDeal = (id: string) => { setSelectedDeal(id); go('deals'); };
  const staleBackup = !server && list.length > 0 && Date.now() - lastBackup() > 7 * 86400000;
  const report = (prefill?: Partial<Incident>) => setIncForm({ severity: 'high', type: 'other', status: 'open', ...prefill });

  const nav = (p: Page, label: string, icon: React.ReactNode, count?: number) => (
    <button key={p} className="nav" aria-current={effectivePage === p ? 'page' : undefined} onClick={() => go(p)} title={label}>
      {icon}<span className="label">{label}</span>{count ? <span className="count">{count}</span> : null}
    </button>
  );

  return (
    <div className="app">
      <nav className="side" aria-label="メイン">
        <div className="brand"><Mark size={30} /><Wordmark sub="荷物追跡" /></div>
        {nav('dashboard', 'ダッシュボード', <LayoutDashboard size={17} />, todo)}
        {nav('shipments', '荷物一覧', <Package size={17} />)}
        {nav('deals', '取引', <Handshake size={17} />)}
        {nav('incidents', '問題・アラート', <Siren size={17} />, openInc.length)}
        {nav('contacts', '緊急連絡先', <Phone size={17} />)}
        {nav('help', '使い方', <BookOpen size={17} />)}
        {nav('settings', '設定', <Cog size={17} />)}
        {server && isAdmin && nav('users', 'ユーザー管理', <UsersIcon size={17} />)}
        <div className="spacer" />
        <button className="nav" onClick={() => void refresh(true)} disabled={busy} title="追跡サービスから最新を取得">
          <RefreshCw size={17} className={busy ? 'spin' : ''} /><span className="label">{busy ? '更新中…' : '最新に更新'}</span>
        </button>
        <div className="whoami">
          <div className="who">{server && user ? <><b>{user.name}</b><small>{user.id}・{user.role === 'admin' ? '管理者' : '一般'}</small></> : <><b>デモ</b><small>実際の認証ではありません</small></>}</div>
          <button className="nav" aria-current={effectivePage === 'logout' ? 'page' : undefined} onClick={() => go('logout')} title="ログアウト"><LogOut size={17} /><span className="label">ログアウト</span></button>
        </div>
      </nav>

      <main className="main">
        {urgent.length > 0 && (
          <div className="urgent-bar" role="alert">
            <Siren size={20} aria-hidden="true" />
            <div><b>緊急の問題が {urgent.length} 件、対応中です</b>　{urgent[0].title}{urgent.length > 1 ? ` ほか${urgent.length - 1}件` : ''}</div>
            <button className="btn" onClick={() => go('incidents')}>対応を見る</button>
            <button className="btn" onClick={() => go('contacts')}><Phone size={15} />緊急連絡先</button>
          </div>
        )}
        {staleBackup && effectivePage !== 'settings' && (
          <div className="banner" role="status"><span>バックアップが1週間以上ありません。データはこのブラウザ内にあります。</span><a href="#/settings">設定でバックアップする</a></div>
        )}
        {effectivePage === 'dashboard' && <Dashboard list={list} incidents={incidents.list} contacts={contacts.list} onOpen={openShipment} onOpenIncidents={() => go('incidents')} onOpenContacts={() => go('contacts')} />}
        {effectivePage === 'shipments' && (
          <Shipments list={list} deals={deals.list} incidents={incidents.list} canDelete={isAdmin} selected={selected} onSelect={setSelected}
            onReport={(s) => report({ shipmentNo: s.containerNo, dealId: s.dealId })} onOpenDeal={openDeal} onOpenIncidents={() => go('incidents')}
            onNew={(no) => { const d = no ? C.detect(no)[0] : undefined; setEditing(false); setForm({ containerNo: no ?? '', ...(d ? { mode: C.defaultMode(d.mode), carrier: d.mode === 'sea' || d.mode === 'air' ? '' : d.carrier } : {}) }); }}
            onEdit={(s) => { setEditing(true); setForm(s); }}
            onAdvance={(s) => void upsert({ ...s, stage: C.STAGE_KEYS[Math.min(C.stageIndex(s.stage) + 1, 6)], lastEventAt: new Date().toISOString() })}
            onDelete={(no) => void remove(no)} />
        )}
        {effectivePage === 'deals' && <Deals deals={deals.list} shipments={list} incidents={incidents.list} canDelete={isAdmin} save={deals.save} remove={deals.remove} selected={selectedDeal} onSelect={setSelectedDeal} onOpenShipment={openShipment} />}
        {effectivePage === 'incidents' && (
          <Incidents incidents={incidents.list} shipments={list} contacts={contacts.list} canDelete={isAdmin} onReport={report} onEdit={(i) => setIncForm(i)}
            onResolve={(i) => setIncForm({ ...i, status: 'resolved' })} remove={incidents.remove} onOpenShipment={openShipment} />
        )}
        {effectivePage === 'contacts' && <Contacts contacts={contacts.list} isAdmin={isAdmin} save={contacts.save} remove={contacts.remove} />}
        {effectivePage === 'settings' && <Settings server={server} list={list} merge={merge} say={say} setTheme={setTheme} />}
        {effectivePage === 'help' && <Help />}
        {effectivePage === 'users' && <Users say={say} />}
        {effectivePage === 'logout' && <Logout onCancel={() => go('dashboard')} />}
      </main>

      <ShipmentForm initial={form} deals={deals.list} existing={editing} onClose={() => setForm(null)}
        onSave={(s) => {
          void upsert(s, editing ? form?.containerNo : undefined);
          setSelected(s.containerNo); setForm(null);
          if (!C.validFor(s.mode, s.containerNo)) say('番号形式（検査数字）が一致しません。入力ミスがないか確認してください（保存はしました）。');
          if (effectivePage !== 'shipments') go('shipments');
        }} />
      <IncidentForm initial={incForm} shipments={list} deals={deals.list} onSave={async (i) => {
        const r = await incidents.save(i);
        if (r) { say(i.id ? '問題を更新しました' : `問題を報告しました（${r.id}）${r.severity === 'urgent' ? '。全画面に緊急の警告を出しています' : ''}`); if (effectivePage !== 'incidents') go('incidents'); }
        return r;
      }} onClose={() => setIncForm(null)} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

