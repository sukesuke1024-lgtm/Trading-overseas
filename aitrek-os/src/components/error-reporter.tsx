"use client";

import { useEffect } from "react";
import { buildReport, submitReport } from "@/lib/bug-report";
import { getSupabase } from "@/lib/store/supabase";

export async function reportError(kind: "error" | "rejection" | "render", err: unknown) {
  try {
    const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
    await submitReport(buildReport(kind, err), token);
  } catch {}
}

/** 画面で発生したエラーを自動で検知して報告する */
export function ErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const onError = (e: ErrorEvent) => {
      // 拡張機能や外部スクリプトのエラーは対象外
      if (e.filename && !e.filename.startsWith(location.origin)) return;
      reportError("error", e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => reportError("rejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
