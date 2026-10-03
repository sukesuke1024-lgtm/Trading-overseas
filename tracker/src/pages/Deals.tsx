import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { DEAL_STATUS, TERMS, fmtMoney, when, type Deal, type DealStatus, type Incident } from '../lib/domain.ts';
import { Modal, Field, ConfirmButton } from '../components/Modal.tsx';
import { ModePill, Status } from '../components/bits.tsx';

interface Props {
  deals: Deal[]; shipments: Shipment[]; incidents: Incident[]; canDelete: boolean;
  save: (d: Partial<Deal> & Record<string, unknown>) => Promise<Deal | null>; remove: (id: string) => Promise<void>;
  selected: string | null; onSelect: (id: string | null) => void; onOpenShipment: (no: string) => void;
}
const pillOf = (s: DealStatus) => (s === 'paid' || s === 'delivered' ? 'good' : s === 'cancelled' ? 'plain' : s === 'negotiating' ? 'warn' : 'plain');

export function Deals({ deals, shipments, incidents, canDelete, save, remove, selected, onSelect, onOpenShipment }: Props) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState('active');
  const [form, setForm] = useState<Partial<Deal> | null>(null);
  const rows = useMemo(() => deals.filter((d) => {
    const hit = !q || [d.id, d.title, d.partner, d.product, d.lot, d.owner].some((v) => (v ?? '').toLowerCase().includes(q.toLowerCase()));
    return hit && (st === 'all' || (st === 'active' ? d.status !== 'cancelled' && d.status !== 'paid' : d.status === st));
  }), [deals, q, st]);
  const sel = deals.find((d) => d.id === selected) ?? null;
  const linked = sel ? shipments.filter((s) => s.dealId === sel.id) : [];
  const incs = sel ? incidents.filter((i) => i.dealId === sel.id) : [];

  const f = (k: keyof Deal) => ({
    value: (form?.[k] as string | number | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => setForm((cur) => ({ ...cur, [k]: e.target.value })),
  });

  return (
    <>
      <div className="page-head">
        <div><h1>取引</h1><p>取引先ごとの契約情報を管理します。荷物は荷物一覧の登録時に取引へ紐付けます。</p></div>
        <button className="btn primary" onClick={() => setForm({ status: 'negotiating', currency: 'JPY' })}><Plus size={16} />取引を追加</button>
      </div>
      <div className="toolbar">
        <label className="grow" style={{ position: 'relative', display: 'block' }}>
          <span className="sr">検索</span>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} aria-hidden="true" />
          <input className="input" style={{ width: '100%', paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="取引ID・取引先・品名・ロット・担当で検索" />
        </label>
        <select className="select" value={st} onChange={(e) => setSt(e.target.value)} aria-label="状態">
          <option value="active">進行中</option><option value="all">すべて</option>
          {Object.entries(DEAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}のみ</option>)}
        </select>
      </div>

      <div className={`split${sel ? '' : ' single'}`}>
        <div className="card table-wrap">
          {rows.length === 0 ? <div className="empty">該当する取引がありません</div> : (
            <table>
              <thead><tr><th>取引ID</th><th>取引先</th><th>品名</th><th className="hide-sm">金額</th><th>状態</th><th className="hide-sm">納期</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} aria-selected={d.id === selected} onClick={() => onSelect(d.id)}>
                    <td className="no">{d.id}</td><td>{d.partner}</td><td>{d.title}</td>
                    <td className="hide-sm" style={{ whiteSpace: 'nowrap' }}>{fmtMoney(d.amount, d.currency)}</td>
                    <td><span className={`pill ${pillOf(d.status)}`}>{DEAL_STATUS[d.status]}</span></td>
                    <td className="hide-sm" style={{ whiteSpace: 'nowrap' }}>{d.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sel && (
          <aside className="card detail" aria-label="取引の詳細">
            <div className="muted mono">{sel.id}</div>
            <h2 style={{ fontFamily: 'var(--font)', fontSize: 18 }}>{sel.title}</h2>
            <div style={{ marginTop: 4 }}><span className={`pill ${pillOf(sel.status)}`}>{DEAL_STATUS[sel.status]}</span></div>
            <dl className="fields">
              {([['取引先', sel.partner], ['国・地域', sel.partnerCountry], ['先方担当', sel.contactPerson], ['品名', sel.product], ['数量', sel.quantity],
                ['金額', fmtMoney(sel.amount, sel.currency)], ['取引条件', sel.terms], ['自社担当', sel.owner], ['納期', sel.dueDate], ['ロット', sel.lot]] as [string, string | undefined][]).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}><dt>備考</dt><dd>{sel.note || '—'}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>最終更新</dt><dd>{sel.updatedBy ?? '—'}　{when(sel.updatedAt)}</dd></div>
            </dl>
            <div className="muted" style={{ fontSize: 12 }}>紐付く荷物（{linked.length}件）</div>
            {linked.length === 0 ? <p className="muted hint">まだありません。荷物の登録・編集で、この取引を選んでください。</p> : (
              <ul className="mini">{linked.map((s) => (
                <li key={s.containerNo}><button className="link" onClick={() => onOpenShipment(s.containerNo)}><ModePill mode={s.mode} /> <span className="mono">{s.containerNo}</span></button> <Status s={s} /></li>
              ))}</ul>
            )}
            {incs.length > 0 && <p className="hint" style={{ color: 'var(--bad)' }}>この取引に関する問題が {incs.filter((i) => i.status === 'open').length} 件対応中です（全{incs.length}件）。</p>}
            <div className="actions">
              <button className="btn primary" onClick={() => setForm(sel)}><Pencil size={15} />編集</button>
              {canDelete && <ConfirmButton label={<><Trash2 size={15} />削除</>} armedLabel="もう一度押すと削除" onConfirm={() => { void remove(sel.id); onSelect(null); }} />}
            </div>
            {linked.length > 0 && canDelete && <p className="muted hint">削除しても、紐付いた荷物は消えません（取引との紐付けだけが外れます）。</p>}
          </aside>
        )}
      </div>

      <Modal open={!!form} title={form?.id ? `取引を編集（${form.id}）` : '取引を追加'} onClose={() => setForm(null)}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const r = await save({ ...form, amount: form?.amount === undefined || (form.amount as unknown) === '' ? null : Number(form.amount) });
          if (r) { onSelect(r.id); setForm(null); }
        }}>
          <div className="fgrid">
            <Field label="取引名（必須）" full><input className="input" required maxLength={100} {...f('title')} placeholder="例 ホタテ貝柱 1コンテナ" /></Field>
            <Field label="取引先（必須）"><input className="input" required maxLength={100} {...f('partner')} /></Field>
            <Field label="国・地域"><input className="input" maxLength={60} {...f('partnerCountry')} placeholder="例 シンガポール" /></Field>
            <Field label="先方の担当者"><input className="input" maxLength={60} {...f('contactPerson')} /></Field>
            <Field label="自社の担当"><input className="input" maxLength={50} {...f('owner')} /></Field>
            <Field label="品名"><input className="input" maxLength={100} {...f('product')} /></Field>
            <Field label="数量"><input className="input" maxLength={60} {...f('quantity')} placeholder="例 20t / 800ケース" /></Field>
            <Field label="金額"><input className="input" type="number" min={0} step="any" {...f('amount')} /></Field>
            <Field label="通貨"><select className="select" {...f('currency')}>{['JPY', 'USD', 'EUR', 'SGD', 'HKD', 'CNY', 'THB'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="取引条件（Incoterms）"><select className="select" {...f('terms')}>{TERMS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</select></Field>
            <Field label="状態"><select className="select" {...f('status')}>{Object.entries(DEAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="納期"><input className="input" type="date" {...f('dueDate')} /></Field>
            <Field label="ロット番号"><input className="input" maxLength={60} {...f('lot')} /></Field>
            <Field label="備考" full><input className="input" maxLength={500} {...f('note')} /></Field>
          </div>
          <div className="row"><button type="button" className="btn" onClick={() => setForm(null)}>キャンセル</button><button type="submit" className="btn primary">保存</button></div>
        </form>
      </Modal>
    </>
  );
}
