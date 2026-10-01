"use client";
import { useSyncExternalStore } from "react";

/** 画面幅などの条件（例 "(min-width: 1024px)"）に合うか。サーバー描画時は false */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
