"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PRESIDENT, SAMPLE_EMPLOYEES, type Role } from "./data";
import { base32Encode, newSecret, otpauthUri, totp, verifyTotp } from "./totp";
import { validatePin } from "./pin";

/** static: GitHub Pages 等の静的公開（デモ認証・端末内保存）／ server: 自社サーバー運用（サーバー認証・共有DB） */
export const STATIC = process.env.NEXT_PUBLIC_MODE === "static";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const DEMO_PIN = "135790";
/** デモ版（静的公開）で使えるアカウント。サーバー版は従業員マスタ（管理者が取込）がアカウントになる */
export const DEMO_ACCOUNTS = [PRESIDENT, ...SAMPLE_EMPLOYEES];
const demoRole = (id: string): Role => DEMO_ACCOUNTS.find((e) => e.id === id)?.role ?? "employee";

export type User = { id: string; role: Role };
export type LoginStep =
  | { ok: false; error: string }
  | { ok: true; ticket: string; mfa: "verify" | "enroll"; secret?: string; otpauth?: string; demoCode?: string; mustChange?: boolean; defaultPin?: boolean };

const SESSION_KEY = "hlink-portal-session";
const PINS_KEY = "hlink-demo-pins", RESETS_KEY = "hlink-demo-resets", REQS_KEY = "hlink-demo-reqs";
const lsGet = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? "null") ?? d; } catch { return d; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const checkDemoPin = (id: string, pin: string) => pin === demoPin(id);
const demoPin = (id: string) => lsGet<Record<string, string>>(PINS_KEY, {})[id] ?? DEMO_PIN;
export const demoEmailOf = (id: string) => DEMO_ACCOUNTS.find((e) => e.id === id)?.email ?? `${id}@hlink.example`;
const RESET_MIN = 15;
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
const demoSecret = (id: string) => base32Encode(new TextEncoder().encode(`hlink-demo-${id}`));

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as T };
}

