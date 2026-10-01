"use client";

import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { cleanNum, fmtNum } from "@/lib/num";

/**
 * 数字の入力欄。入力すると自動で3桁ごとにカンマが入る（1234567 → 1,234,567）。
 * value / onChange は、カンマなしの数字の文字列（"1234567" や "12.5"）でやりとりする。
 */
export function NumInput({ value, onChange, decimals = false, className = "", ...rest }: { value: string; onChange: (raw: string) => void; decimals?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const ref = useRef<HTMLInputElement>(null);
  const digitsBefore = useRef<number | null>(null);
  // カンマが増減しても、カーソルが入力位置から動かないようにする
  useLayoutEffect(() => {
    const el = ref.current, n = digitsBefore.current;
    digitsBefore.current = null;
    if (!el || n == null || document.activeElement !== el) return;
    let seen = 0, pos = 0;
    while (pos < el.value.length && seen < n) { if (/[0-9.]/.test(el.value[pos])) seen++; pos++; }
    el.setSelectionRange(pos, pos);
  });
  return (
    <input ref={ref} type="text" inputMode={decimals ? "decimal" : "numeric"} autoComplete="off" className={`tabular ${className}`} {...rest} value={fmtNum(value)}
      onChange={(e) => { const el = e.target, caret = el.selectionStart ?? el.value.length; digitsBefore.current = el.value.slice(0, caret).replace(/[^0-9.]/g, "").length; onChange(cleanNum(el.value, decimals)); }} />
  );
}
