import { useState } from 'react';
import { Phone, Plus, Pencil, Trash2, Mail } from 'lucide-react';
import * as C from '../lib/core.js';
import { CONTACT_CAT, type Contact, type ContactCat } from '../lib/domain.ts';
import { Modal, Field, ConfirmButton } from '../components/Modal.tsx';

interface Props { contacts: Contact[]; isAdmin: boolean; save: (c: Partial<Contact> & Record<string, unknown>) => Promise<Contact | null>; remove: (id: string) => Promise<void> }

// 電話番号をタップで発信できるリンクにする（スマートフォン・PCの電話アプリ）
export const telHref = (p: string) => `tel:${p.replace(/[^0-9+]/g, '')}`;

export function ContactCard({ c }: { c: Contact }) {
  return (
    <div className="contact">
      <div className="c-head"><b>{c.name}</b>{c.always && <span className="pill good">24時間</span>}<span className="pill plain">{CONTACT_CAT[c.category]}</span></div>
      {c.person && <div className="muted">担当：{c.person}</div>}
      {c.phone && <a className="btn call" href={telHref(c.phone)}><Phone size={16} aria-hidden="true" />{c.phone}</a>}
      {c.email && <div><a className="link" href={`mailto:${c.email}`}><Mail size={13} aria-hidden="true" /> {c.email}</a></div>}
      {c.hours && !c.always && <div className="muted hint">受付：{c.hours}</div>}
      {c.modes && c.modes.length > 0 && <div className="muted hint">対象：{c.modes.map((m) => C.MODES[m as keyof typeof C.MODES]?.short ?? m).join('・')}</div>}
      {c.note && <div className="muted hint">{c.note}</div>}
    </div>
  );
}

export function Contacts({ contacts, isAdmin, save, remove }: Props) {
  const [cat, setCat] = useState('');
  const [form, setForm] = useState<Partial<Contact> | null>(null);
  const rows = contacts.filter((c) => !cat || c.category === cat).sort((a, b) => Number(!!b.always) - Number(!!a.always) || a.name.localeCompare(b.name, 'ja'));
  const f = (k: keyof Contact) => ({ value: (form?.[k] as string | undefined) ?? '', onChange: (e: { target: { value: string } }) => setForm((cur) => ({ ...cur, [k]: e.target.value })) });
  const modes = form?.modes ?? [];

  return (
    <>
      <div className="page-head">
        <div><h1>緊急連絡先</h1><p>問題が起きたときにすぐ電話できるよう、連絡先を登録しておきます。電話番号を押すと発信します。</p></div>
        {isAdmin && <button className="btn primary" onClick={() => setForm({ category: 'carrier', modes: [], always: false })}><Plus size={16} />連絡先を追加</button>}
      </div>
      <div className="toolbar">
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="区分">
          <option value="">すべての区分</option>
          {Object.entries(CONTACT_CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <div className="card empty">連絡先が登録されていません。{isAdmin ? '「連絡先を追加」から、運送会社・通関業者・社内の緊急連絡先を登録してください。' : '管理者に登録を依頼してください。'}</div> : (
        <div className="contact-grid">
          {rows.map((c) => (
            <div key={c.id} className="card contact-wrap">
              <ContactCard c={c} />
              {isAdmin && (
                <div className="rowact" style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => setForm(c)}><Pencil size={14} />編集</button>
                  <ConfirmButton label={<><Trash2 size={14} />削除</>} armedLabel="もう一度押すと削除" onConfirm={() => void remove(c.id)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} title={form?.id ? '連絡先を編集' : '連絡先を追加'} onClose={() => setForm(null)}>
        <form onSubmit={async (e) => { e.preventDefault(); if (await save({ ...form })) setForm(null); }}>
          <div className="fgrid">
            <Field label="名称（必須）" full><input className="input" required maxLength={100} {...f('name')} placeholder="例 ヤマト運輸 法人サポート" /></Field>
            <Field label="区分"><select className="select" {...f('category')}>{Object.entries(CONTACT_CAT).map(([k, v]) => <option key={k} value={k as ContactCat}>{v}</option>)}</select></Field>
            <Field label="担当者"><input className="input" maxLength={60} {...f('person')} /></Field>
            <Field label="電話番号"><input className="input" inputMode="tel" maxLength={40} {...f('phone')} placeholder="例 0120-123-456" /></Field>
            <Field label="メール"><input className="input" type="email" maxLength={100} {...f('email')} /></Field>
            <Field label="受付時間"><input className="input" maxLength={60} {...f('hours')} placeholder="例 平日 9:00-18:00" /></Field>
            <Field label="24時間対応"><select className="select" value={form?.always ? '1' : '0'} onChange={(e) => setForm((cur) => ({ ...cur, always: e.target.value === '1' }))}><option value="0">いいえ</option><option value="1">はい（夜間・休日も可）</option></select></Field>
            <div className="field full">対象の輸送手段（該当する問題のときに候補として表示）
              <div className="checks">{Object.entries(C.MODES).map(([m, v]) => (
                <label key={m}><input type="checkbox" checked={modes.includes(m)} onChange={(e) => setForm((cur) => ({ ...cur, modes: e.target.checked ? [...modes, m] : modes.filter((x) => x !== m) }))} /> {v.name}</label>
              ))}</div>
            </div>
            <Field label="メモ" full><input className="input" maxLength={300} {...f('note')} /></Field>
          </div>
          <div className="row"><button type="button" className="btn" onClick={() => setForm(null)}>キャンセル</button><button type="submit" className="btn primary">保存</button></div>
        </form>
      </Modal>
    </>
  );
}
