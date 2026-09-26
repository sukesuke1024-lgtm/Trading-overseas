"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/store/supabase";
import { Button, Field, Input } from "./ui";

/** Supabase Auth（メール + パスワード / マジックリンク） */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const sb = getSupabase()!;
    const { error } = password
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    setMsg(error ? error.message : password ? "" : "ログイン用リンクをメールで送信しました。");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--sidebar)] p-4">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-xl bg-surface p-7 shadow-2xl">
        <div className="mb-6">
          <div className="text-[18px] font-semibold">AITREK OS</div>
          <div className="text-[12.5px] text-ink-3">社内メンバー専用ログイン</div>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint="空欄の場合はメールにログインリンクを送信します">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button variant="primary" disabled={busy} className="mt-2 h-9">
            {busy ? "送信中…" : "ログイン"}
          </Button>
          {msg && <p className="text-[12.5px] text-ink-2">{msg}</p>}
        </div>
      </form>
    </div>
  );
}
