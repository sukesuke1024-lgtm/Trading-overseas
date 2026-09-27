"use client";

import { useEffect } from "react";
import { reportError } from "@/components/error-reporter";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError("render", error);
  }, [error]);
  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-line bg-surface p-6 text-center">
      <div className="text-[16px] font-semibold">画面の表示中に問題が発生しました</div>
      <p className="mt-2 text-[13px] text-ink-2">不具合として自動で記録しました（取引データ・個人情報は送信していません）。修正は承認後、夜間の更新で反映されます。</p>
      <button onClick={reset} className="mt-5 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white">
        もう一度表示する
      </button>
    </div>
  );
}
