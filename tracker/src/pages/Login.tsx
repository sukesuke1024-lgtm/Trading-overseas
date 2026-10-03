import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { DEMO, useAuth } from '../lib/auth.tsx';

export function Login({ notice, demo }: { notice?: string; demo?: boolean }) {
  const { login, loginTotp } = useAuth();
  const [step, setStep] = useState<'pw' | 'code'>('pw');
  const [code, setCode] = useState('');
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
        {step === 'pw' ? (
        <form className="login-card" onSubmit={async (e) => {
          e.preventDefault(); if (busy) return;
          setBusy(true); setErr('');
          const r = await login(id.trim(), pw);
          if ('totp' in r) { setStep('code'); setBusy(false); setPw(''); return; }
          if ('error' in r) { setErr(r.error); setPw(''); setBusy(false); }
        }}>
          <h1>ログイン</h1>
          {demo && (
            <div className="alert warn demo" role="note">
              <b>デモ画面です（実際の認証ではありません）</b>
              <>ID：<code className="mono">{DEMO.id}</code>　パスワード：<code className="mono">{DEMO.password}</code>
                <button type="button" className="btn" onClick={() => { setId(DEMO.id); setPw(DEMO.password); }}>入力する</button></>
            </div>
          )}
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
        ) : (
        <form className="login-card" onSubmit={async (e) => {
          e.preventDefault(); if (busy) return;
          setBusy(true); setErr('');
          const m = await loginTotp(code);
          if (m) { setErr(m); setCode(''); setBusy(false); if (/最初から|時間切れ/.test(m)) setStep('pw'); }
        }}>
          <h1>認証コードの入力</h1>
          {demo && (
            <div className="alert warn demo" role="note">
              <b>デモ画面です（実際の認証ではありません）</b>
              <>認証コード：<code className="mono">{DEMO.code}</code>
                <button type="button" className="btn" onClick={() => setCode(DEMO.code)}>入力する</button></>
            </div>
          )}
          <p className="muted" style={{ margin: 0 }}>スマートフォンの認証アプリ（Google Authenticator、Microsoft Authenticator など）に表示されている6桁の数字を入力してください。</p>
          {err && <div className="alert danger" role="alert">{err}</div>}
          <label className="field">認証コード（6桁）
            <input className="input mono code" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 7))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoFocus required />
          </label>
          <button className="btn primary wide" type="submit" disabled={busy}><LogIn size={16} />{busy ? '確認中…' : '確認してログイン'}</button>
          <button type="button" className="btn wide" onClick={() => { setStep('pw'); setErr(''); setCode(''); }}>最初に戻る</button>
          <p className="muted hint">スマートフォンを紛失した・機種変更した場合は、管理者に二段階認証の解除を依頼してください。</p>
        </form>
        )}
        <p className="ver muted">版 {__APP_VERSION__}</p>
      </main>
    </div>
  );
}
