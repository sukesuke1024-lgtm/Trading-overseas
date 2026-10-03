import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Package, BookOpen, Settings as Cog, RefreshCw } from 'lucide-react';
import * as C from './lib/core.js';
import type { Shipment } from './lib/core.js';
import { lastBackup, useConfig, useShipments } from './lib/store.ts';
import { refreshAll } from './lib/api.ts';
import { Dashboard } from './pages/Dashboard.tsx';
import { Shipments } from './pages/Shipments.tsx';
import { Settings } from './pages/Settings.tsx';
import { Help } from './pages/Help.tsx';
import { ShipmentForm } from './components/ShipmentForm.tsx';

type Page = 'dashboard' | 'shipments' | 'settings' | 'help';
const pages: Page[] = ['dashboard', 'shipments', 'settings', 'help'];
const fromHash = (): Page => { const h = location.hash.replace('#/', ''); return (pages as string[]).includes(h) ? (h as Page) : 'dashboard'; };

export function App() {
  const { list, setList, upsert, remove, merge } = useShipments();
  const [cfg, setCfg] = useConfig();
  const [page, setPage] = useState<Page>(fromHash);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Shipment> | null>(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { const f = () => setPage(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t); }, [toast]);
  const go = (p: Page) => { location.hash = `#/${p}`; };
  const say = useCallback((m: string) => setToast(m), []);

  const setTheme = (t: 'light' | 'dark' | 'auto') => {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    try { if (t === 'auto') localStorage.removeItem('hlink-tracker-theme'); else localStorage.setItem('hlink-tracker-theme', t); } catch { /* noop */ }
  };
  useEffect(() => { try { const t = localStorage.getItem('hlink-tracker-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch { /* noop */ } }, []);

  const refresh = useCallback(async (manual: boolean) => {
    if (busy) return;
    setBusy(true);
    const r = await refreshAll(list, cfg);
    setList(r.list); setBusy(false);
    if (manual) say(r.failed && !r.changed && r.failed === r.list.filter((s) => C.stageIndex(s.stage) < 6).length
      ? '追跡サービスに接続できませんでした。設定の中継サーバーURLを確認してください。'
      : `更新：${r.changed} 件に変化／失敗 ${r.failed} 件${r.unsupported ? `／自動取得が未設定の手段 ${r.unsupported} 件（手入力のまま）` : ''}`);
  }, [busy, list, cfg, setList, say]);

  // 接続設定がある場合のみ30分ごとに自動更新
  useEffect(() => {
    if (!cfg.relay) return;
    const t = setInterval(() => { void refresh(false); }, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [cfg.relay, refresh]);

  const todo = list.filter((s) => C.severity(s) > 0).length;
  const openShipment = (no: string) => { setSelected(no); go('shipments'); };
  const staleBackup = list.length > 0 && Date.now() - lastBackup() > 7 * 86400000;

  const nav = (p: Page, label: string, icon: React.ReactNode, count?: number) => (
    <button key={p} className="nav" aria-current={page === p ? 'page' : undefined} onClick={() => go(p)} title={label}>
      {icon}<span className="label">{label}</span>{count ? <span className="count">{count}</span> : null}
    </button>
  );

  return (
    <div className="app">
      <nav className="side" aria-label="メイン">
        <div className="brand"><i>H</i><div>H-LINK 荷物追跡<small>海・空・宅配を1画面で</small></div></div>
        {nav('dashboard', 'ダッシュボード', <LayoutDashboard size={17} />, todo)}
        {nav('shipments', '荷物一覧', <Package size={17} />)}
        {nav('help', '使い方', <BookOpen size={17} />)}
        {nav('settings', '設定', <Cog size={17} />)}
        <div className="spacer" />
        <button className="nav" onClick={() => void refresh(true)} disabled={busy} title="追跡サービスから最新を取得">
          <RefreshCw size={17} className={busy ? 'spin' : ''} /><span className="label">{busy ? '更新中…' : '最新に更新'}</span>
        </button>
      </nav>

      <main className="main">
        {staleBackup && page !== 'settings' && (
          <div className="banner" role="status"><span>バックアップが1週間以上ありません。データはこのブラウザ内にあります。</span><a href="#/settings">設定でバックアップする</a></div>
        )}
        {page === 'dashboard' && <Dashboard list={list} onOpen={openShipment} />}
        {page === 'shipments' && (
          <Shipments list={list} selected={selected} onSelect={setSelected}
            onNew={(no) => { setEditing(false); setForm({ containerNo: no ?? '', ...(no && C.detect(no)[0] ? { mode: C.detect(no)[0].mode, carrier: ['sea', 'air'].includes(C.detect(no)[0].mode) ? '' : C.detect(no)[0].carrier } : {}) }); }}
            onEdit={(s) => { setEditing(true); setForm(s); }}
            onAdvance={(s) => upsert({ ...s, stage: C.STAGE_KEYS[Math.min(C.stageIndex(s.stage) + 1, 6)], lastEventAt: new Date().toISOString() })}
            onDelete={remove} />
        )}
        {page === 'settings' && <Settings cfg={cfg} setCfg={setCfg} list={list} merge={merge} say={say} setTheme={setTheme} />}
        {page === 'help' && <Help />}
      </main>

      <ShipmentForm initial={form} existing={editing} onClose={() => setForm(null)}
        onSave={(s) => {
          upsert(s, editing ? form?.containerNo : undefined);
          setSelected(s.containerNo); setForm(null);
          if (!C.validFor(s.mode, s.containerNo)) say('番号形式（検査数字）が一致しません。入力ミスがないか確認してください（保存はしました）。');
          if (page !== 'shipments') go('shipments');
        }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
