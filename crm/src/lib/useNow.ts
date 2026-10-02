"use client";
import { useEffect, useState } from "react";
/** 現在時刻（一定間隔で更新）。描画中に Date.now() を呼ばないための小さなフック */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}
