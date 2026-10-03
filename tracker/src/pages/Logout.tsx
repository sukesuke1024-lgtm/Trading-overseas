import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';

export function Logout({ onCancel }: { onCancel: () => void }) {
  const { logout, state } = useAuth();
  const name = state.status === 'in' ? state.user.name : 'デモ';
  return (
    <div className="logout-wrap">
      <section className="card logout-card" aria-labelledby="lo-h">
        <LogOut size={30} aria-hidden="true" className="muted" />
        <h1 id="lo-h">ログアウトしますか？</h1>
        <p className="muted">{name} さん、ログアウトすると、もう一度ログインが必要になります。</p>
        <ul className="muted">
          <li>入力の途中で保存していない内容は消えます。</li>
          <li>共有のパソコンでは、使い終わったら必ずログアウトしてください。</li>
        </ul>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => void logout()}><LogOut size={16} />ログアウトする</button>
          <button className="btn" onClick={onCancel}>キャンセル</button>
        </div>
      </section>
    </div>
  );
}
