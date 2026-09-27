"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/changelog";

/** Service Worker の登録と「新しいバージョンがあります」通知 */
export function PwaUpdater() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reg: ServiceWorkerRegistration | undefined;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    };
    // バージョンごとに URL を変え、夜間の更新後に確実に新しい版を検出する
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).then((r) => {
      reg = r;
      watch(r);
    });
    let reloading = false;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    // 開きっぱなしの端末でも 1 時間ごとに更新を確認
    const t = setInterval(() => reg?.update().catch(() => undefined), 60 * 60 * 1000);
    return () => {
      clearInterval(t);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-lg bg-[#16161a] px-4 py-3 text-[13px] text-white shadow-2xl sm:left-auto sm:right-4" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex-1">
        新しいバージョンがあります
        <Link href="/history" className="ml-2 text-[12px] text-[#9ec5f4] underline">
          更新内容
        </Link>
      </div>
      <button onClick={() => setWaiting(null)} className="text-[12px] text-white/60">
        あとで
      </button>
      <button onClick={() => waiting.postMessage("SKIP_WAITING")} className="rounded bg-white px-3 py-1 text-[12.5px] font-medium text-[#16161a]">
        更新
      </button>
    </div>
  );
}
