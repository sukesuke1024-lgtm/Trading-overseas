"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LifeBuoy, Mail, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { COMPANY, ROLE_LABEL } from "@/lib/data";
import { BASE, DEMO_ACCOUNTS, DEMO_PIN, STATIC, demoEmailOf, resetApi, useAuth, type LoginStep } from "@/lib/auth";
import { PIN_HINT } from "@/lib/pin";
import { totp } from "@/lib/totp";
import { Logo } from "./ui";
import { SettingsButton } from "./Settings";

type Ok = Extract<LoginStep, { ok: true }>;
type View = "id" | "pin" | "code" | "help";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      <div className="fixed right-3 top-3"><SettingsButton /></div>
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="vertical" height={120} />
          <h1 className="mt-3 text-lg font-bold">社内ポータル</h1>
          <p className="text-[12px] text-ink-3">{COMPANY.tagline}</p>
        </div>
        <div className="card p-6">{children}</div>
        <p className="mt-4 text-center text-[11.5px] text-ink-3">社外秘。許可されていないアクセスは記録されます。<br /><span className="tabular">{COMPANY.version}</span></p>
      </div>
    </div>
  );
}
const Err = ({ children }: { children: React.ReactNode }) => <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{children}</p>;

/** PIN入力（数字のみ・表示/非表示つき） */
function PinInput({ id, value, onChange, autoComplete = "current-password", autoFocus = false, label }: { id: string; value: string; onChange: (v: string) => void; autoComplete?: string; autoFocus?: boolean; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} name={id} type={show ? "text" : "password"} inputMode="numeric" pattern="\d{4,8}" minLength={4} maxLength={8} autoComplete={autoComplete} autoFocus={autoFocus} required className="input tabular !pr-11 text-[18px] tracking-[0.3em]" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3" onClick={() => setShow(!show)} aria-label={show ? "PINを隠す" : "PINを表示"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
      </div>
    </div>
  );
}
export { PinInput, Frame as AuthFrame, Err as AuthErr };

export function LoginScreen() {
  const { login, verify } = useAuth();
  const [view, setView] = useState<View>("id");
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Ok | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const toPin = (e: React.FormEvent) => { e.preventDefault(); if (id.trim()) { setErr(""); setView("pin"); } };
  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await login(id, pin);
    setBusy(false);
    if (!r.ok) { setErr(r.error); setPin(""); return; }
    setStep(r); setView("code");
  };
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault(); if (!step) return;
    setErr(""); setBusy(true);
    const r = await verify(step.ticket, code.trim());
    setBusy(false);
    if (!r.ok) { setErr(r.error); setCode(""); codeRef.current?.focus(); }
  };
  const restart = () => { setView("id"); setPin(""); setCode(""); setStep(null); setErr(""); };
  const help = () => { setErr(""); setView("help"); };

  if (view === "help") return <Frame><Help initialId={id} onBack={() => setView(id ? "pin" : "id")} /></Frame>;

  return (
    <Frame>
      {view === "id" && (
        <form onSubmit={toPin} className="space-y-4" autoComplete="on">
          <h2 className="flex items-center gap-2 font-bold"><UserRound size={16} aria-hidden />ログイン</h2>
          <div><label className="label" htmlFor="uid">従業員番号（ID）</label><input id="uid" name="username" autoComplete="username" autoFocus inputMode="text" autoCapitalize="characters" required className="input tabular" placeholder="例：001" value={id} onChange={(e) => setId(e.target.value)} /></div>
          <button className="btn btn-primary w-full !h-11" disabled={!id.trim()}>次へ（PINの入力）</button>
          <HelpLink onClick={help} />
          {STATIC && <DemoBox onPick={(v) => { setId(v); setView("pin"); }} />}
        </form>
      )}
      {view === "pin" && (
        <form onSubmit={submitPin} className="space-y-4">
          <h2 className="flex items-center gap-2 font-bold"><KeyRound size={16} aria-hidden />PINの入力</h2>
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><span>従業員番号 <b className="tabular">{id.trim().toUpperCase()}</b></span><button type="button" className="text-ink-3 underline-offset-2 hover:underline" onClick={restart}>変更</button></div>
          <PinInput id="pin" value={pin} onChange={setPin} autoFocus label="PIN（4〜8桁の数字）" />
          {err && <Err>{err}</Err>}
          <button className="btn btn-primary w-full !h-11" disabled={busy || pin.length < 4}>{busy ? "確認中…" : "次へ（セキュリティコード）"}</button>
          <HelpLink onClick={help} />
          {STATIC && <p className="rounded-lg bg-surface-2 p-3 text-[12.5px] text-ink-2"><b className="text-ink">デモ環境</b>：初期PINは <code className="rounded bg-surface px-1">{DEMO_PIN}</code></p>}
        </form>
      )}
      {view === "code" && step && (
        <form onSubmit={submitCode} className="space-y-4">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={16} aria-hidden />セキュリティコード</h2>
          {step.mfa === "enroll" ? <Enroll step={step} /> : (
            <p className="flex items-start gap-2 text-[13px] text-ink-2"><Smartphone size={16} className="mt-0.5 shrink-0" aria-hidden />認証アプリ（Google Authenticator 等）に表示されている6桁のコードを入力してください。</p>
          )}
          {STATIC && <DemoCode secret={step.secret!} />}
          <div><label className="label" htmlFor="otp">6桁のコード</label>
            <input id="otp" ref={codeRef} autoFocus required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" className="input tabular !h-12 text-center text-[22px] tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          {err && <Err>{err}</Err>}
          <button className="btn btn-primary w-full !h-11" disabled={busy || code.length !== 6}>{busy ? "確認中…" : "ログイン"}</button>
          <button type="button" className="w-full text-[12.5px] text-ink-3 underline-offset-2 hover:underline" onClick={restart}>最初からやり直す</button>
          <p className="text-center text-[12px] text-ink-3">認証アプリが使えない場合は、{COMPANY.helpdesk}へご連絡ください。</p>
        </form>
      )}
    </Frame>
  );
}

