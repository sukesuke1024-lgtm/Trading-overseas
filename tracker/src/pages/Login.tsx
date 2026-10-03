import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';

export function Login({ notice }: { notice?: string }) {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login">
      <aside className="login-brand">
        <div className="brand big"><i>H</i><div>H-LINK 荷物追跡</div></div>
        <p>海上コンテナ・航空貨物・宅配を、1つの画面で。</p>
        <ul>
          <li>番号を貼るだけで輸送手段を自動判別</li>
          <li>毎朝見るのは「要対応」だけ</li>
          <li>変更はすべて履歴に残ります</li>
        </ul>
      </aside>
      <main className="login-main">
        <form className="login-card" onSubmit={async (e) => {
          e.preventDefault(); if (busy) return;
          setBusy(true); setErr('');
          const m = await login(id.trim(), pw);
          if (m) { setErr(m); setPw(''); setBusy(false); }
        }}>
          <h1>ログイン</h1>
          {notice && !err && <div className="alert warn" role="status">{notice}</div>}
          {err && <div className="alert danger" role="alert">{err}</div>}
          <label className="field">社員ID
            <input className="input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus required inputMode="text" />
          </label>
          <label className="field">パスワード
            <span className="pwrow">
              <input className="input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="btn icon" onClick={() => setShow(!show)} aria-label={show ? 'パスワードを隠す' : 'パスワードを表示'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>
          <button className="btn primary wide" type="submit" disabled={busy}><LogIn size={16} />{busy ? '確認中…' : 'ログイン'}</button>
          <p className="muted hint">IDまたはパスワードを忘れた場合は管理者に再発行を依頼してください。5回続けて間違えると15分間ロックされます。</p>
        </form>
      </main>
    </div>
  );
}
