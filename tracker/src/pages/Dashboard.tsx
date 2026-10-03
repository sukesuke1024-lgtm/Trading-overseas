import { CheckCircle2, Phone } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { AlertPill, MeansIcon, ModePill, Status, portName } from '../components/bits.tsx';
import { INC_SEV, sevRank, type Contact, type Incident } from '../lib/domain.ts';
import { telHref } from './Contacts.tsx';

export function Dashboard({ list, incidents, contacts, onOpen, onOpenIncidents, onOpenContacts }: { list: Shipment[]; incidents: Incident[]; contacts: Contact[]; onOpen: (no: string) => void; onOpenIncidents: () => void; onOpenContacts: () => void }) {
  const openInc = incidents.filter((i) => i.status === 'open').sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  const emergency = contacts.filter((c) => c.always && c.phone).slice(0, 4);
  const active = list.filter((s) => C.stageIndex(s.stage) < 6);
  const todo = list.filter((s) => C.severity(s) > 0).sort((a, b) => C.severity(b) - C.severity(a));
  const bad = todo.filter((s) => C.severity(s) === 2).length;
  const arriving = active
    .filter((s) => { const d = C.daysToEta(s); return d != null && d >= 0 && d <= 7; })
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
  const areas = (['overseas', 'mainland', 'hokkaido'] as const).map((a) => ({ a, items: active.filter((s) => C.areaOf(s.mode) === a) }));

  return (
    <>
      <div className="page-head">
        <div><h1>ダッシュボード</h1><p>毎朝ここだけ確認すれば足ります。動きがあった荷物は「要対応」に出ます。</p></div>
      </div>
      <div className="kpis">
        <div className="card kpi"><b>{list.length}</b><span>登録した荷物</span></div>
        <div className="card kpi"><b>{active.length}</b><span>輸送中</span></div>
        <div className="card kpi warn"><b>{todo.length - bad}</b><span>要注意</span></div>
        <div className="card kpi bad"><b>{bad}</b><span>遅延・異常を検知</span></div>
        <button className="card kpi bad btnlike" onClick={onOpenIncidents}><b>{openInc.length}</b><span>対応中の問題</span></button>
      </div>

      <section className="section">
        <h2>対応中の問題 <span className="muted">{openInc.length}件</span></h2>
        <div className="card table-wrap">
          {openInc.length === 0 ? <div className="empty"><CheckCircle2 size={20} aria-hidden="true" /> 報告されている問題はありません</div> : (
            <table><tbody>{openInc.slice(0, 5).map((i) => (
              <tr key={i.id} onClick={onOpenIncidents}>
                <td><span className={`pill ${i.severity === 'urgent' ? 'bad' : i.severity === 'high' ? 'warn' : 'plain'}`}>{INC_SEV[i.severity]}</span></td>
                <td>{i.title}</td><td className="no hide-sm">{i.shipmentNo || '—'}</td><td className="muted hide-sm">{i.id}</td>
              </tr>
            ))}</tbody></table>
          )}
        </div>
      </section>

      <section className="section">
        <h2>緊急連絡先（24時間） <button className="link" onClick={onOpenContacts}>すべて見る</button></h2>
        {emergency.length === 0 ? <div className="card empty">24時間対応の連絡先が未登録です。「緊急連絡先」で登録してください。</div> : (
          <div className="contact-grid compact">{emergency.map((c) => (
            <div key={c.id} className="card contact-wrap"><div className="c-head"><b>{c.name}</b></div><a className="btn call" href={telHref(c.phone!)}><Phone size={16} aria-hidden="true" />{c.phone}</a></div>
          ))}</div>
        )}
      </section>

      <section className="section">
        <h2>今日の要対応 <span className="muted">{todo.length}件</span></h2>
        <div className="card table-wrap">
          {todo.length === 0 ? (
            <div className="empty"><CheckCircle2 size={20} aria-hidden="true" /> 対応が必要な荷物はありません</div>
          ) : (
            <table>
              <thead><tr><th>手段</th><th>追跡番号</th><th>内容</th><th className="hide-sm">取引先・ロット</th><th className="hide-sm">状態</th></tr></thead>
              <tbody>
                {todo.map((s) => (
                  <tr key={s.containerNo} onClick={() => onOpen(s.containerNo)}>
                    <td><ModePill mode={s.mode} means={s.means} /></td><td className="no">{s.containerNo}</td>
                    <td><AlertPill s={s} /></td><td className="hide-sm">{s.buyer || s.lot || '—'}</td><td className="hide-sm"><Status s={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section">
        <h2>7日以内の到着・配達予定 <span className="muted">{arriving.length}件</span></h2>
        <div className="card table-wrap">
          {arriving.length === 0 ? <div className="empty">予定はありません</div> : (
            <table>
              <thead><tr><th>手段</th><th>追跡番号</th><th>区間</th><th>予定日</th><th className="hide-sm">取引先</th></tr></thead>
              <tbody>
                {arriving.map((s) => (
                  <tr key={s.containerNo} onClick={() => onOpen(s.containerNo)}>
                    <td><ModePill mode={s.mode} means={s.means} /></td><td className="no">{s.containerNo}</td>
                    <td>{s.pol || s.pod ? `${portName(s.pol)} → ${portName(s.pod)}` : s.carrier || '—'}</td>
                    <td>{s.eta}</td><td className="hide-sm">{s.buyer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section">
        <h2>場所別の輸送中</h2>
        <div className="areas">
          {areas.map(({ a, items }) => (
            <div key={a} className="card area">
              <div className="area-head"><b>{C.AREAS[a]}</b><span className="area-n">{items.length}<small> 件</small></span></div>
              <div className="area-means">
                {(['ship', 'plane', 'truck', 'parcel'] as const).map((m) => {
                  const n = items.filter((s) => C.meansOf(s) === m).length;
                  return <span key={m} className={n ? '' : 'zero'} title={C.MEANS[m]}><MeansIcon m={m} />{C.MEANS[m]} <b>{n}</b></span>;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
