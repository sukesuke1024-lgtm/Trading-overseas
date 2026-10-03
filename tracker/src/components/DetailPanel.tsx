import { useEffect, useState } from 'react';
import { Pencil, ArrowRight, Trash2, Siren } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { ModePill, RouteMap, portName, stageLabel } from './bits.tsx';
import { INC_SEV, type Deal, type Incident } from '../lib/domain.ts';

interface Props {
  s: Shipment; all: Shipment[]; deal?: Deal; incidents: Incident[];
  onReport: () => void; onOpenDeal: (id: string) => void; onOpenIncidents: () => void;
  canDelete: boolean; onEdit: () => void; onAdvance: () => void; onDelete: () => void; onSelect: (no: string) => void;
}

export function DetailPanel({ s, all, deal, incidents, onReport, onOpenDeal, onOpenIncidents, canDelete, onEdit, onAdvance, onDelete, onSelect }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { setArmed(false); }, [s.containerNo]);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);

  const idx = C.stageIndex(s.stage);
  const alerts = C.alertsFor(s);
  const left = C.daysToEta(s);
  const same = s.lot ? all.filter((o) => o !== s && o.lot === s.lot) : [];
  const carrier = s.carrier || (s.mode === 'sea' || s.mode === 'air' ? C.carrierOf(s.containerNo, s.mode) : '');
  const F = ({ k, v }: { k: string; v?: string }) => <div><dt>{k}</dt><dd>{v || '—'}</dd></div>;

  return (
    <aside className="card detail" aria-label="荷物の詳細">
      <h2>{s.containerNo}</h2>
      <div className="muted" style={{ marginTop: 4 }}>
        <ModePill mode={s.mode} /> {carrier && `${carrier}　`}{stageLabel(s)}
        {left != null && idx < 4 ? `　到着まで ${left} 日` : ''}
      </div>
      {incidents.length > 0 && (
        <div className="alerts">{incidents.map((i) => (
          <button key={i.id} className={`alert ${i.severity === 'urgent' ? 'danger' : 'warn'} btnlike`} onClick={onOpenIncidents}>
            <b>{INC_SEV[i.severity]}</b>　{i.title}（対応中・{i.id}）
          </button>
        ))}</div>
      )}
      {alerts.length > 0 && <div className="alerts">{alerts.map((a) => <div key={a.text} className={`alert ${a.level}`}>{a.text}</div>)}</div>}
      <ol className="steps">
        {C.stageLabels(s.mode).map((st, i) => <li key={st.key} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>{st.label}</li>)}
      </ol>
      {(s.mode === 'sea' || s.mode === 'air') && <RouteMap s={s} />}
      <dl className="fields">
        <F k="出発地" v={portName(s.pol)} /><F k="到着地" v={portName(s.pod)} />
        <F k="ETD" v={s.etd} /><F k="ETA" v={s.eta} />
        <F k="本船・便" v={[s.vessel, s.voyage].filter(Boolean).join(' / ')} /><F k="ブッキング" v={s.bookingNo} />
        <F k="B/L・HAWB" v={s.blNo} /><F k="フリータイム終了" v={s.freeTimeEnd} />
        <F k="ロット" v={s.lot} /><F k="生産者" v={s.producer} />
        <F k="取引先" v={s.buyer} /><F k="最終取得" v={s.checkedAt?.slice(0, 16).replace('T', ' ')} />
        {s.updatedBy && <F k="最終更新" v={`${s.updatedBy}　${(s.updatedAt ?? '').slice(0, 16).replace('T', ' ')}`} />}
        <div style={{ gridColumn: '1 / -1' }}><dt>備考</dt><dd>{s.note || '—'}</dd></div>
      </dl>
      <div style={{ margin: '4px 0 10px' }}>
        <div className="muted" style={{ fontSize: 12 }}>取引</div>
        {deal ? <button className="link" onClick={() => onOpenDeal(deal.id)}><span className="mono">{deal.id}</span>　{deal.partner}　{deal.title}</button> : <span className="muted">未選択（編集で選べます）</span>}
      </div>
      {same.length > 0 && (
        <div>
          <div className="muted" style={{ fontSize: 12 }}>同じロットの荷物</div>
          <div className="chips">{same.map((o) => <button key={o.containerNo} className="chip" onClick={() => onSelect(o.containerNo)}>{o.containerNo}（{C.MODES[o.mode].short}）</button>)}</div>
        </div>
      )}
      {s.events && s.events.length > 0 && (
        <ul className="events">
          {s.events.slice(0, 15).map((e) => <li key={e.at + e.text}><time>{e.at.replace('T', ' ').slice(0, 16)}{e.place ? `　${e.place}` : ''}</time>{e.text}</li>)}
        </ul>
      )}
      <div className="actions">
        <button className="btn primary" onClick={onEdit}><Pencil size={15} />編集</button>
        <button className="btn" onClick={onAdvance} disabled={idx >= 6}><ArrowRight size={15} />次の工程へ</button>
        <button className="btn danger" onClick={onReport}><Siren size={15} />問題を報告</button>
        {canDelete && (
          <button className={`btn danger${armed ? ' armed' : ''}`} onClick={() => (armed ? onDelete() : setArmed(true))}>
            <Trash2 size={15} />{armed ? 'もう一度押すと削除' : '削除'}
          </button>
        )}
      </div>
    </aside>
  );
}
