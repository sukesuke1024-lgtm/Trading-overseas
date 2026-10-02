"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { clearNotice, serverChangePin, serverLogin, serverVerify, useNotice, useStore } from "@/lib/store";
import { PIN_HINT, validatePin } from "@/lib/pin";
import { LoginFrame } from "./LoginFrame";

type Step = { kind: "id" } | { kind: "code"; ticket: string; enroll?: { secret: string; otpauth: string }; defaultPin: boolean };

/** サーバー版のログイン：①従業員番号＋PIN → ②認証アプリの6桁コード（初回は登録）→ ③初回はPINの変更 */
export function ServerLogin() {
  const s = useStore();
  const notice = useNotice();
  const [step, setStep] = useState<Step>({ kind: "id" });
  const [id, setId] = useState(""), [pin, setPin] = useState(""), [code, setCode] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [qr, setQr] = useState("");
  const enrollUri = step.kind === "code" ? step.enroll?.otpauth : undefined;
  useEffect(() => { if (enrollUri) QRCode.toDataURL(enrollUri, { margin: 1, width: 200 }).then(setQr).catch(() => {}); }, [enrollUri]);

  if (s.meId && s.mustChange) return <LoginFrame><ChangePin /></LoginFrame>;

  const first = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); clearNotice();
    try {
      const r = await serverLogin(id, pin);
      if (r.status !== 200) setErr(String(r.body.error ?? "ログインできませんでした。"));
      else setStep({ kind: "code", ticket: r.body.ticket as string, enroll: r.body.mfa === "enroll" ? { secret: r.body.secret as string, otpauth: r.body.otpauth as string } : undefined, defaultPin: !!r.body.defaultPin });
    } catch { setErr("サーバーに接続できません。"); }
    setBusy(false);
  };
  const second = async (e: React.FormEvent) => {
    e.preventDefault(); if (step.kind !== "code") return; setBusy(true); setErr("");
    try { const r = await serverVerify(step.ticket, code); if (r.status !== 200) { setErr(String(r.body.error ?? "確認コードが正しくありません。")); if (r.status === 401 && /有効期限/.test(String(r.body.error))) setStep({ kind: "id" }); setCode(""); } }
    catch { setErr("サーバーに接続できません。"); }
    setBusy(false);
  };

  return (
    <LoginFrame>
      {notice && <p role="status" className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">{notice}</p>}
      {step.kind === "id" && (
        <form onSubmit={first}>
          <h2 className="text-2xl font-bold tracking-tight">ログイン</h2>
          <p className="mt-1 text-[13px] text-ink-2">従業員番号とPINを入力してください（社内ポータルと同じ番号です）。</p>
          <div className="mt-6 space-y-4">
            <label className="block"><span className="label">従業員番号</span><input className="input !h-10" autoComplete="username" inputMode="numeric" autoFocus value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} placeholder="例：001" /></label>
            <label className="block"><span className="label">PIN</span><input className="input !h-10" type="password" autoComplete="current-password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setErr(""); }} placeholder="4〜8桁の数字" /></label>
          </div>
          {err && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{err}</p>}
          <button className="btn btn-primary mt-5 !h-10 w-full" type="submit" disabled={busy || !id || pin.length < 4}>次へ</button>
          <div className="mt-8 flex items-start gap-2 rounded-xl bg-surface-2 p-3.5 text-[11.5px] leading-relaxed text-ink-3"><ShieldCheck size={14} className="mt-0.5 shrink-0" />初めての方は、管理者から伝えられた初期PINでログインします。続けて、認証アプリの登録とPINの変更を行います。PINを忘れた・端末を紛失したときは、管理者に連絡してください（本人確認のうえ、リセットします）。</div>
        </form>
      )}
      {step.kind === "code" && (
        <form onSubmit={second}>
          <button type="button" onClick={() => { setStep({ kind: "id" }); setErr(""); setCode(""); }} className="mb-4 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><ArrowLeft size={13} />戻る</button>
          <h2 className="text-2xl font-bold tracking-tight">{step.enroll ? "認証アプリの登録" : "認証コード"}</h2>
          {step.enroll ? (
            <div className="mt-2 text-[13px] leading-relaxed text-ink-2">
              <p>Google Authenticator や Microsoft Authenticator で、下のQRコードを読み取り、表示された6桁のコードを入力してください。</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="認証アプリ登録用のQRコード" className="mx-auto my-3 h-[200px] w-[200px] rounded-lg border border-line bg-white p-1" />}
              <p className="break-all rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-ink-3">QRを読めないとき：手入力の鍵 <b className="num text-ink">{step.enroll.secret}</b></p>
            </div>
          ) : <p className="mt-1 text-[13px] text-ink-2">認証アプリに表示されている6桁のコードを入力してください。</p>}
          <input className="input !h-12 mt-5 text-center text-[22px] tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="000000" aria-label="認証コード" />
          {err && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{err}</p>}
          <button className="btn btn-primary mt-5 !h-10 w-full" type="submit" disabled={busy || code.length !== 6}>ログイン</button>
        </form>
      )}
    </LoginFrame>
  );
}

function ChangePin() {
  const [cur, setCur] = useState(""), [n1, setN1] = useState(""), [n2, setN2] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const why = n1 ? validatePin(n1) : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (n1 !== n2) return setErr("新しいPINが一致しません。");
    setBusy(true); setErr("");
    const r = await serverChangePin(cur, n1);
    if (r.status !== 200) setErr(String(r.body.error ?? "変更できませんでした。"));
    setBusy(false);
  };
  const num = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value.replace(/\D/g, "").slice(0, 8)); setErr(""); };
  return (
    <form onSubmit={submit}>
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><KeyRound size={22} />PINの変更</h2>
      <p className="mt-1 text-[13px] text-ink-2">初回ログインのため、自分だけのPINに変更してください。変更するまで、ほかの画面は使えません。</p>
      <div className="mt-6 space-y-4">
        <label className="block"><span className="label">現在のPIN（初期PIN）</span><input className="input !h-10" type="password" inputMode="numeric" value={cur} onChange={num(setCur)} /></label>
        <label className="block"><span className="label">新しいPIN</span><input className="input !h-10" type="password" inputMode="numeric" value={n1} onChange={num(setN1)} /><span className="mt-1 block text-[11.5px] text-ink-3">{why ?? PIN_HINT}</span></label>
        <label className="block"><span className="label">新しいPIN（確認）</span><input className="input !h-10" type="password" inputMode="numeric" value={n2} onChange={num(setN2)} /></label>
      </div>
      {err && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{err}</p>}
      <button className="btn btn-primary mt-5 !h-10 w-full" type="submit" disabled={busy || !cur || !n1 || !!why}>変更する</button>
    </form>
  );
}