function HelpLink({ onClick }: { onClick: () => void }) {
  return <button type="button" className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-brand-2 underline-offset-2 hover:underline" onClick={onClick}><LifeBuoy size={14} aria-hidden />ログインできない・PINをお忘れの方はこちら</button>;
}

function DemoBox({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3 text-[12.5px] leading-6 text-ink-2">
      <b className="text-ink">デモ環境</b>（実際の認証ではありません）<br />
      アカウント：
      {DEMO_ACCOUNTS.map((e) => (
        <button type="button" key={e.id} className="ml-1 mt-1 rounded bg-surface px-1.5 underline-offset-2 hover:underline" onClick={() => onPick(e.id)}>{e.id} {e.name}（{ROLE_LABEL[e.role]}）</button>
      ))}
    </div>
  );
}

/** ログインできない・PINを忘れた：①メールで再設定 ②管理者へ申請 */
function Help({ initialId, onBack }: { initialId: string; onBack: () => void }) {
  const [tab, setTab] = useState<"mail" | "admin">("mail");
  const [id, setId] = useState(initialId);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { kind: "mail"; minutes: number; demoUrl?: string } | { kind: "admin" }>(null);

  const sendMail = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await resetApi.request(id, email);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setDone({ kind: "mail", minutes: r.minutes, demoUrl: r.demoUrl });
  };
  const sendAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await resetApi.contact(id, note);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "送信できませんでした。"); return; }
    setDone({ kind: "admin" });
  };

  if (done) {
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} className="text-good" aria-hidden />{done.kind === "mail" ? "受け付けました" : "管理者へ申請しました"}</h2>
        {done.kind === "mail" ? (
          <>
            <p className="text-[13px] leading-6 text-ink-2">入力内容が登録情報と一致した場合、<b>再設定用のURL</b>を登録メールアドレスへお送りします（{done.minutes}分以内・1回のみ有効）。メールが届かない場合は、迷惑メールフォルダをご確認のうえ、「管理者へリセット申請」をご利用ください。</p>
            {done.demoUrl && <div className="rounded-lg bg-surface-2 p-3 text-[12.5px] leading-6"><b>デモ環境</b>：メールの代わりに、再設定URLを表示します。<br /><Link href={done.demoUrl.replace(BASE, "") || "/"} className="break-all font-medium text-brand-2 underline">再設定ページを開く</Link></div>}
          </>
        ) : (
          <p className="text-[13px] leading-6 text-ink-2">{COMPANY.helpdesk}が本人確認のうえ、再設定の手順をご案内します（内線・チャット・対面など、普段の連絡手段でご連絡ください）。</p>
        )}
        <button className="btn w-full" onClick={onBack}><ArrowLeft size={14} />ログイン画面へ戻る</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-bold"><LifeBuoy size={16} aria-hidden />ログインできない・PINをお忘れの方</h2>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-[13px]" role="tablist">
        {([["mail", "メールで再設定"], ["admin", "管理者へ申請"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(""); }} className={`rounded-md py-1.5 ${tab === k ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>{l}</button>)}
      </div>
      {tab === "mail" ? (
        <form onSubmit={sendMail} className="space-y-3">
          <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] leading-5 text-ink-2"><li>従業員番号と、登録済みの会社メールアドレスを入力して送信</li><li>メールに届く再設定URL（{15}分有効・1回限り）を開く</li><li>新しいPIN（4〜8桁の数字）を設定</li></ol>
          <div><label className="label" htmlFor="hid">従業員番号</label><input id="hid" required className="input tabular" autoCapitalize="characters" value={id} onChange={(e) => setId(e.target.value)} /></div>
          <div><label className="label" htmlFor="hem">登録済みのメールアドレス</label><input id="hem" type="email" required autoComplete="email" className="input" placeholder="name@company.example" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {err && <Err>{err}</Err>}
          <button className="btn btn-primary w-full !h-11" disabled={busy}><Mail size={15} />{busy ? "送信中…" : "再設定のメールを送る"}</button>
          {STATIC && <p className="text-[12px] text-ink-3">デモ：メールアドレスは <code>{demoEmailOf(id || "902")}</code> のように「従業員番号@hlink.example」です。</p>}
        </form>
      ) : (
        <form onSubmit={sendAdmin} className="space-y-3">
          <p className="text-[12.5px] leading-5 text-ink-2">メールが届かない・メールアドレスが未登録・認証アプリを紛失した場合は、{COMPANY.helpdesk}へリセットを申請してください。本人確認のうえで対応します。</p>
          <div><label className="label" htmlFor="aid">従業員番号</label><input id="aid" required className="input tabular" autoCapitalize="characters" value={id} onChange={(e) => setId(e.target.value)} /></div>
          <div><label className="label" htmlFor="ano">状況（任意）</label><textarea id="ano" rows={3} maxLength={300} className="input" placeholder="例：メールが届かない／認証アプリのスマホを紛失" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {err && <Err>{err}</Err>}
          <button className="btn btn-primary w-full !h-11" disabled={busy}>{busy ? "送信中…" : "管理者へリセットを申請する"}</button>
          <p className="text-[12px] text-ink-3">お急ぎの場合は、{COMPANY.helpdesk}へ直接ご連絡ください。</p>
        </form>
      )}
      <button type="button" className="flex w-full items-center justify-center gap-1 text-[12.5px] text-ink-3 underline-offset-2 hover:underline" onClick={onBack}><ArrowLeft size={13} />ログイン画面へ戻る</button>
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
      {step.defaultPin && <p className="rounded bg-warn-soft px-2 py-1 text-warn">初期PINのままです。ログイン後、新しいPINの設定が必要です。</p>}
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

// ---------- 再設定ページ（メールのURLから開く） ----------
const noop = () => () => {};
export function ResetScreen() {
  const token = useSyncExternalStore(noop, () => new URLSearchParams(location.search).get("t") ?? "", () => "");
  const [valid, setValid] = useState<boolean | null>(null);
  const [pin, setPin] = useState(""), [pin2, setPin2] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  useEffect(() => { if (token) resetApi.check(token).then(setValid); }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (pin !== pin2) { setErr("確認用のPINが一致しません。"); return; }
    setBusy(true);
    const r = await resetApi.confirm(token, pin);
    setBusy(false);
    if (r) { setErr(r); return; }
    setDone(true);
  };
  const toLogin = <Link href="/" className="btn btn-primary w-full !h-11">ログイン画面へ</Link>;
  return (
    <Frame>
      {done ? (
        <div className="space-y-4"><h2 className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} className="text-good" aria-hidden />PINを設定しました</h2><p className="text-[13px] text-ink-2">新しいPINでログインしてください（従来どおり、認証アプリのセキュリティコードも必要です）。</p>{toLogin}</div>
      ) : !token || valid === false ? (
        <div className="space-y-4"><h2 className="font-bold">このリンクは使えません</h2><p className="text-[13px] leading-6 text-ink-2">リンクが無効か、有効期限（15分）が切れているか、すでに使用されています。もう一度、ログイン画面の「ログインできない・PINをお忘れの方はこちら」からお申し込みください。</p>{toLogin}</div>
      ) : valid === null ? <p className="py-6 text-center text-ink-3">確認中…</p> : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="flex items-center gap-2 font-bold"><KeyRound size={16} aria-hidden />新しいPINの設定</h2>
          <p className="text-[12.5px] text-ink-2">{PIN_HINT}</p>
          <PinInput id="np1" value={pin} onChange={setPin} autoComplete="new-password" autoFocus label="新しいPIN" />
          <PinInput id="np2" value={pin2} onChange={setPin2} autoComplete="new-password" label="新しいPIN（確認）" />
          {err && <Err>{err}</Err>}
          <button className="btn btn-primary w-full !h-11" disabled={busy || pin.length < 4}>{busy ? "設定中…" : "PINを設定する"}</button>
        </form>
      )}
    </Frame>
  );
}
