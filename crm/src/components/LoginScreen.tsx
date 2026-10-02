"use client";
import { useState } from "react";
import { ArrowLeft, Globe2, ShieldCheck } from "lucide-react";
import { login, useStore } from "@/lib/store";
import { Avatar, ROLE_LABEL } from "./ui";

/** モック認証画面。本番では Supabase Auth（Email+パスワード／パスワード再設定／ログイン試行制御）に置き換える。 */
export function LoginScreen() {
  const s = useStore();
  const [mode, setMode] = useState<"login" | "reset" | "sent">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const users = s.data!.users;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((x) => x.email === email.trim());
    if (!u) { setErr("メールアドレスまたはパスワードが正しくありません。（デモ：右の一覧から選択できます）"); return; }
    login(u.id);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#101a2b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(900px 500px at 15% 10%, #24467a 0%, transparent 60%), radial-gradient(700px 500px at 90% 95%, #1d5a6b 0%, transparent 55%)" }} />
        <svg className="absolute inset-0 h-full w-full opacity-[.07]" aria-hidden><defs><pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>
        <div className="relative flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/12"><Globe2 size={20} /></span><span className="text-lg font-bold tracking-wide">AITREK CRM</span></div>
        <div className="relative max-w-md">
          <p className="mb-3 text-xs font-semibold tracking-[.18em] text-white/55">SALES OPERATING SYSTEM</p>
          <h1 className="text-[34px] font-bold leading-[1.25] tracking-tight">次に誰へ、何をするか。<br />迷わない営業へ。</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/70">顧客 × 案件 × 活動 × Next Action を一つに。海外バイヤーとの商談を、期限と担当者つきで前に進めます。</p>
        </div>
        <p className="relative text-xs text-white/45">© AITREK — 社内専用システム</p>
      </div>

      <div className="grid place-items-center px-5 py-10">
        <div className="anim-rise w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-ink"><Globe2 size={17} /></span><span className="font-bold">AITREK CRM</span></div>
          {mode === "login" && (
            <form onSubmit={submit}>
              <h2 className="text-2xl font-bold tracking-tight">ログイン</h2>
              <p className="mt-1 text-[13px] text-ink-2">社内アカウントでサインインしてください。</p>
              <div className="mt-6 space-y-4">
                <label className="block"><span className="label">メールアドレス</span><input className="input !h-10" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="name@example.com" /></label>
                <label className="block"><span className="label">パスワード</span><input className="input !h-10" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></label>
              </div>
              {err && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{err}</p>}
              <button className="btn btn-primary mt-5 !h-10 w-full" type="submit">ログイン</button>
              <button type="button" onClick={() => setMode("reset")} className="mt-3 w-full text-center text-xs text-ink-2 hover:text-ink">パスワードをお忘れですか？</button>

              <div className="mt-8 rounded-xl bg-surface-2 p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-2"><ShieldCheck size={13} />デモ：ユーザーを選んでログイン（権限の違いを確認できます）</div>
                <div className="space-y-1">
                  {users.map((u) => (
                    <button key={u.id} type="button" onClick={() => login(u.id)} className="flex w-full items-center gap-2.5 rounded-lg bg-surface px-2.5 py-1.5 text-left shadow-[var(--shadow)] hover:bg-bg">
                      <Avatar user={u} size={24} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{u.name}</span><span className="block truncate text-[11px] text-ink-3">{u.title}</span></span>
                      <span className="chip chip-accent">{ROLE_LABEL[u.role]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
          {mode === "reset" && (
            <form onSubmit={(e) => { e.preventDefault(); setMode("sent"); }}>
              <button type="button" onClick={() => setMode("login")} className="mb-4 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><ArrowLeft size={13} />ログインへ戻る</button>
              <h2 className="text-2xl font-bold tracking-tight">パスワードの再設定</h2>
              <p className="mt-1 text-[13px] text-ink-2">登録メールアドレスに再設定用のリンクを送ります。</p>
              <label className="mt-6 block"><span className="label">メールアドレス</span><input required className="input !h-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <button className="btn btn-primary mt-5 !h-10 w-full" type="submit">再設定リンクを送る</button>
            </form>
          )}
          {mode === "sent" && (
            <div>
              <h2 className="text-2xl font-bold tracking-tight">メールを送信しました</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{email} 宛に再設定用のリンクを送りました（デモ画面のため実際には送信されません）。メールが届かない場合は管理者へご連絡ください。</p>
              <button className="btn mt-5 !h-10 w-full" onClick={() => setMode("login")}>ログインへ戻る</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
