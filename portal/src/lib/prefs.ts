"use client";
// 表示の設定（ナイトモード・ブルーライトカット・文字サイズ）。端末ごとにブラウザへ保存する。
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "auto" | "night"; // auto=端末の設定に合わせる／night=19時〜6時は自動でダーク
export type Prefs = { theme: Theme; blue: 0 | 1 | 2 | 3; blueAuto: boolean; text: "normal" | "large" };
export const DEFAULT_PREFS: Prefs = { theme: "light", blue: 0, blueAuto: false, text: "normal" };
export const BLUE_ALPHA = [0, 0.1, 0.18, 0.28] as const;
export const BLUE_LABEL = ["オフ", "弱", "中", "強"] as const;
const KEY = "hlink-prefs";
export const isNight = (hour: number) => hour >= 19 || hour < 6;

export function resolve(p: Prefs, hour: number, osDark: boolean): { dark: boolean; blue: number } {
  const dark = p.theme === "dark" || (p.theme === "auto" && osDark) || (p.theme === "night" && isNight(hour));
  const blue = p.blueAuto && !isNight(hour) ? 0 : BLUE_ALPHA[p.blue];
  return { dark, blue };
}

function read(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; }
}
let cache: Prefs | null = null;
const listeners = new Set<() => void>();
const snapshot = () => (cache ??= read());
const serverSnapshot = () => DEFAULT_PREFS;
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; cb(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
export const usePrefs = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);
export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...snapshot(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  listeners.forEach((l) => l());
  applyPrefs(cache);
}
/** 画面（<html>）へ反映する */
export function applyPrefs(p: Prefs, now = new Date()) {
  const osDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const r = resolve(p, now.getHours(), osDark);
  const el = document.documentElement;
  el.dataset.theme = r.dark ? "dark" : "light";
  el.style.setProperty("--bl", String(r.blue));
  if (p.text === "large") el.dataset.text = "large"; else delete el.dataset.text;
}
/** layout.tsx の <head> に入れる、ちらつき防止の先行スクリプト（resolve と同じ判定） */
export const EARLY_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');var h=new Date().getHours();var n=h>=19||h<6;var t=p.theme||'light';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches)||(t==='night'&&n);var e=document.documentElement;e.dataset.theme=d?'dark':'light';var b=[0,.1,.18,.28][p.blue||0];if(p.blueAuto&&!n)b=0;e.style.setProperty('--bl',String(b));if(p.text==='large')e.dataset.text='large'}catch(x){}})();`;
