import { useEffect, useRef, useState } from 'react';
import * as C from '../lib/core.js';
import type { Mode, Shipment } from '../lib/core.js';

interface Props { initial: Partial<Shipment> | null; existing: boolean; onSave: (s: Shipment) => void; onClose: () => void }

export function ShipmentForm({ initial, existing, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Partial<Shipment>>(initial ?? {});
  useEffect(() => { setF({ mode: 'sea', stage: 'booked', ...initial }); }, [initial]);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (initial && !d.open) d.showModal();
    if (!initial && d.open) d.close();
  }, [initial]);
  if (!initial) return <dialog ref={ref} onClose={onClose} />;

  const mode = (f.mode ?? 'sea') as Mode;
  const no = C.normalizeNo(f.containerNo ?? '');
  const cand = C.detect(no)[0];
  const set = (k: keyof Shipment) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const T = ({ k, label, type = 'text', full }: { k: keyof Shipment; label: string; type?: string; full?: boolean }) => (
    <label className={`field${full ? ' full' : ''}`}>{label}
      <input className="input" type={type} value={(f[k] as string) ?? ''} onChange={set(k)} />
    </label>
  );
  const P = ({ k, label }: { k: 'pol' | 'pod'; label: string }) => (
    <label className="field">{label}
      <select className="select" value={f[k] ?? ''} onChange={set(k)}>
        <option value="">—</option>
        {Object.entries(C.PORTS).map(([c, p]) => <option key={c} value={c}>{p.name} ({c})</option>)}
      </select>
    </label>
  );
  const valid = no ? C.validFor(mode, no) : null;

  return (
    <dialog ref={ref} onClose={onClose}>
      <form className="dlg" onSubmit={(e) => {
        e.preventDefault();
        if (!no) return;
        onSave({ ...(f as Shipment), mode, containerNo: no, stage: C.STAGE_KEYS[C.stageIndex(f.stage ?? 'booked')], lastEventAt: f.lastEventAt ?? new Date().toISOString() });
      }}>
        <h2>{existing ? '荷物を編集' : '荷物を登録'}</h2>
        <div className="fgrid">
          <label className="field full">追跡番号（コンテナ・AWB・伝票）
            <input className="input mono" value={f.containerNo ?? ''} readOnly={existing} required autoFocus
              onChange={(e) => {
                const v = e.target.value; const d = C.detect(v)[0];
                setF((cur) => ({ ...cur, containerNo: v, ...(d && !existing ? { mode: d.mode, carrier: d.mode === 'sea' || d.mode === 'air' ? cur.carrier : d.carrier } : {}) }));
              }} />
            {valid === true && <span className="hint good">番号の形式を確認しました{cand ? `（${C.MODES[cand.mode].name}${cand.carrier ? '・' + cand.carrier : ''}）` : ''}</span>}
            {valid === false && <span className="hint bad">この輸送手段の番号形式（検査数字）と一致しません。入力ミスがないか確認してください。</span>}
          </label>
          <label className="field">輸送手段
            <select className="select" value={mode} onChange={set('mode')}>
              {Object.entries(C.MODES).map(([m, v]) => <option key={m} value={m}>{v.name}</option>)}
            </select>
          </label>
          <label className="field">状態
            <select className="select" value={C.stageIndex(f.stage ?? 'booked')} onChange={(e) => setF((cur) => ({ ...cur, stage: C.STAGE_KEYS[Number(e.target.value)] }))}>
              {C.stageLabels(mode).map((st, i) => <option key={st.key} value={i}>{i + 1}. {st.label}</option>)}
            </select>
          </label>
          {T({ k: 'carrier', label: '運送会社（任意）' })}{T({ k: 'bookingNo', label: 'ブッキング番号' })}
          {T({ k: 'blNo', label: 'B/L・HAWB' })}{T({ k: 'vessel', label: '本船・便名' })}
          {T({ k: 'voyage', label: '航海・便番号' })}<div />
          {P({ k: 'pol', label: '出発港・空港' })}{P({ k: 'pod', label: '到着港・空港' })}
          {T({ k: 'etd', label: 'ETD（出発予定）', type: 'date' })}{T({ k: 'eta', label: 'ETA（到着・配達予定）', type: 'date' })}
          {T({ k: 'freeTimeEnd', label: 'フリータイム終了日', type: 'date' })}<div />
          {T({ k: 'lot', label: 'ロット番号' })}{T({ k: 'producer', label: '生産者' })}
          {T({ k: 'buyer', label: '取引先' })}<div />
          {T({ k: 'note', label: '備考', full: true })}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>キャンセル</button>
          <button type="submit" className="btn primary">保存</button>
        </div>
      </form>
    </dialog>
  );
}
