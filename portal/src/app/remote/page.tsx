"use client";

import { useState } from "react";
import { Info, MonitorUp, Pencil, Plus, Trash2 } from "lucide-react";
import { REMOTE_KINDS, rdpFile, remoteLink, type Remote, type RemoteKind } from "@/lib/biz";
import { download } from "@/lib/csv";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Empty, PageHeader } from "@/components/ui";

const KIND_LABEL: Record<RemoteKind, string> = { RDP: "Windows リモートデスクトップ", VNC: "VNC", SSH: "SSH（ターミナル）", WEB: "ブラウザ接続（Web）" };

export default function RemotePage() {
  const { s, d, meId, role, nameOf, me } = useStore();
  const [edit, setEdit] = useState<Remote | "new" | null>(null);
  const manage = can.manageRemotes(role);
  const list = role === "employee" ? s.remotes.filter((r) => r.ownerId === meId) : s.remotes; // 従業員は自分に割り当てられた接続先だけ

  const connect = (r: Remote) => {
    const l = remoteLink(r);
    if (!l) { alert("接続先の指定が正しくありません。管理者に確認してください。"); return; }
    d({ t: "export-log", by: meId, what: `リモート接続: ${r.name}` });
    if (l.kind === "rdp") download(`${r.name.replace(/[^\w\-ぁ-ヶ一-龠]/g, "_")}.rdp`, rdpFile(r, me.id), "application/x-rdp");
    else window.open(l.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <PageHeader title="リモート接続" sub="在宅・外出先から、社内PCや業務サーバーの画面を操作するための接続先一覧です。"
        actions={manage ? <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />接続先を登録</button> : undefined} />
      <div className="mb-4 flex gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] leading-6 text-ink-2"><Info size={16} className="mt-1 shrink-0" aria-hidden /><p>このポータルは画面そのものを中継しません。「接続」を押すと、お使いの端末のリモートデスクトップ（Windows標準の「リモート デスクトップ接続」など）が開きます。<b>社内VPN（またはTailscale等）に接続した状態</b>でご利用ください。インターネットへ直接公開した接続先は登録しないでください。接続の操作は監査ログに記録されます。</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.length === 0 && <div className="card md:col-span-2"><Empty>{manage ? "接続先がまだありません。「接続先を登録」から追加し、使う人に割り当ててください。" : "あなたに割り当てられた接続先はありません。必要な場合は管理者にご相談ください。"}</Empty></div>}
        {list.map((r) => {
          const ok = !!remoteLink(r);
          return (
            <section key={r.id} className="card p-4" aria-label={r.name}>
              <div className="mb-1 flex items-start gap-2"><MonitorUp size={18} className="mt-0.5 text-brand-2" aria-hidden /><div className="min-w-0 flex-1"><h2 className="truncate font-bold">{r.name}</h2><div className="text-[12px] text-ink-3">{KIND_LABEL[r.kind]}・割り当て：{r.ownerId ? nameOf(r.ownerId) : "共用"}</div></div>
                {manage && <div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${r.name}を編集`} onClick={() => setEdit(r)}><Pencil size={13} /></button><button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${r.name}を削除`} onClick={() => confirm(`「${r.name}」を削除しますか？`) && d({ t: "remote-del", id: r.id, by: meId })}><Trash2 size={13} /></button></div>}</div>
              <div className="tabular mb-2 break-all rounded bg-surface-2 px-2 py-1 text-[12px]">{r.host}{r.port ? `:${r.port}` : ""}</div>
              {r.note && <p className="mb-2 text-[12.5px] text-ink-2">{r.note}</p>}
              {!ok && <p className="mb-2 text-[12px] text-bad">接続先の書式が正しくないため接続できません。</p>}
              <button className="btn btn-primary w-full" disabled={!ok} onClick={() => connect(r)}>{r.kind === "RDP" ? "接続（.rdp ファイルを開く）" : "接続"}</button>
            </section>
          );
        })}
      </div>
      <section className="card mt-5 p-4 text-[13px] leading-6"><h2 className="mb-1 font-bold">はじめての接続</h2>
        <ol className="list-decimal space-y-0.5 pl-5 text-ink-2"><li>社内VPNに接続する（在宅・外出先の場合）</li><li>上の「接続」を押し、ダウンロードされた .rdp ファイルを開く（Macは「Windows App」を使用）</li><li>PCのユーザー名・パスワードでサインイン（ポータルのPINとは別です）</li><li>終了時はサインアウトせず、リモート画面を閉じる前に作業内容を保存する</li></ol></section>
      {edit && <RemoteForm key={edit === "new" ? "new" : edit.id} init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function RemoteForm({ init, onClose }: { init: Remote | null; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [newId] = useState(() => `rm${Date.now()}`);
  const [f, setF] = useState({ name: init?.name ?? "", kind: (init?.kind ?? "RDP") as RemoteKind, host: init?.host ?? "", port: init?.port ? String(init.port) : "", ownerId: init?.ownerId ?? "", note: init?.note ?? "" });
  const draft: Remote = { id: "x", name: f.name, kind: f.kind, host: f.host.trim(), ...(f.port ? { port: Number(f.port) } : {}), ownerId: f.ownerId };
  const valid = !!f.name.trim() && !!remoteLink(draft) && (!f.port || (Number.isInteger(Number(f.port)) && Number(f.port) > 0 && Number(f.port) < 65536));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="接続先の登録" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault(); if (!valid) return;
        d({ t: "remote-save", by: meId, remote: { ...draft, id: init?.id ?? newId, name: f.name.trim(), ...(f.note.trim() ? { note: f.note.trim() } : {}) } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? "接続先を編集" : "接続先を登録"}</h2>
        <div><label className="label" htmlFor="rn">表示名</label><input id="rn" required maxLength={80} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="rk">接続方式</label><select id="rk" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as RemoteKind })}>{REMOTE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
          <div><label className="label" htmlFor="rp">ポート（任意）</label><input id="rp" inputMode="numeric" className="input tabular" placeholder={f.kind === "RDP" ? "3389" : ""} value={f.port} onChange={(e) => setF({ ...f, port: e.target.value.replace(/\D/g, "") })} /></div></div>
        <div><label className="label" htmlFor="rh">{f.kind === "WEB" ? "URL（https://〜）" : "ホスト名またはIPアドレス"}</label><input id="rh" required className="input tabular" placeholder={f.kind === "WEB" ? "https://remote.example.com/…" : "pc-sales-01.example.internal"} value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />{f.host && !remoteLink(draft) && <p className="mt-1 text-[12px] text-bad">{f.kind === "WEB" ? "https:// で始まるURLを入力してください" : "英数字・ドット・ハイフンのみ使えます"}</p>}</div>
        <div><label className="label" htmlFor="ro">割り当て（この人にだけ表示されます）</label><select id="ro" className="input" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">共用（役員・管理者のみ表示）</option>{s.employees.map((e) => <option key={e.id} value={e.id}>{e.id} {e.name}</option>)}</select></div>
        <div><label className="label" htmlFor="rno">メモ</label><input id="rno" maxLength={300} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <p className="text-[12px] text-ink-3">パスワードは登録しないでください。接続時に本人が入力します。</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!valid}>保存</button></div>
      </form>
    </div>
  );
}
