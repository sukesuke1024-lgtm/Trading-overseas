import { LogOut } from 'lucide-react';
import { PasswordForm } from '../components/PasswordForm.tsx';
import { useAuth } from '../lib/auth.tsx';

export function ForceChange({ name }: { name: string }) {
  const { logout } = useAuth();
  return (
    <div className="login">
      <main className="login-main" style={{ gridColumn: '1 / -1' }}>
        <div className="login-card" style={{ width: 'min(520px, 100%)' }}>
          <h1>パスワードを設定してください</h1>
          <p className="muted">{name} さん、初めてのログインです。発行されたパスワードを、ご自身だけが知るパスワードに変更してください。変更するまで他の機能は使えません。</p>
          <PasswordForm forced />
          <div className="actions"><button className="btn" onClick={() => void logout()}><LogOut size={15} />ログアウト</button></div>
        </div>
      </main>
    </div>
  );
}
