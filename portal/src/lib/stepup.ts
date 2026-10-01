"use client";
// ステップアップ認証：役員・部長限定のページや給与明細などを開くとき、PINを再入力して15分間だけ有効にする。
// サーバー版は署名付きクッキー（ファイルのダウンロードもサーバーが確認）、デモ版は端末内の有効期限で表す。
import { useSyncExternalStore } from "react";
import { BASE, STATIC, checkDemoPin } from "./auth";

const KEY = "hlink-su";
const TTL = 15 * 60 * 1000;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const read = (): number => { try { return Number(sessionStorage.getItem(KEY) ?? 0); } catch { return 0; } };

export const stepUpValid = () => read() > Date.now();
export function clearStepUp() { try { sessionStorage.removeItem(KEY); } catch {} emit(); }

/** PINを確認する。成功すれば null、失敗すれば理由 */
export async function stepUp(userId: string, pin: string): Promise<string | null> {
  if (STATIC) {
    if (!checkDemoPin(userId, pin)) return "PINが正しくありません。";
  } else {
    const r = await fetch(`${BASE}/api/auth/stepup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }), credentials: "same-origin" });
    if (!r.ok) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "確認できませんでした。";
  }
  try { sessionStorage.setItem(KEY, String(Date.now() + TTL)); } catch {}
  emit();
  return null;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const t = setInterval(cb, 15_000); // 有効期限が切れたら再入力を求める
  return () => { listeners.delete(cb); clearInterval(t); };
}
export const useStepUp = () => useSyncExternalStore(subscribe, () => stepUpValid(), () => false);
