import { useState, useEffect } from 'react';
import type { Shipment } from '../lib/core.js';
import { INC_SEV, INC_TYPE, type Deal, type Incident } from '../lib/domain.ts';
import { Modal, Field } from './Modal.tsx';

interface Props { initial: Partial<Incident> | null; shipments: Shipment[]; deals: Deal[]; onSave: (i: Partial<Incident> & Record<string, unknown>) => Promise<Incident | null>; onClose: () => void }

export function IncidentForm({ initial, shipments, deals, onSave, onClose }: Props) {
  const [f, setF] = useState<Partial<Incident>>({});
  useEffect(() => { if (initial) setF({ severity: 'high', type: 'other', status: 'open', ...initial }); }, [initial]);
  const set = (k: keyof Incident) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const editing = !!initial?.id;

  return (
    <Modal open={!!initial} title={editing ? `問題を更新（${initial?.id}）` : '問題を報告'} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await onSave({ ...f })) onClose(); }}>
        <div className="fgrid">
          <Field label="件名（必須）" full><input className="input" required maxLength={100} value={f.title ?? ''} onChange={set('title')} placeholder="例 コンテナ内の温度が上昇" /></Field>
          <Field label="種類"><select className="select" value={f.type ?? 'other'} onChange={set('type')}>{Object.entries(INC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="重大度"><select className="select" value={f.severity ?? 'high'} onChange={set('severity')}>{Object.entries(INC_SEV).map(([k, v]) => <option key={k} value={k}>{v}{k === 'urgent' ? '（全画面に警告を出します）' : ''}</option>)}</select></Field>
          <Field label="対象の荷物">
            <select className="select" value={f.shipmentNo ?? ''} onChange={set('shipmentNo')}>
              <option value="">指定しない</option>
              {shipments.map((s) => <option key={s.containerNo} value={s.containerNo}>{s.containerNo}{s.buyer ? `（${s.buyer}）` : ''}</option>)}
            </select>
          </Field>
          <Field label="関係する取引">
            <select className="select" value={f.dealId ?? ''} onChange={set('dealId')}>
              <option value="">指定しない</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.id}　{d.partner}　{d.title}</option>)}
            </select>
          </Field>
          <Field label="状況の詳細" full><textarea className="textarea" rows={3} maxLength={1000} value={f.detail ?? ''} onChange={set('detail')} placeholder="いつ・何が・どの程度。分かる範囲で構いません。" /></Field>
          {editing && (
            <>
              <Field label="対応状況"><select className="select" value={f.status ?? 'open'} onChange={set('status')}><option value="open">対応中</option><option value="resolved">解決済み</option></select></Field>
              <Field label="対応内容・結果" full><textarea className="textarea" rows={2} maxLength={1000} value={f.resolution ?? ''} onChange={set('resolution')} placeholder="どう対応したか（解決済みにするときに記入）" /></Field>
            </>
          )}
        </div>
        <div className="row"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button type="submit" className="btn primary">{editing ? '更新' : '報告する'}</button></div>
      </form>
    </Modal>
  );
}