type AuthCtx = {
  user: User | null;
  ready: boolean;
  mustChange: boolean;
  login: (id: string, pin: string) => Promise<LoginStep>;
  verify: (ticket: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: (all?: boolean) => Promise<void>;
  changePin: (current: string, next: string) => Promise<string | null>;
};

export type ResetResult = { ok: true; minutes: number; demoUrl?: string } | { ok: false; error: string };
/** ログイン前に使う、PIN再設定まわりの操作 */
export const resetApi = {
  /** 従業員番号＋登録メールで本人確認 → ワンタイムURLをメール送付（デモでは画面に表示） */
  async request(idRaw: string, email: string): Promise<ResetResult> {
    const id = idRaw.trim().toUpperCase();
    if (!id || !email.trim()) return { ok: false, error: "従業員番号とメールアドレスを入力してください。" };
    if (STATIC) {
      const acct = DEMO_ACCOUNTS.find((e) => e.id === id);
      if (!acct || demoEmailOf(id).toLowerCase() !== email.trim().toLowerCase()) return { ok: true, minutes: RESET_MIN }; // 登録の有無は漏らさない
      const token = newToken(), all = lsGet<Record<string, { id: string; exp: number }>>(RESETS_KEY, {});
      for (const k of Object.keys(all)) if (all[k].id === id || all[k].exp < Date.now()) delete all[k];
      all[token] = { id, exp: Date.now() + RESET_MIN * 60000 }; lsSet(RESETS_KEY, all);
      return { ok: true, minutes: RESET_MIN, demoUrl: `${BASE}/reset/?t=${token}` };
    }
    const { status, data } = await post<{ minutes?: number; error?: string }>("/api/auth/reset/request", { id, email });
    return status === 200 ? { ok: true, minutes: data.minutes ?? RESET_MIN } : { ok: false, error: data.error ?? "送信できませんでした。" };
  },
  /** 管理者（人事・情シス）へのリセット申請 */
  async contact(idRaw: string, note: string): Promise<{ ok: boolean; error?: string }> {
    const id = idRaw.trim().toUpperCase();
    if (!id) return { ok: false, error: "従業員番号を入力してください。" };
    if (STATIC) {
      const reqs = lsGet<{ id: string; note: string; at: string }[]>(REQS_KEY, []);
      if (!reqs.some((r) => r.id === id)) lsSet(REQS_KEY, [...reqs, { id, note, at: new Date().toISOString() }]);
      return { ok: true };
    }
    const { status, data } = await post<{ error?: string }>("/api/auth/reset/contact", { id, note });
    return status === 200 ? { ok: true } : { ok: false, error: data.error ?? "送信できませんでした。" };
  },
  async check(token: string): Promise<boolean> {
    if (STATIC) { const r = lsGet<Record<string, { exp: number }>>(RESETS_KEY, {})[token]; return !!r && r.exp > Date.now(); }
    return (await post<{ valid?: boolean }>("/api/auth/reset/check", { token })).data.valid === true;
  },
  async confirm(token: string, pin: string): Promise<string | null> {
    const bad = validatePin(pin);
    if (bad) return bad;
    if (STATIC) {
      const all = lsGet<Record<string, { id: string; exp: number }>>(RESETS_KEY, {}), r = all[token];
      if (!r || r.exp < Date.now()) return "このリンクは無効か、有効期限が切れています。もう一度再設定をお申し込みください。";
      lsSet(PINS_KEY, { ...lsGet<Record<string, string>>(PINS_KEY, {}), [r.id]: pin }); acctLog(r.id, "本人", "pin_reset_done");
      delete all[token]; lsSet(RESETS_KEY, all);
      return null;
    }
    const { status, data } = await post<{ error?: string }>("/api/auth/reset/confirm", { token, pin });
    return status === 200 ? null : data.error ?? "設定できませんでした。";
  },
};

export type AcctRow = { id: string; name: string; role: string; dept: string; left: string; pin: string; pinChangedAt: string; lastLoginAt: string; enrolled: boolean; locked: boolean; urlIssued: number; lastUrlAt: string; lastUrlBy: string; history: { at: string; by: string; kind: string }[] };
const ACCT_LOG = "hlink-demo-acctlog";
const acctLog = (id: string, by: string, kind: string) => lsSet(ACCT_LOG, [...lsGet<{ id: string; at: string; by: string; kind: string }[]>(ACCT_LOG, []), { id, at: new Date().toISOString(), by, kind }].slice(-500));
export type ResetReq = { id: string; name: string; note: string; at: string };
/** 管理者：PINリセット申請への対応 */
export const adminResetApi = {
  /** ID・PIN状態・再設定URL発行履歴の台帳（PINそのものは含まない） */
  async ledger(): Promise<AcctRow[]> {
    if (STATIC) {
      const pins = lsGet<Record<string, string>>(PINS_KEY, {}), log = lsGet<{ id: string; at: string; by: string; kind: string }[]>(ACCT_LOG, []);
      return DEMO_ACCOUNTS.map((e) => {
        const mine = log.filter((x) => x.id === e.id), issued = mine.filter((x) => x.kind === "pin_reset_link_issued");
        const changed = [...mine].reverse().find((x) => x.kind === "pin_reset_done" || x.kind === "pin_changed");
        return { id: e.id, name: e.name, role: e.role, dept: e.dept ?? "", left: "", pin: pins[e.id] ? "本人設定済" : "初期PIN（未変更）", pinChangedAt: changed?.at ?? "", lastLoginAt: "", enrolled: true, locked: false, urlIssued: issued.length, lastUrlAt: issued[issued.length - 1]?.at ?? "", lastUrlBy: issued[issued.length - 1]?.by ?? "", history: [...mine].reverse().slice(0, 20).map((x) => ({ at: x.at, by: x.by, kind: x.kind })) };
      });
    }
    const r = await fetch(`${BASE}/api/auth/accounts`, { credentials: "same-origin", cache: "no-store" });
    return r.ok ? ((await r.json()) as { rows: AcctRow[] }).rows : [];
  },
  async list(): Promise<{ requests: ResetReq[]; mailConfigured: boolean }> {
    if (STATIC) return { requests: lsGet<{ id: string; note: string; at: string }[]>(REQS_KEY, []).map((r) => ({ ...r, name: DEMO_ACCOUNTS.find((e) => e.id === r.id)?.name ?? "" })), mailConfigured: false };
    const r = await fetch(`${BASE}/api/auth/admin-reset`, { credentials: "same-origin", cache: "no-store" });
    return r.ok ? await r.json() : { requests: [], mailConfigured: false };
  },
  async link(id: string): Promise<{ url?: string; error?: string }> {
    if (STATIC) {
      const token = newToken(), all = lsGet<Record<string, { id: string; exp: number }>>(RESETS_KEY, {});
      all[token] = { id, exp: Date.now() + RESET_MIN * 60000 }; lsSet(RESETS_KEY, all);
      lsSet(REQS_KEY, lsGet<{ id: string }[]>(REQS_KEY, []).filter((r) => r.id !== id));
      acctLog(id, "管理者", "pin_reset_link_issued");
      return { url: `${location.origin}${BASE}/reset/?t=${token}` };
    }
    const { data } = await post<{ url?: string; error?: string }>("/api/auth/admin-reset", { action: "link", id });
    return data;
  },
  async initial(id: string): Promise<string | null> {
    if (STATIC) { const p = lsGet<Record<string, string>>(PINS_KEY, {}); delete p[id]; lsSet(PINS_KEY, p); acctLog(id, "管理者", "pin_reset_to_initial"); lsSet(REQS_KEY, lsGet<{ id: string }[]>(REQS_KEY, []).filter((r) => r.id !== id)); return null; }
    const { status, data } = await post<{ error?: string }>("/api/auth/admin-reset", { action: "initial", id });
    return status === 200 ? null : data.error ?? "失敗しました";
  },
  async dismiss(id: string): Promise<void> {
    if (STATIC) { lsSet(REQS_KEY, lsGet<{ id: string }[]>(REQS_KEY, []).filter((r) => r.id !== id)); return; }
    await post("/api/auth/admin-reset", { action: "dismiss", id });
  },
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

  const login = useCallback<AuthCtx["login"]>(async (id, pin) => {
    id = id.trim().toUpperCase();
    if (STATIC) {
      await new Promise((r) => setTimeout(r, 400));
      if (!DEMO_ACCOUNTS.some((e) => e.id === id) || pin !== demoPin(id)) return { ok: false, error: "従業員番号またはPINが正しくありません。" };
      const secret = demoSecret(id);
      return { ok: true, ticket: id, mfa: "verify", demoCode: await totp(secret), secret, otpauth: otpauthUri(id, secret) };
    }
    const { status, data } = await post<Record<string, unknown>>("/api/auth/login", { id, pin });
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

  const logout = useCallback(async (all = false) => {
    if (STATIC) localStorage.removeItem(SESSION_KEY); else await post("/api/auth/logout", { all });
    try { sessionStorage.removeItem("hlink-su"); } catch {} // PIN再入力の有効状態も破棄
    setUser(null); setMustChange(false);
  }, []);

  const changePin = useCallback(async (current: string, next: string) => {
    if (STATIC) {
      if (current !== demoPin(user?.id ?? "")) return "現在のPINが正しくありません。";
      const bad = validatePin(next); if (bad) return bad;
      lsSet(PINS_KEY, { ...lsGet<Record<string, string>>(PINS_KEY, {}), [user?.id ?? ""]: next });
      return null;
    }
    const { status, data } = await post<{ error?: string }>("/api/auth/pin", { current, next });
    if (status !== 200) return data.error ?? "変更に失敗しました。";
    setMustChange(false);
    return null;
  }, [user]);

  const v = useMemo(() => ({ user, ready, mustChange, login, verify, logout, changePin }), [user, ready, mustChange, login, verify, logout, changePin]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}

export { newSecret };
