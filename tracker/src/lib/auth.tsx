import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Role = 'admin' | 'staff';
export interface User { id: string; name: string; role: Role; mustChange: boolean; totp: boolean; needTotp: boolean; disabled?: boolean; locked?: boolean }
// デモ版（サーバーなし）専用。実際の認証ではないため、値は画面に表示する
export const DEMO = { id: 'demo', password: 'Demo-Pass-2026', code: '123456' };
const demoGet = () => { try { return sessionStorage.getItem('hlink-demo-in') === '1'; } catch { return false; } };
const demoSet = (v: boolean) => { try { if (v) sessionStorage.setItem('hlink-demo-in', '1'); else sessionStorage.removeItem('hlink-demo-in'); } catch { /* noop */ } };
export type LoginResult = { ok: true } | { totp: true } | { error: string };
export type AuthState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'local'; loggedIn: boolean }   // サーバーなし（静的配信・デモ）。デモ用のログイン画面を出す。実際の認証ではなく、データはブラウザ内
  | { status: 'anon'; notice?: string }
  | { status: 'in'; user: User };

export interface CallResult<T = any> { ok: boolean; status: number; data: T }

// すべてのAPI呼び出しの入口。変更系は CSRF 用ヘッダを付ける。ログイン済みなのに401なら画面をログインへ戻す
export async function call<T = any>(method: string, path: string, body?: unknown): Promise<CallResult<T>> {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Requested-With': 'tracker' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  if ((res.headers.get('content-type') ?? '').includes('json')) { try { data = await res.json(); } catch { /* 空 */ } }
  if (res.status === 401 && path !== '/api/login' && path !== '/api/me') window.dispatchEvent(new Event('tracker:unauthorized'));
  return { ok: res.ok, status: res.status, data };
}

interface Ctx { state: AuthState; login: (id: string, pw: string) => Promise<LoginResult>; loginTotp: (code: string) => Promise<string>; logout: () => Promise<void>; setUser: (u: User) => void; retry: () => void }
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error('AuthProvider が必要です'); return c; };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const probe = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const r = await call('GET', '/api/me');
      if (r.status === 200 && r.data?.user) setState({ status: 'in', user: r.data.user });
      else if (r.status === 401 && r.data) setState({ status: 'anon' });
      else if ((r.status === 200 || r.status === 404) && r.data === null) setState({ status: 'local', loggedIn: demoGet() }); // JSONを返さない静的配信＝サーバー機能なし。502等はエラー扱い
      else setState({ status: 'error' });
    } catch { setState({ status: 'error' }); }
  }, []);
  useEffect(() => { void probe(); }, [probe]);
  useEffect(() => {
    const f = () => setState((s) => (s.status === 'in' ? { status: 'anon', notice: 'ログインの有効期限が切れました。もう一度ログインしてください。' } : s));
    window.addEventListener('tracker:unauthorized', f);
    return () => window.removeEventListener('tracker:unauthorized', f);
  }, []);

  const value = useMemo<Ctx>(() => ({
    state, retry: () => void probe(),
    setUser: (user) => setState({ status: 'in', user }),
    login: async (id, pw) => {
      if (state.status === 'local') return id === DEMO.id && pw === DEMO.password ? { totp: true } : { error: 'IDまたはパスワードが違います（デモ用の値は画面に表示されています）' };
      try {
        const r = await call('POST', '/api/login', { id, password: pw });
        if (r.ok && r.data?.totp) return { totp: true };
        if (r.ok) { setState({ status: 'in', user: r.data.user }); return { ok: true }; }
        return { error: r.data?.error ?? 'ログインできませんでした' };
      } catch { return { error: 'サーバーに接続できません。ネットワークを確認してください。' }; }
    },
    loginTotp: async (code) => {
      if (state.status === 'local') { if (code.replace(/\s/g, '') !== DEMO.code) return '認証コードが違います（デモ用のコードは画面に表示されています）'; demoSet(true); setState({ status: 'local', loggedIn: true }); return ''; }
      try {
        const r = await call('POST', '/api/login/totp', { code });
        if (r.ok) { setState({ status: 'in', user: r.data.user }); return ''; }
        return r.data?.error ?? 'ログインできませんでした';
      } catch { return 'サーバーに接続できません。ネットワークを確認してください。'; }
    },
    logout: async () => { if (state.status === 'local') { demoSet(false); setState({ status: 'local', loggedIn: false }); return; } try { await call('POST', '/api/logout'); } catch { /* 切断でも画面は戻す */ } setState({ status: 'anon' }); },
  }), [state, probe]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
