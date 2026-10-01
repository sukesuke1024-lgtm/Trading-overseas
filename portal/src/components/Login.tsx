"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { COMPANY, ROLE_LABEL } from "@/lib/data";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, STATIC, useAuth, type LoginStep } from "@/lib/auth";
import { totp } from "@/lib/totp";
import { Logo } from "./ui";

type Ok = Extract<LoginStep, { ok: true }>;

export function LoginScreen() {
  const { login, verify } = useAuth();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [step, setStep] = useState<Ok | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const submit1 = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await login(id, pw);
    setBusy(false);
    if (!r.ok) { setErr(r.error); setPw(""); return; }
    setStep(r);
  };
  const submit2 = async (e: React.FormEvent) => {
    e.preventDefault(); if (!step) return;
    setErr(""); setBusy(true);
    const r = await verify(step.ticket, code.trim());
    setBusy(false);
    if (!r.ok) { setErr(r.error); setCode(""); codeRef.current?.focus(); }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="vertical" height={120} />
          <h1 className="mt-3 text-lg font-bold">社内ポータル</h1>
          <p className="text-[12px] text-ink-3">{COMPANY.tagline}</p>
        </div>

        <div className="card p-6">
          {!step ? (
            <form onSubmit={submit1} className="space-y-4" autoComplete="on">
              <h2 className="flex items-center gap-2 font-bold"><KeyRound size={16} aria-hidden />ログイン</h2>
              <div><label className="label" htmlFor="uid">従業員番号</label><input id="uid" name="username" autoComplete="username" inputMode="text" autoCapitalize="characters" required className="input tabular" placeholder="001" value={id} onChange={(e) => setId(e.target.value)} /></div>
              <div><label className="label" htmlFor="pw">パスワード</label><input id="pw" name="password" type="password" autoComplete="current-password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
              {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
              <button className="btn btn-primary w-full !h-11" disabled={busy}>{busy ? "確認中…" : "次へ（セキュリティコード）"}</button>
              {STATIC && (
                <div className="rounded-lg bg-surface-2 p-3 text-[12.5px] leading-6 text-ink-2">
                  <b className="text-ink">デモ環境</b>（実際の認証ではありません）<br />
                  パスワード：<code className="rounded bg-white px-1">{DEMO_PASSWORD}</code><br />
                  アカウント：
                  {DEMO_ACCOUNTS.map((e) => (
                    <button type="button" key={e.id} className="ml-1 mt-1 rounded bg-white px-1.5 underline-offset-2 hover:underline" onClick={() => { setId(e.id); setPw(DEMO_PASSWORD); }}>{e.id} {e.name}（{ROLE_LABEL[e.role]}）</button>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={submit2} className="space-y-4">
              <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={16} aria-hidden />セキュリティコード</h2>
              {step.mfa === "enroll" ? <Enroll step={step} /> : (
                <p className="flex items-start gap-2 text-[13px] text-ink-2"><Smartphone size={16} className="mt-0.5 shrink-0" aria-hidden />認証アプリ（Google Authenticator 等）に表示されている6桁のコードを入力してください。</p>
              )}
              {STATIC && <DemoCode secret={step.secret!} />}
              <div><label className="label" htmlFor="otp">6桁のコード</label>
                <input id="otp" ref={codeRef} autoFocus required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" className="input tabular !h-12 text-center text-[22px] tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
              {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
              <button className="btn btn-primary w-full !h-11" disabled={busy || code.length !== 6}>{busy ? "確認中…" : "ログイン"}</button>
              <button type="button" className="w-full text-[12.5px] text-ink-3 underline-offset-2 hover:underline" onClick={() => { setStep(null); setCode(""); setErr(""); }}>最初からやり直す</button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-[11.5px] text-ink-3">社外秘。許可されていないアクセスは記録されます。</p>
      </div>
    </div>
  );
}

function Enroll({ step }: { step: Ok }) {
  const [qr, setQr] = useState("");
  useEffect(() => { if (step.otpauth) QRCode.toDataURL(step.otpauth, { margin: 1, width: 200 }).then(setQr).catch(() => {}); }, [step.otpauth]);
  return (
    <div className="space-y-2 text-[13px] text-ink-2">
      <p><b>初回のみ：認証アプリの登録</b><br />スマートフォンの認証アプリで下のQRコードを読み取り、表示された6桁のコードを入力してください。</p>
      {qr && <Image unoptimized src={qr} alt="認証アプリ登録用QRコード" width={200} height={200} className="mx-auto rounded border border-line" />}
      <p className="break-all text-center text-[12px]">読み取れない場合の手入力キー：<code className="tabular rounded bg-surface-2 px-1">{step.secret}</code></p>
      {step.defaultPassword && <p className="rounded bg-warn-soft px-2 py-1 text-warn">初期パスワードのままです。ログイン後に必ず変更してください。</p>}
    </div>
  );
}

// 静的デモ用：認証アプリの代わりに現在のコードを表示
function DemoCode({ secret }: { secret: string }) {
  const [c, setC] = useState({ code: "------", left: 30 });
  useEffect(() => {
    let alive = true;
    const tick = async () => { const code = await totp(secret); if (alive) setC({ code, left: 30 - (Math.floor(Date.now() / 1000) % 30) }); };
    tick(); const i = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(i); };
  }, [secret]);
  return (
    <div className="rounded-lg bg-surface-2 p-3 text-center text-[12.5px] text-ink-2">
      デモ用コード（本番では認証アプリが表示）<div className="tabular text-2xl font-bold tracking-[0.3em] text-ink">{c.code}</div>更新まで {c.left} 秒
    </div>
  );
}
