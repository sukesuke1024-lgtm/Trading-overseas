"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs text-fg transition hover:bg-surface-2"
    >
      <span aria-live="polite">{done ? "Copied ✓" : "Copy code"}</span>
    </button>
  );
}
