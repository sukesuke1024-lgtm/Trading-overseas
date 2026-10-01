"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRESIDENT, SAMPLE_EMPLOYEES, type Role } from "./data";
import { base32Encode, newSecret, otpauthUri, totp, verifyTotp } from "./totp";

/** static: GitHub Pages 等の静的公開（デモ認証・端末内保存）／ server: 自社サーバー運用（サーバー認証・共有DB） */
export const STATIC = process.env.NEXT_PUBLIC_MODE === "static";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const DEMO_PASSWORD = "Hlink-Demo-2026!";
/** デモ版（静的公開）で使えるアカウント。サーバー版は従業員マスタ（管理者が取込）がアカウントになる */
export const DEMO_ACCOUNTS = [PRESIDENT, ...SAMPLE_EMPLOYEES];
const demoRole = (id: string): Role => DEMO_ACCOUNTS.find((e) => e.id === id)?.role ?? "employee";

export type User = { id: string; role: Role };
export type LoginStep =
  | { ok: false; error: string }
  | { ok: true; ticket: string; mfa: "verify" | "enroll"; secret?: string; otpauth?: string; demoCode?: string; mustChange?: boolean; defaultPassword?: boolean };

const SESSION_KEY = "hlink-portal-session";
const demoSecret = (id: string) => base32Encode(new TextEncoder().encode(`hlink-demo-${id}`));

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as T };
}

type AuthCtx = {
  user: User | null;
  ready: boolean;
  mustChange: boolean;
  login: (id: string, password: string) => Promise<LoginStep>;
  verify: (ticket: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<string | null>;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (STATIC) {
          const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { id: string; exp: number } | null;
          if (s && s.exp > Date.now() && DEMO_ACCOUNTS.some((e) => e.id === s.id)) setUser({ id: s.id, role: demoRole(s.id) });
        } else {
          const r = await fetch(`${BASE}/api/auth/me`, { credentials: "same-origin", cache: "no-store" });
          if (r.ok) { const d = await r.json(); setUser({ id: d.id, role: d.role }); setMustChange(!!d.mustChange); }
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const login = useCallback<AuthCtx["login"]>(async (id, password) => {
    id = id.trim().toUpperCase();
    if (STATIC) {
      await new Promise((r) => setTimeout(r, 400));
      if (!DEMO_ACCOUNTS.some((e) => e.id === id) || password !== DEMO_PASSWORD) return { ok: false, error: "社員番号またはパスワードが正しくありません。" };
      const secret = demoSecret(id);
      return { ok: true, ticket: id, mfa: "verify", demoCode: await totp(secret), secret, otpauth: otpauthUri(id, secret) };
    }
    const { status, data } = await post<Record<string, unknown>>("/api/auth/login", { id, password });
    if (status !== 200) return { ok: false, error: String(data.error ?? "ログインに失敗しました。") };
    return { ok: true, ...(data as object) } as LoginStep;
  }, []);

  const verify = useCallback<AuthCtx["verify"]>(async (ticket, code) => {
    if (STATIC) {
      if (!(await verifyTotp(demoSecret(ticket), code))) return { ok: false, error: "セキュリティコードが正しくありません。" };
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: ticket, exp: Date.now() + 12 * 3600_000 }));
      setUser({ id: ticket, role: demoRole(ticket) });
      return { ok: true };
    }
    const { status, data } = await post<{ id: string; role: Role; mustChange: boolean; error?: string }>("/api/auth/verify", { ticket, code });
    if (status !== 200) return { ok: false, error: data.error ?? "認証に失敗しました。" };
    setMustChange(!!data.mustChange);
    setUser({ id: data.id, role: data.role });
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    if (STATIC) localStorage.removeItem(SESSION_KEY); else await post("/api/auth/logout", {});
    setUser(null); setMustChange(false);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const { status, data } = await post<{ error?: string }>("/api/auth/password", { current, next });
    if (status !== 200) return data.error ?? "変更に失敗しました。";
    setMustChange(false);
    return null;
  }, []);

  const v = useMemo(() => ({ user, ready, mustChange, login, verify, logout, changePassword }), [user, ready, mustChange, login, verify, logout, changePassword]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}

export { newSecret };
