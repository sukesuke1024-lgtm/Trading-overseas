import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';
import { markBackup } from '../lib/store.ts';
import { PasswordForm } from '../components/PasswordForm.tsx';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

interface Props { server: boolean; list: Shipment[]; merge: (rows: Shipment[]) => Promise<number>; say: (m: string) => void; setTheme: (t: 'light' | 'dark' | 'auto') => void }

export function Settings({ server, list, merge, say, setTheme }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const rows = f.name.endsWith('.json') ? (JSON.parse(text).list as Partial<Shipment>[]).map(C.migrate) : C.parseCsv(text);
      const added = await merge(rows);
      say(`${rows.length} 件を取り込みました（新規 ${added} 件）`);
    } catch { say('読み込めませんでした。ファイルの形式を確認してください。'); }
    if (file.current) file.current.value = '';
  };

  return (
    <>
      <div className="page-head"><div><h1>設定</h1><p>アカウント、データの書き出しと取り込み、表示。</p></div></div>
      <div className="settings">
        {server && (
          <section className="card">
            <h2>パスワードの変更</h2>
            <p>定期的に、または他の人に知られた可能性があるときに変更してください。変更すると、他の端末のログインは解除されます。</p>
            <PasswordForm />
          </section>
        )}
        <section className="card">
          <h2>データの書き出しと取り込み</h2>
          <p>{server ? '荷物データはサーバーに保存されています（管理者がサーバーのデータフォルダをバックアップします）。ここでは書き出しと一括取り込みができます。' : '荷物データはこのブラウザの中にあります。週1回のバックアップを推奨します。'}同じ追跡番号は上書きされます。</p>
          <div className="actions">
            <button className="btn primary" onClick={() => { download(`tracker-backup-${today}.json`, JSON.stringify({ version: 2, list }, null, 1), 'application/json'); markBackup(); say('バックアップを保存しました'); }}><Download size={15} />書き出し（JSON）</button>
            <button className="btn" onClick={() => download(`shipments-${today}.csv`, '\uFEFF' + C.toCsv(list), 'text/csv')}><Download size={15} />CSV出力</button>
            <button className="btn" onClick={() => file.current?.click()}><Upload size={15} />取り込み（JSON・CSV）</button>
            <input ref={file} type="file" accept=".json,.csv,text/csv,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
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
