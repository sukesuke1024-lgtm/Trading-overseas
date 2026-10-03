import * as C from './core.js';
import type { Shipment } from './core.js';
import type { Config } from './store.ts';

export interface RefreshResult { list: Shipment[]; changed: number; failed: number; unsupported: number }

// 中継サーバー経由で最新状態を取得。サーバー未設定の手段(501)は手入力のまま残す
export async function refreshAll(list: Shipment[], cfg: Config): Promise<RefreshResult> {
  const headers: Record<string, string> = cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {};
  let changed = 0, failed = 0, unsupported = 0;
  const out: Shipment[] = [];
  for (const s of list) {
    if (C.stageIndex(s.stage) >= 6) { out.push(s); continue; }
    try {
      const r = await fetch(`${cfg.relay}/api/track?mode=${encodeURIComponent(s.mode)}&no=${encodeURIComponent(s.containerNo)}`, { headers });
      if (r.status === 501) { unsupported++; out.push(s); continue; }
      if (!r.ok) throw new Error(String(r.status));
      const up = await r.json();
      if (up.pending) { out.push(s); continue; }
      const res = C.applyUpdate(s, up);
      if (res.changed) changed++;
      out.push(res.shipment);
    } catch { failed++; out.push(s); }
  }
  return { list: out, changed, failed, unsupported };
}
