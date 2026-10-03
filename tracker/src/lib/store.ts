import { useCallback, useEffect, useRef, useState } from 'react';
import * as C from './core.js';
import type { Shipment } from './core.js';
import { call } from './auth.tsx';

const KEY = 'hlink-tracker-v2';
const OLD = 'hlink-tracker-v1';
const BK = 'hlink-tracker-lastbackup';

function get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 保存不可でも動く */ } }
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function sample(): Shipment[] {
  return [
    { mode: 'sea', containerNo: 'CSQU3054383', bookingNo: 'BK-0001', pol: 'JPYOK', pod: 'SGSIN', etd: day(-5), eta: day(5), stage: 'in_transit', vessel: 'EXAMPLE EXPRESS', voyage: '041E', lot: 'LOT-2610-A', producer: 'サンプル水産', buyer: 'Sample Trading Pte', note: '冷凍 -18℃（サンプル）' },
    { mode: 'air', containerNo: '13112345675', pol: 'NRT', pod: 'LAX', etd: day(-1), eta: day(1), stage: 'in_transit', lot: 'LOT-2610-A', producer: 'サンプル水産', buyer: 'LA Demo Inc', note: '生鮮・空輸（サンプル）' },
    { mode: 'domestic', containerNo: '100000000004', carrier: 'ヤマト運輸', eta: day(1), stage: 'in_transit', lot: 'LOT-2609-C', buyer: '国内サンプル商店', note: 'サンプル' },
    { mode: 'sea', containerNo: 'MSKU0000000', pol: 'JPNGO', pod: 'HKHKG', etd: day(-12), eta: day(-2), stage: 'in_transit', lot: 'LOT-2609-C', buyer: 'HK Demo Ltd', note: 'ETA超過の例（番号は架空）' },
  ];
}

function loadLocal(): Shipment[] {
  const t = get(KEY) ?? get(OLD);
  if (t) { try { return (JSON.parse(t) as Partial<Shipment>[]).map(C.migrate); } catch { /* 初期データへ */ } }
  return sample();
}

// server=true: 荷物はサーバー保存（ログイン必須・変更履歴つき）。false: ブラウザ内保存（サーバーなしのデモ）
export function useShipments(server: boolean, say: (m: string) => void) {
  const [list, setList] = useState<Shipment[]>(() => (server ? [] : loadLocal()));
  const [loading, setLoading] = useState(server);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!server) set(KEY, JSON.stringify(list)); }, [list, server]);

  const reload = useCallback(async () => {
    const r = await call<{ shipments: Shipment[]; error?: string }>('GET', '/api/shipments');
    if (!alive.current) return;
    if (r.ok) setList(r.data.shipments.map(C.migrate)); else if (r.status !== 401) say(r.data?.error ?? '荷物の取得に失敗しました');
    setLoading(false);
  }, [say]);
  // サーバー版は表示時と60秒ごとに再取得（他の人の更新を反映）
  useEffect(() => {
    if (!server) return;
    void reload();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 60000);
    return () => clearInterval(t);
  }, [server, reload]);

  const upsert = useCallback(async (s: Shipment, originalNo?: string) => {
    setList((cur) => {
      const key = originalNo ?? s.containerNo;
      const i = cur.findIndex((x) => x.containerNo === key);
      if (i < 0) return [s, ...cur.filter((x) => x.containerNo !== s.containerNo)];
      const next = cur.slice(); next[i] = s; return next;
    });
    if (!server) return true;
    const r = await call('POST', '/api/shipments', { shipment: s, originalNo });
    if (!r.ok) { say(r.data?.error ?? '保存に失敗しました'); await reload(); return false; }
    return true;
  }, [server, say, reload]);

  const remove = useCallback(async (no: string) => {
    setList((cur) => cur.filter((x) => x.containerNo !== no));
    if (!server) return;
    const r = await call('DELETE', `/api/shipments/${encodeURIComponent(no)}`);
    if (!r.ok) { say(r.data?.error ?? '削除に失敗しました'); await reload(); }
  }, [server, say, reload]);

  const merge = useCallback(async (rows: Shipment[]): Promise<number> => {
    if (server) {
      const r = await call<{ added: number; error?: string }>('POST', '/api/shipments/bulk', { rows });
      if (!r.ok) { say(r.data?.error ?? '取り込みに失敗しました'); return 0; }
      await reload(); return r.data.added;
    }
    let added = 0;
    setList((cur) => {
      const next = cur.slice();
      for (const r of rows) {
        const i = next.findIndex((x) => x.containerNo === r.containerNo);
        if (i >= 0) next[i] = { ...next[i], ...r }; else { next.push(r); added++; }
      }
      return next;
    });
    return added;
  }, [server, say, reload]);

  // 追跡サービスから得た更新分を反映（サーバー版は1件ずつ保存）
  const replaceMany = useCallback(async (rows: Shipment[]) => {
    if (!rows.length) return;
    setList((cur) => cur.map((x) => rows.find((r) => r.containerNo === x.containerNo) ?? x));
    if (server) for (const r of rows) await call('POST', '/api/shipments', { shipment: r });
  }, [server]);

  return { list, loading, upsert, remove, merge, replaceMany, reload };
}

export function lastBackup(): number { return Number(get(BK) ?? 0); }
export function markBackup() { set(BK, String(Date.now())); }
