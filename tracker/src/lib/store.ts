import { useCallback, useEffect, useState } from 'react';
import * as C from './core.js';
import type { Shipment } from './core.js';

const KEY = 'hlink-tracker-v2';
const OLD = 'hlink-tracker-v1';
const CFG = 'hlink-tracker-cfg';
const BK = 'hlink-tracker-lastbackup';

export interface Config { relay: string; token: string }

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

function load(): Shipment[] {
  const t = get(KEY) ?? get(OLD);
  if (t) { try { return (JSON.parse(t) as Partial<Shipment>[]).map(C.migrate); } catch { /* 初期データへ */ } }
  return sample();
}

export function useConfig(): [Config, (c: Config) => void] {
  const [cfg, setCfg] = useState<Config>(() => {
    try { return { relay: '', token: '', ...JSON.parse(get(CFG) ?? '{}') }; } catch { return { relay: '', token: '' }; }
  });
  return [cfg, (c) => { setCfg(c); set(CFG, JSON.stringify(c)); }];
}

export function useShipments() {
  const [list, setList] = useState<Shipment[]>(load);
  useEffect(() => { set(KEY, JSON.stringify(list)); }, [list]);

  const upsert = useCallback((s: Shipment, originalNo?: string) => {
    setList((cur) => {
      const key = originalNo ?? s.containerNo;
      const i = cur.findIndex((x) => x.containerNo === key);
      if (i < 0) return [s, ...cur.filter((x) => x.containerNo !== s.containerNo)];
      const next = cur.slice(); next[i] = s; return next;
    });
  }, []);
  const remove = useCallback((no: string) => setList((cur) => cur.filter((x) => x.containerNo !== no)), []);
  const merge = useCallback((rows: Shipment[]) => {
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
  }, []);
  return { list, setList, upsert, remove, merge };
}

export function lastBackup(): number { return Number(get(BK) ?? 0); }
export function markBackup() { set(BK, String(Date.now())); }
