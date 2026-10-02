"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FX_CURRENCIES, fetchLive, loadLiveConfig, saveLiveConfig, saveSnapshot, type LiveConfig, type LiveTick } from "./fx";
import { asset } from "./asset";
import type { Currency } from "./types";

/** 為替レートの自動更新（タブが見えている間、一定間隔で取得）。取得のたびに他の画面が使う保存値も更新する */
export function useLiveRates() {
  const [cfg, setCfgState] = useState<LiveConfig>(() => (typeof window === "undefined" ? { provider: "none", apiKey: "", intervalSec: 60 } : loadLiveConfig()));
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [prev, setPrev] = useState<LiveTick | null>(null);
  const [first, setFirst] = useState<LiveTick | null>(null);
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const busy = useRef(false);

  const pull = useCallback(async () => {
    if (busy.current) return; busy.current = true; setLoading(true);
    try {
      const t = await fetchLive(cfgRef.current, asset("").replace(/\/$/, ""));
      saveSnapshot(t);
      setTick((cur) => { setPrev(cur); return t; });
      setFirst((f) => f ?? t);
      setSeries((s) => { const n = { ...s }; for (const c of FX_CURRENCIES) n[c] = [...(s[c] ?? []), t.rates[c]].slice(-120); return n; });
    } finally { busy.current = false; setLoading(false); }
  }, []);

  useEffect(() => {
    pull();
    const every = Math.max(cfg.provider === "twelvedata" ? 30 : 60, cfg.intervalSec) * 1000;
    const id = setInterval(() => { if (document.visibilityState === "visible") pull(); }, every);
    const vis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [pull, cfg.provider, cfg.intervalSec, cfg.apiKey]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const setCfg = (c: LiveConfig) => { setCfgState(c); saveLiveConfig(c); };
  const change = (c: Currency) => (tick && prev ? tick.rates[c] - prev.rates[c] : 0);
  const sinceOpen = (c: Currency) => (tick && first ? tick.rates[c] - first.rates[c] : 0);
  return { cfg, setCfg, tick, prev, series, loading, pull, secondsAgo: tick ? Math.max(0, Math.round((now - tick.fetchedAt) / 1000)) : null, change, sinceOpen };
}
