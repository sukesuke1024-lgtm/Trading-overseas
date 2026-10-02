"use client";

import { useEffect, useState } from "react";

function buildDoc(code: string, origin: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${origin}/tailwind-browser.js"></script>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:center;background:#020617;font-family:ui-sans-serif,system-ui,sans-serif}</style></head><body>${code}</body></html>`;
}

export default function Preview({
  code,
  title,
  height = 260,
}: {
  code: string;
  title: string;
  height?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line bg-slate-950"
      style={{ height }}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden />}
      {origin && (
        <iframe
          title={`${title} preview`}
          sandbox="allow-scripts"
          srcDoc={buildDoc(code, origin)}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
        />
      )}
    </div>
  );
}
