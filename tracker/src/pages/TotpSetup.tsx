import { useEffect, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { call, useAuth } from '../lib/auth.tsx';

// 二段階認証の登録。QRコードを認証アプリで読み取り、表示された6桁を入力して有効化する
export function TotpSetup({ name }: { name: string }) {
  const { logout, setUser } = useAuth();
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await call('POST', '/api/totp/setup');
      if (!live) return;
      if (!r.ok) { setErr(r.data?.error ?? 'QRコードを作れませんでした'); return; }
      setSecret(r.data.secret);
      const QR = await import('qrcode'); // 登録画面でだけ読み込む
      const url = await QR.toDataURL(r.data.uri, { width: 224, margin: 1, errorCorrectionLevel: 'M' });
      if (live) setQr(url);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="login">
      <main className="login-main" style={{ gridColumn: '1 / -1' }}>
        <form className="login-card" style={{ width: 'min(480px, 100%)' }} onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr('');
          const r = await call('POST', '/api/totp/enable', { code });
          setBusy(false);
          if (!r.ok) { setErr(r.data?.error ?? '有効にできませんでした'); setCode(''); return; }
          setUser(r.data.user);
        }}>
          <h1>二段階認証の登録</h1>
          <p className="muted" style={{ margin: 0 }}>{name} さん、安全のため、ログイン時にスマートフォンの認証コードも使います。登録は1回だけです。</p>
          <ol className="setup-steps">
            <li>スマートフォンに <b>Google Authenticator</b> または <b>Microsoft Authenticator</b> を入れる（無料）。</li>
            <li>アプリで「＋」→「QRコードをスキャン」を選び、下のQRコードを読み取る。</li>
            <li>アプリに表示された <b>6桁の数字</b> を下に入力して「登録する」を押す。</li>
          </ol>
          <div className="qrbox">
            {qr ? <img src={qr} width={224} height={224} alt="二段階認証の登録用QRコード" /> : <div className="muted">QRコードを作成中…</div>}
          </div>
          {secret && (
            <details>
              <summary className="muted">QRコードを読み取れないとき</summary>
              <p className="hint">アプリで「セットアップキーを入力」を選び、次のキーを入力してください（時間ベース）。</p>
              <code className="mono secretkey">{secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </details>
          )}
          {err && <div className="alert danger" role="alert">{err}</div>}
          <label className="field">認証コード（6桁）
            <input className="input mono code" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 7))} autoComplete="one-time-code" inputMode="numeric" required />
          </label>
          <button className="btn primary wide" type="submit" disabled={busy || !secret}><ShieldCheck size={16} />{busy ? '確認中…' : '登録する'}</button>
          <button type="button" className="btn wide" onClick={() => void logout()}><LogOut size={15} />ログアウト</button>
          <p className="muted hint">QRコードは他の人に見せないでください。スマートフォンを替えるときは、管理者に解除を依頼して再登録します。</p>
        </form>
      </main>
    </div>
  );
}
