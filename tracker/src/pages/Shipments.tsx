import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { AlertPill, ModePill, Status, portName } from '../components/bits.tsx';
import { DetailPanel } from '../components/DetailPanel.tsx';

interface Props {
  list: Shipment[]; canDelete: boolean; selected: string | null; onSelect: (no: string | null) => void;
  onNew: (no?: string) => void; onEdit: (s: Shipment) => void; onAdvance: (s: Shipment) => void; onDelete: (no: string) => void;
}

const hit = (s: Shipment, q: string) => !q || [s.containerNo, s.bookingNo, s.blNo, s.lot, s.producer, s.buyer, s.vessel, s.carrier].some((v) => (v ?? '').toLowerCase().includes(q));

export function Shipments({ list, canDelete, selected, onSelect, onNew, onEdit, onAdvance, onDelete }: Props) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [state, setState] = useState('open');
  const [quick, setQuick] = useState('');

  const rows = useMemo(() => list.filter((s) => {
    const done = C.stageIndex(s.stage) >= 6;
    return hit(s, q.trim().toLowerCase()) && (!mode || s.mode === mode) && (state === 'all' || (state === 'open' ? !done : done));
  }), [list, q, mode, state]);
  const sel = list.find((s) => s.containerNo === selected) ?? null;

  return (
    <>
      <div className="page-head">
        <div><h1>荷物一覧</h1><p>番号を貼り付けて Enter。輸送手段と運送会社を自動で判別します。</p></div>
      </div>
      <form className="toolbar" onSubmit={(e) => {
        e.preventDefault();
        const n = C.normalizeNo(quick); if (!n) return;
        setQuick('');
        if (list.some((s) => s.containerNo === n)) { onSelect(n); setState('all'); } else onNew(n);
      }}>
        <input className="input grow mono" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="追跡番号を貼り付け（コンテナ・AWB・ヤマト・佐川・EMS など）" aria-label="追跡番号" />
        <button className="btn primary" type="submit"><Plus size={16} />登録</button>
      </form>
      <div className="toolbar">
        <label className="grow" style={{ position: 'relative', display: 'block' }}>
          <span className="sr">検索</span>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} aria-hidden="true" />
          <input className="input" style={{ width: '100%', paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="番号・B/L・ロット・生産者・取引先で検索" />
        </label>
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="輸送手段">
          <option value="">全手段</option>
          {Object.entries(C.MODES).map(([m, v]) => <option key={m} value={m}>{v.name}</option>)}
        </select>
        <select className="select" value={state} onChange={(e) => setState(e.target.value)} aria-label="状態">
          <option value="open">輸送中</option><option value="done">完了</option><option value="all">すべて</option>
        </select>
      </div>

      <div className={`split${sel ? '' : ' single'}`}>
        <div className="card table-wrap">
          {rows.length === 0 ? <div className="empty">該当する荷物がありません</div> : (
            <table>
              <thead><tr><th>手段</th><th>追跡番号</th><th className="hide-sm">区間・運送会社</th><th>ETA</th><th>状態</th>{!sel && <th className="hide-sm">注意</th>}</tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.containerNo} data-sev={C.severity(s)} aria-selected={s.containerNo === selected} onClick={() => onSelect(s.containerNo)}>
                    <td><ModePill mode={s.mode} /></td>
                    <td className="no">{s.containerNo}</td>
                    <td className="hide-sm" style={{ whiteSpace: 'nowrap' }}>{s.pol || s.pod ? `${portName(s.pol)} → ${portName(s.pod)}` : s.carrier || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.eta || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><Status s={s} /></td>
                    {!sel && <td className="hide-sm"><AlertPill s={s} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {sel && <DetailPanel s={sel} all={list} canDelete={canDelete} onEdit={() => onEdit(sel)} onAdvance={() => onAdvance(sel)} onDelete={() => { onDelete(sel.containerNo); onSelect(null); }} onSelect={onSelect} />}
      </div>
    </>
  );
}
