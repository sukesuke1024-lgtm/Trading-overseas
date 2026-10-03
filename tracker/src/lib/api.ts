import * as C from './core.js';
import type { Shipment } from './core.js';
import { call } from './auth.tsx';

export interface RefreshResult { changedList: Shipment[]; failed: number; unsupported: number; targets: number }

// ログイン中のサーバー経由で最新状態を取得する。サーバー未設定の手段(501)は手入力のまま残す
export async function refreshAll(list: Shipment[]): Promise<RefreshResult> {
  const changedList: Shipment[] = [];
  let failed = 0, unsupported = 0, targets = 0;
  for (const s of list) {
    if (C.stageIndex(s.stage) >= 6) continue;
    targets++;
    try {
      const r = await call('GET', `/api/track?mode=${encodeURIComponent(s.mode)}&no=${encodeURIComponent(s.containerNo)}`);
      if (r.status === 501) { unsupported++; continue; }
      if (!r.ok) throw new Error(String(r.status));
      if (!r.data || r.data.pending) continue;
      const res = C.applyUpdate(s, r.data);
      if (res.changed) changedList.push(res.shipment);
    } catch { failed++; }
  }
  return { changedList, failed, unsupported, targets };
}
