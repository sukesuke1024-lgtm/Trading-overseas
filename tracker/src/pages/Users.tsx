import { useCallback, useEffect, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { call, useAuth, type Role, type User } from '../lib/auth.tsx';

interface Entry { at: string; by: string; action: string; target: string; detail: string }
const ACTIONS: Record<string, string> = {
  login: 'ログイン', logout: 'ログアウト', login_fail: 'ログイン失敗', locked: 'ロック', password_change: 'パスワード変更',
  shipment_create: '荷物を登録', shipment_update: '荷物を更新', shipment_delete: '荷物を削除', shipment_import: '一括取り込み',
  user_create: 'ユーザー追加', user_reset: 'パスワード再発行', user_unlock: 'ロック解除', user_disable: 'ユーザー無効化', user_enable: 'ユーザー有効化', totp_enable: '二段階認証を登録', totp_fail: '認証コード失敗', totp_reset: '二段階認証を解除', user_role: '権限変更', init: '初期設定',
};
const ROLE: Record<Role, string> = { admin: '管理者', staff: '一般' };

export function Users({ say }: { say: (m: string) => void }) {
  const { state } = useAuth();
  const me = state.status === 'in' ? state.user.id : '';
  const [users, setUsers] = useState<User[]>([]);
  const [log, setLog] = useState<Entry[]>([]);
  const [temp, setTemp] = useState<{ id: string; pw: string } | null>(null);
  const [nid, setNid] = useState(''); const [nname, setNname] = useState(''); const [nrole, setNrole] = useState<Role>('staff');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [u, a] = await Promise.all([call<{ users: User[] }>('GET', '/api/users'), call<{ entries: Entry[] }>('GET', '/api/audit?limit=100')]);
    if (u.ok) setUsers(u.data.users);
    if (a.ok) setLog(a.data.entries);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, what: string, body?: unknown) => {
    const r = await call('POST', `/api/users/${encodeURIComponent(id)}/${what}`, body);
    if (!r.ok) { say(r.data?.error ?? '実行できませんでした'); return; }
    if (r.data.tempPassword) setTemp({ id, pw: r.data.tempPassword });
    await load();
  };

  return (
    <>
      <div className="page-head"><div><h1>ユーザー管理</h1><p>管理者のみ。入社・退社・パスワード忘れの対応と、操作履歴の確認。</p></div></div>

      {temp && (
        <div className="card tempbox" role="status">
          <b>{temp.id} の仮パスワード（この表示は一度だけです）</b>
          <div className="pwshow"><code className="mono">{temp.pw}</code>
            <button className="btn" onClick={() => { void navigator.clipboard?.writeText(temp.pw).then(() => say('コピーしました'), () => say('コピーできませんでした。手で控えてください')); }}><Copy size={14} />コピー</button>
            <button className="btn" onClick={() => setTemp(null)}>閉じる</button></div>
          <span className="muted hint">本人に安全な方法（口頭・対面など）で伝えてください。初回ログイン時に本人が変更します。</span>
        </div>
      )}

      <section className="section">
        <h2>ユーザー</h2>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>ID</th><th>氏名</th><th>権限</th><th>状態</th><th>二段階認証</th><th>操作</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td className="no">{u.id}{u.id === me && <span className="muted"> （自分）</span>}</td>
                  <td>{u.name}</td>
                  <td>{ROLE[u.role]}</td>
                  <td>{u.disabled ? <span className="pill plain">無効</span> : u.locked ? <span className="pill bad">ロック中</span> : u.mustChange ? <span className="pill warn">初回未設定</span> : <span className="pill good">有効</span>}</td>
                  <td>{u.totp ? <span className="pill good">登録済</span> : <span className="pill plain">未登録</span>}</td>
                  <td><div className="rowact">
                    <button className="btn" onClick={() => void act(u.id, 'reset')}>パスワード再発行</button>
                    {u.totp && <button className="btn" onClick={() => void act(u.id, 'reset2fa')}>二段階認証を解除</button>}
                    {u.locked && <button className="btn" onClick={() => void act(u.id, 'unlock')}>ロック解除</button>}
                    <button className="btn" disabled={u.id === me} onClick={() => void act(u.id, 'role', { role: u.role === 'admin' ? 'staff' : 'admin' })}>{u.role === 'admin' ? '一般にする' : '管理者にする'}</button>
                    {u.disabled ? <button className="btn" onClick={() => void act(u.id, 'enable')}>有効にする</button>
                      : <button className="btn danger" disabled={u.id === me} onClick={() => void act(u.id, 'disable')}>無効にする</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>ユーザーを追加</h2>
        <form className="card" style={{ padding: 16 }} onSubmit={async (e) => {
          e.preventDefault(); setErr('');
          const r = await call('POST', '/api/users', { id: nid.trim(), name: nname.trim(), role: nrole });
          if (!r.ok) { setErr(r.data?.error ?? '追加できませんでした'); return; }
          setTemp({ id: r.data.user.id, pw: r.data.tempPassword }); setNid(''); setNname(''); setNrole('staff'); await load();
        }}>
          {err && <div className="alert danger" role="alert">{err}</div>}
          <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
            <label className="field">社員ID<input className="input" value={nid} onChange={(e) => setNid(e.target.value)} required placeholder="例 003" /></label>
            <label className="field">氏名<input className="input" value={nname} onChange={(e) => setNname(e.target.value)} required /></label>
            <label className="field">権限<select className="select" value={nrole} onChange={(e) => setNrole(e.target.value as Role)}><option value="staff">一般（登録・編集）</option><option value="admin">管理者（全操作）</option></select></label>
            <button className="btn primary" type="submit"><UserPlus size={15} />追加</button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>操作履歴 <span className="muted">最新100件</span></h2>
        <div className="card table-wrap">
          {log.length === 0 ? <div className="empty">履歴はありません</div> : (
            <table>
              <thead><tr><th>日時</th><th>操作者</th><th>内容</th><th>対象</th><th className="hide-sm">詳細</th></tr></thead>
              <tbody>{log.map((e) => (
                <tr key={e.at + e.action + e.target + e.by} style={{ cursor: 'default' }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString('ja-JP', { hour12: false })}</td>
                  <td className="no">{e.by}</td><td>{ACTIONS[e.action] ?? e.action}</td><td className="mono">{e.target}</td><td className="hide-sm muted">{e.detail}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
