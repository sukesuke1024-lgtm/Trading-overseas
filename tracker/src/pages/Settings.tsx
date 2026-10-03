import { useRef, useState } from 'react';
import { Download, Upload, Save } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { markBackup, type Config } from '../lib/store.ts';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

interface Props { cfg: Config; setCfg: (c: Config) => void; list: Shipment[]; merge: (rows: Shipment[]) => number; say: (m: string) => void; setTheme: (t: 'light' | 'dark' | 'auto') => void }

export function Settings({ cfg, setCfg, list, merge, say, setTheme }: Props) {
  const [relay, setRelay] = useState(cfg.relay);
  const [token, setToken] = useState(cfg.token);
  const file = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const rows = f.name.endsWith('.json') ? (JSON.parse(text).list as Partial<Shipment>[]).map(C.migrate) : C.parseCsv(text);
      const added = merge(rows);
      say(`${rows.length} 件を取り込みました（新規 ${added} 件）`);
    } catch { say('読み込めませんでした。ファイルの形式を確認してください。'); }
    if (file.current) file.current.value = '';
  };

  return (
    <>
      <div className="page-head"><div><h1>設定</h1><p>追跡サービスとの接続、データの保存、表示。</p></div></div>
      <div className="settings">
        <section className="card">
          <h2>追跡サービスとの接続</h2>
          <p>空欄のままなら手入力で使えます。接続すると、宅配などの状態を自動で取得します。APIキーはこの画面に入力せず、サーバー側に設定します（使い方の「接続」を参照）。</p>
          <div className="fgrid">
            <label className="field full">中継サーバーのURL<input className="input" value={relay} onChange={(e) => setRelay(e.target.value)} placeholder="例 http://192.168.1.20:8080" /></label>
            <label className="field full">アクセストークン（サーバーに TRACKER_TOKEN を設定した場合）<input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></label>
          </div>
          <div className="actions"><button className="btn primary" onClick={() => { setCfg({ relay: relay.trim().replace(/\/+$/, ''), token: token.trim() }); say('接続設定を保存しました'); }}><Save size={15} />保存</button></div>
        </section>
        <section className="card">
          <h2>データの保存と復元</h2>
          <p>荷物データはこのブラウザの中にあります。週1回のバックアップを推奨します。同じ追跡番号は上書きされます。</p>
          <div className="actions">
            <button className="btn primary" onClick={() => { download(`tracker-backup-${today}.json`, JSON.stringify({ version: 2, list }, null, 1), 'application/json'); markBackup(); say('バックアップを保存しました'); }}><Download size={15} />バックアップ（JSON）</button>
            <button className="btn" onClick={() => download(`shipments-${today}.csv`, '﻿' + C.toCsv(list), 'text/csv')}><Download size={15} />CSV出力</button>
            <button className="btn" onClick={() => file.current?.click()}><Upload size={15} />取り込み（JSON・CSV）</button>
            <input ref={file} type="file" accept=".json,.csv,text/csv,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </section>
        <section className="card">
          <h2>表示</h2>
          <p>夜間や目が疲れるときは暗い表示に切り替えられます。</p>
          <div className="actions">
            <button className="btn" onClick={() => setTheme('auto')}>端末に合わせる</button>
            <button className="btn" onClick={() => setTheme('light')}>明るい</button>
            <button className="btn" onClick={() => setTheme('dark')}>暗い</button>
          </div>
        </section>
      </div>
    </>
  );
}
