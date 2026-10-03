import { AlertTriangle, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { INC_SEV, INC_TYPE, sevRank, when, type Contact, type Incident } from '../lib/domain.ts';
import { ConfirmButton } from '../components/Modal.tsx';
import { ModePill } from '../components/bits.tsx';
import { ContactCard } from './Contacts.tsx';

interface Props {
  incidents: Incident[]; shipments: Shipment[]; contacts: Contact[]; canDelete: boolean;
  onReport: (prefill?: Partial<Incident>) => void; onEdit: (i: Incident) => void; onResolve: (i: Incident) => void; remove: (id: string) => Promise<void>;
  onOpenShipment: (no: string) => void;
}
const sevPill = (s: Incident['severity']) => (s === 'urgent' ? 'bad' : s === 'high' ? 'warn' : 'plain');

// その問題に関係しそうな連絡先（24時間対応・同じ輸送手段・社内を優先）
export function suggestContacts(i: Incident, shipments: Shipment[], contacts: Contact[]): Contact[] {
  const mode = shipments.find((s) => s.containerNo === i.shipmentNo)?.mode;
  return contacts.filter((c) => c.category === 'internal' || (mode && c.modes?.includes(mode)) || (!mode && c.always))
    .sort((a, b) => Number(!!b.always) - Number(!!a.always)).slice(0, 4);
}

export function Incidents({ incidents, shipments, contacts, canDelete, onReport, onEdit, onResolve, remove, onOpenShipment }: Props) {
  const open = incidents.filter((i) => i.status === 'open').sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const done = incidents.filter((i) => i.status === 'resolved').sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt))).slice(0, 20);
  // システムが検知した異常のうち、まだ問題として報告されていない荷物
  const reported = new Set(open.map((i) => i.shipmentNo));
  const auto = shipments.filter((s) => C.severity(s) === 2 && !reported.has(s.containerNo));

  return (
    <>
      <div className="page-head">
        <div><h1>問題・アラート</h1><p>問題が起きたら報告し、対応が終わるまで追跡します。緊急のものは、全画面の上部に警告を出します。</p></div>
        <button className="btn primary" onClick={() => onReport()}><Plus size={16} />問題を報告</button>
      </div>

      {auto.length > 0 && (
        <section className="section">
          <h2><AlertTriangle size={16} aria-hidden="true" /> システムが検知した異常 <span className="muted">{auto.length}件・未報告</span></h2>
          <div className="card table-wrap">
            <table>
              <tbody>
                {auto.map((s) => (
                  <tr key={s.containerNo} style={{ cursor: 'default' }}>
                    <td><ModePill mode={s.mode} means={s.means} /></td>
                    <td className="no"><button className="link mono" onClick={() => onOpenShipment(s.containerNo)}>{s.containerNo}</button></td>
                    <td>{C.alertsFor(s).filter((a) => a.level === 'danger').map((a) => a.text).join(' / ')}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn" onClick={() => onReport({ shipmentNo: s.containerNo, dealId: s.dealId, title: C.alertsFor(s)[0].text, type: s.exception ? 'damage' : 'delay', severity: 'high' })}>問題として報告</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section">
        <h2>対応中 <span className="muted">{open.length}件</span></h2>
        {open.length === 0 ? <div className="card empty"><CheckCircle2 size={20} aria-hidden="true" /> 対応中の問題はありません</div> : open.map((i) => {
          const sc = suggestContacts(i, shipments, contacts);
          return (
            <article key={i.id} className={`card inc ${i.severity}`}>
              <div className="inc-head">
                <span className={`pill ${sevPill(i.severity)}`}>{INC_SEV[i.severity]}</span><span className="pill plain">{INC_TYPE[i.type]}</span>
                <b>{i.title}</b><span className="muted mono">{i.id}</span>
              </div>
              <div className="muted hint">
                {i.shipmentNo && <>荷物 <button className="link mono" onClick={() => onOpenShipment(i.shipmentNo!)}>{i.shipmentNo}</button>　</>}{i.dealId && <>取引 <span className="mono">{i.dealId}</span>　</>}
                報告：{i.createdBy ?? '—'}　{when(i.createdAt)}
              </div>
              {i.detail && <p style={{ margin: '6px 0' }}>{i.detail}</p>}
              {sc.length > 0 ? (
                <div><div className="muted" style={{ fontSize: 12, margin: '6px 0 4px' }}>すぐ連絡できる先</div><div className="contact-grid compact">{sc.map((c) => <div key={c.id} className="contact-wrap"><ContactCard c={c} /></div>)}</div></div>
              ) : <p className="muted hint">連絡先が未登録です。「緊急連絡先」で登録しておくと、ここに表示されます。</p>}
              <div className="actions">
                <button className="btn primary" onClick={() => onResolve(i)}><CheckCircle2 size={15} />対応済みにする</button>
                <button className="btn" onClick={() => onEdit(i)}><Pencil size={15} />内容を更新</button>
                {canDelete && <ConfirmButton label={<><Trash2 size={15} />削除</>} armedLabel="もう一度押すと削除" onConfirm={() => void remove(i.id)} />}
              </div>
            </article>
          );
        })}
      </section>

      <section className="section">
        <h2>解決済み <span className="muted">最新20件</span></h2>
        <div className="card table-wrap">
          {done.length === 0 ? <div className="empty">解決済みの問題はありません</div> : (
            <table>
              <thead><tr><th>ID</th><th>重大度</th><th>件名</th><th className="hide-sm">対応内容</th><th>解決</th><th /></tr></thead>
              <tbody>{done.map((i) => (
                <tr key={i.id} style={{ cursor: 'default' }}>
                  <td className="no">{i.id}</td><td><span className={`pill ${sevPill(i.severity)}`}>{INC_SEV[i.severity]}</span></td>
                  <td>{i.title}</td><td className="hide-sm muted">{i.resolution || '—'}</td><td style={{ whiteSpace: 'nowrap' }}>{i.resolvedBy}　{when(i.resolvedAt)}</td>
                  <td>{canDelete && <ConfirmButton label="削除" armedLabel="もう一度" onConfirm={() => void remove(i.id)} />}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
