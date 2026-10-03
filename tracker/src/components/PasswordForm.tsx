import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { call, useAuth } from '../lib/auth.tsx';

// 設定画面と、初回ログイン時の強制変更の両方で使う
export function PasswordForm({ onDone, forced }: { onDone?: () => void; forced?: boolean }) {
  const { setUser } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setErr(''); setOk(false);
      if (next !== again) { setErr('新しいパスワードが一致しません'); return; }
      setBusy(true);
      const r = await call('POST', '/api/password', { current: cur, next });
      setBusy(false);
      if (!r.ok) { setErr(r.data?.error ?? '変更できませんでした'); return; }
      setCur(''); setNext(''); setAgain(''); setOk(true);
      setUser(r.data.user); onDone?.();
    }}>
      {err && <div className="alert danger" role="alert">{err}</div>}
      {ok && <div className="alert good" role="status">パスワードを変更しました。</div>}
      <div className="fgrid" style={{ marginTop: 8 }}>
        <label className="field full">{forced ? '発行されたパスワード' : '現在のパスワード'}
          <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">新しいパスワード
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={10} />
        </label>
        <label className="field">新しいパスワード（確認）
          <input className="input" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required minLength={10} />
        </label>
      </div>
      <p className="muted hint">10文字以上で、英字と数字を含めてください。IDを含めたり、同じ文字だけにはできません。</p>
      <div className="actions"><button className="btn primary" type="submit" disabled={busy}><KeyRound size={15} />{busy ? '変更中…' : 'パスワードを変更'}</button></div>
    </form>
  );
}
