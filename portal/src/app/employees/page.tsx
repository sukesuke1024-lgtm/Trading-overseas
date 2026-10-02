"use client";

import { Pager, usePaged } from "@/components/Pager";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, FileSpreadsheet, KeyRound, Lock, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { EMPLOYMENT_TYPES, JOBS, PRESIDENT_ID, ROLES, ROLE_DESC, ROLE_LABEL, defaultRole, type Employee, type Role } from "@/lib/data";
import { can, PERMISSION_MATRIX } from "@/lib/perm";
import { STATIC, adminResetApi, type ResetReq } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { download } from "@/lib/csv";
import { Badge, Empty, PageHeader } from "@/components/ui";

type Imported = { id: string; name: string; kana: string; employment: string; job: string; wageType: string; scheduled: number; joined?: string; left?: string; paidGranted?: number };

export default function Employees() {
  const { s, d, meId, role } = useStore();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [preview, setPreview] = useState<Imported[] | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const admin = can.manageEmployees(role);
  const rows = s.employees.filter((e) => !q || `${e.id}${e.name}${e.kana ?? ""}${e.job}${e.employment}`.includes(q));
  const pg = usePaged(rows, 10, q);
  if (!can.viewEmployees(role)) return <div className="card p-8 text-center text-ink-2"><Lock className="mx-auto mb-2 text-ink-3" />この画面は役員・管理者のみ閲覧できます。</div>;

  const norm = (n: string) => n.replace(/\s+/g, "");
  const onFile = async (f?: File) => {
    if (!f) return;
    setErr("");
    try {
      const lib = await import("@/lib/excel-link");
      setPreview(await lib.readEmployees(await f.arrayBuffer()));
    } catch (e) { setErr(e instanceof Error ? e.message : "読み取れませんでした。賃金計算ブック（④従業員マスタ）を選んでください。"); }
    if (file.current) file.current.value = "";
  };
  /** 営業CRM（別URL）が従業員名簿を一致させるための書き出し。賃金・生年月日・マイナンバー等は含めない */
  const exportRoster = () => {
    const out = { type: "hlink-roster", version: 1, exportedAt: new Date().toISOString(), employees: s.employees.filter((e) => !e.left).map((e) => ({ id: e.id, name: e.name, kana: e.kana ?? "", employment: e.employment, job: e.job, dept: e.dept ?? "", role: e.role, email: e.email ?? "", bossId: e.bossId ?? "" })) };
    download("hlink-roster.json", JSON.stringify(out, null, 2), "application/json");
  };
  const setRole = (id: string, r: Role) => d({ t: "emp-update", id, patch: { role: r }, by: meId });

  return (
    <div>
      <PageHeader title="従業員・権限" sub="従業員マスタ（賃金計算ブックの④従業員マスタ）と連携します。権限は「管理者／役員／従業員」の3区分で、閲覧・編集できる範囲が異なります。"
        actions={admin && <div className="flex gap-2"><input ref={file} type="file" accept=".xlsx" className="sr-only" id="emp-file" onChange={(e) => onFile(e.target.files?.[0])} /><label htmlFor="emp-file" className="btn cursor-pointer"><FileSpreadsheet size={15} />Excelから取り込む</label><button className="btn" onClick={exportRoster} title="営業CRMに取り込む従業員名簿（JSON）"><Download size={15} />CRM用に書き出し</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />従業員を追加</button></div>} />

      {err && <p role="alert" className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
      {!admin && <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><Lock size={14} aria-hidden />役員は閲覧のみです。取込・編集・権限の変更は管理者が行います。</p>}

      {admin && <ResetRequests onHandle={setPinFor} />}
      <div className="mb-3 flex flex-wrap items-center gap-2"><input className="input !w-72" placeholder="番号・氏名・職種で検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} /><span className="text-[12.5px] text-ink-3">{rows.length}名</span></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]"><thead><tr><th className="th">従業員番号</th><th className="th">氏名</th><th className="th">雇用区分</th><th className="th">職種</th><th className="th text-right">所定(時間/日)</th><th className="th">入社日</th><th className="th">部署</th><th className="th">権限</th>{admin && <th className="th"><span className="sr-only">操作</span></th>}</tr></thead>
          <tbody>{pg.items.map((e) => (
            <tr key={e.id}>
              <td className="td tabular">{e.id}</td>
              <td className="td"><div className="font-medium">{e.name}{e.id === PRESIDENT_ID && <span className="ml-2 text-[11px] text-ink-3">社長</span>}{e.sample && <span className="ml-2"><Badge>サンプル</Badge></span>}</div>{e.kana && <div className="text-[11.5px] text-ink-3">{e.kana}</div>}</td>
              <td className="td">{e.employment}</td><td className="td">{e.job}</td><td className="td tabular text-right">{e.scheduled}</td><td className="td tabular">{e.joined?.slice(0, 10) ?? ""}</td><td className="td">{e.dept ?? ""}</td>
              <td className="td">{admin ? (
                <select aria-label={`${e.name} の権限`} className="input !h-8 !w-28" value={e.role} disabled={e.id === PRESIDENT_ID} onChange={(ev) => setRole(e.id, ev.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              ) : <Badge tone={e.role === "admin" ? "bad" : "gray"}>{ROLE_LABEL[e.role]}</Badge>}</td>
              {admin && <td className="td"><div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${e.name}を編集`} title="編集" onClick={() => setEditing(e)}><Pencil size={13} /></button><button className="btn !h-8 !w-8 !p-0" aria-label={`${e.name}のPINを再設定`} title="PINの再設定" onClick={() => setPinFor(e.id)}><KeyRound size={13} /></button></div></td>}
            </tr>))}
          </tbody></table><Pager pg={pg} />
        {rows.length === 0 && <Empty>該当する従業員はいません</Empty>}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">{STATIC ? "デモ版のため、ログインできるのはサンプル3名と社長のみです。" : "従業員を追加・取込すると、その人のログインアカウントが自動で作られます。従業員番号と初期PINでログインし、初回に二要素認証の登録とPINの変更を行います。メールアドレスを登録すると、本人がPINを再設定できます。"} 給与額・生年月日・マイナンバーなどは、ポータルには取り込みません（Excelで管理）。</p>

      <section className="card mt-6 overflow-x-auto" aria-label="権限ごとの閲覧・編集範囲">
        <div className="border-b border-line px-4 py-3"><h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={16} aria-hidden />権限ごとの閲覧・編集範囲</h2></div>
        <table className="w-full min-w-[720px] text-[13px]"><thead><tr><th className="th">項目</th>{ROLES.slice().reverse().map((r) => <th key={r} className="th">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>{PERMISSION_MATRIX.map((m) => <tr key={m.label}><td className="td font-medium">{m.label}</td><td className="td">{m.employee}</td><td className="td">{m.executive}</td><td className="td">{m.admin}</td></tr>)}</tbody></table>
        <div className="grid gap-2 px-4 py-3 text-[12px] text-ink-2 md:grid-cols-3">{ROLES.slice().reverse().map((r) => <div key={r}><b>{ROLE_LABEL[r]}</b>：{ROLE_DESC[r]}</div>)}</div>
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="取込の確認" onClick={() => setPreview(null)}>
          <div className="card flex max-h-[85vh] w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-bold">従業員マスタの取込（{preview.length}名）</h2><button aria-label="閉じる" onClick={() => setPreview(null)}><X size={16} /></button></div>
            <div className="overflow-auto px-5 py-3">
              <table className="w-full text-[13px]"><thead><tr><th className="th">番号</th><th className="th">氏名</th><th className="th">職種</th><th className="th">雇用区分</th><th className="th">既定の権限</th><th className="th">状態</th></tr></thead>
                <tbody>{preview.map((p) => { const ex = s.employees.find((e) => norm(e.name) === norm(p.name)); return (
                  <tr key={p.id + p.name}><td className="td tabular">{ex?.id ?? p.id}</td><td className="td">{p.name}</td><td className="td">{p.job}</td><td className="td">{p.employment}</td><td className="td">{ROLE_LABEL[ex?.role ?? defaultRole(p.job, p.employment)]}</td><td className="td">{ex ? <Badge>更新</Badge> : <Badge tone="good">新規</Badge>}</td></tr>); })}</tbody></table>
              <p className="mt-3 text-[12px] text-ink-3">氏名で既存の従業員と照合します。既存の人は権限を変えずに職種などを更新し、新しい人は追加します。取込後に権限を調整してください。</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3"><button className="btn" onClick={() => setPreview(null)}>キャンセル</button>
              <button className="btn btn-primary" onClick={() => { d({ t: "emp-import", list: preview, by: meId }); setPreview(null); }}><Check size={15} />取り込む</button></div>
          </div>
        </div>
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} />}
      {editing && <EditDialog key={editing.id} emp={editing} onClose={() => setEditing(null)} />}
      {pinFor && <PinResetDialog key={pinFor} id={pinFor} onClose={() => setPinFor(null)} />}
    </div>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const { s, d, meId } = useStore();
  const nextId = String(Math.max(0, ...s.employees.map((e) => Number(e.id)).filter((n) => Number.isFinite(n) && n < 900)) + 1).padStart(3, "0");
  const [f, setF] = useState({ id: nextId, name: "", kana: "", employment: "正社員", job: "営業", scheduled: "7.5", joined: "" });
  const dup = s.employees.some((e) => e.id === f.id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="従業員を追加" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (dup) return; d({ t: "emp-import", list: [{ id: f.id, name: f.name.trim(), kana: f.kana.trim(), employment: f.employment, job: f.job, scheduled: Number(f.scheduled) || 7.5, joined: f.joined || undefined }], by: meId }); onClose(); }}>
        <h2 className="text-lg font-bold">従業員を追加</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ei">従業員番号</label><input id="ei" required pattern="[A-Za-z0-9]{1,12}" className="input tabular" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} />{dup && <p className="mt-1 text-[12px] text-bad">この番号は使われています</p>}</div>
          <div><label className="label" htmlFor="en">氏名</label><input id="en" required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="ek">フリガナ</label><input id="ek" className="input" value={f.kana} onChange={(e) => setF({ ...f, kana: e.target.value })} /></div>
          <div><label className="label" htmlFor="ej">入社日</label><input id="ej" type="date" className="input" value={f.joined} onChange={(e) => setF({ ...f, joined: e.target.value })} /></div>
          <div><label className="label" htmlFor="ee">雇用区分</label><select id="ee" className="input" value={f.employment} onChange={(e) => setF({ ...f, employment: e.target.value })}>{EMPLOYMENT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label" htmlFor="eo">職種</label><select id="eo" className="input" value={f.job} onChange={(e) => setF({ ...f, job: e.target.value })}>{JOBS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label" htmlFor="es">所定労働時間（時間/日）</label><input id="es" type="number" step="0.25" min={1} max={8} className="input tabular" value={f.scheduled} onChange={(e) => setF({ ...f, scheduled: e.target.value })} /></div>
        </div>
        <p className="text-[12px] text-ink-3">追加後、右の権限欄で「役員」「管理者」に変更できます。賃金計算ブックの④従業員マスタにも同じ氏名で登録してください（氏名で突き合わせます）。</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={dup || !f.name.trim()}>追加</button></div>
      </form>
    </div>
  );
}

function ResetRequests({ onHandle }: { onHandle: (id: string) => void }) {
  const [data, setData] = useState<{ requests: ResetReq[]; mailConfigured: boolean } | null>(null);
  useEffect(() => { let alive = true; adminResetApi.list().then((r) => alive && setData(r)); return () => { alive = false; }; }, []);
  if (!data) return null;
  return (
    <section className="card mb-4 p-4" aria-label="PINリセット申請">
      <h2 className="mb-1 flex items-center gap-2 font-bold"><KeyRound size={15} aria-hidden />PINリセット申請{data.requests.length > 0 && <Badge tone="warn">{data.requests.length}件</Badge>}</h2>
      {!data.mailConfigured && !STATIC && <p className="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">メール送信が未設定です（環境変数 PORTAL_MAIL_WEBHOOK）。本人からの「メールで再設定」は届きません。申請を受けたら、本人確認のうえ「再設定URLを発行」して直接お伝えください。</p>}
      {data.requests.length === 0 ? <p className="text-[12.5px] text-ink-3">未対応の申請はありません。本人が「ログインできない・PINをお忘れの方」から申請すると、ここに表示されます。</p> : (
        <ul className="divide-y divide-line text-[13px]">{data.requests.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 py-2"><span className="tabular w-12">{r.id}</span><b>{r.name || "（未登録の番号）"}</b><span className="flex-1 text-ink-3">{r.note || "—"}・{r.at.slice(0, 16).replace("T", " ")}</span><button className="btn !h-8" onClick={() => onHandle(r.id)}>対応する</button><button className="btn !h-8" onClick={async () => { await adminResetApi.dismiss(r.id); setData({ ...data, requests: data.requests.filter((x) => x.id !== r.id) }); }}>完了にする</button></li>)}</ul>
      )}
    </section>
  );
}

/** 本人確認のうえ、再設定URLを発行して伝える／初期PINに戻す */
function PinResetDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { s } = useStore();
  const e = s.employees.find((x) => x.id === id);
  const [url, setUrl] = useState(""), [msg, setMsg] = useState(""), [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="PINの再設定" onClick={onClose}>
      <div className="card w-full max-w-md space-y-3 p-5" onClick={(ev) => ev.stopPropagation()}>
        <h2 className="text-lg font-bold">PINの再設定：{e?.name ?? id}（{id}）</h2>
        <p className="text-[12.5px] text-ink-2">必ず本人確認（対面・社内電話・チャット等）をしてから操作してください。どちらの場合も、ログイン時は従来どおり認証アプリのコードが必要です。</p>
        <div className="rounded-lg border border-line p-3"><div className="mb-1 font-semibold">① 再設定URLを発行（15分・1回限り）</div><p className="mb-2 text-[12px] text-ink-3">本人が自分で新しいPINを決められます。URLは本人にだけ伝えてください。</p>
          {url ? <div className="space-y-2"><div className="tabular break-all rounded bg-surface-2 p-2 text-[12px]">{url}</div><button className="btn !h-8" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}><Copy size={13} />{copied ? "コピーしました" : "コピー"}</button></div>
            : <button className="btn btn-primary !h-9" onClick={async () => { const r = await adminResetApi.link(id); if (r.url) setUrl(r.url); else setMsg(r.error ?? "発行できませんでした。"); }}>URLを発行</button>}</div>
        <div className="rounded-lg border border-line p-3"><div className="mb-1 font-semibold">② 初期PINに戻す</div><p className="mb-2 text-[12px] text-ink-3">{STATIC ? "デモの初期PIN" : "環境変数 PORTAL_INITIAL_PIN の初期PIN"}に戻し、次回ログイン時に新しいPINの設定を必須にします。</p><button className="btn !h-9" onClick={async () => { if (!confirm("初期PINに戻しますか？")) return; const r = await adminResetApi.initial(id); setMsg(r ?? "初期PINに戻しました。次回ログイン時にPINの設定が必要です。"); }}>初期PINに戻す</button></div>
        {msg && <p role="status" className="text-[13px] text-ink-2">{msg}</p>}
        <div className="flex justify-end"><button className="btn" onClick={onClose}>閉じる</button></div>
      </div>
    </div>
  );
}

function EditDialog({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [f, setF] = useState({ job: emp.job, employment: emp.employment, dept: emp.dept ?? "", bossId: emp.bossId ?? "", email: emp.email ?? "", joined: emp.joined?.slice(0, 10) ?? "", scheduled: String(emp.scheduled), paid: emp.paidGranted != null ? String(emp.paidGranted) : "" });
  const cycle = (() => { let b = f.bossId; const seen = new Set([emp.id]); while (b) { if (seen.has(b)) return true; seen.add(b); b = s.employees.find((x) => x.id === b)?.bossId ?? ""; } return false; })();
  const mailOk = !f.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="従業員情報の編集" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault(); if (cycle || !mailOk) return;
        d({ t: "emp-update", id: emp.id, by: meId, patch: { job: f.job, employment: f.employment, dept: f.dept.trim() || undefined, bossId: f.bossId || undefined, email: f.email.trim() || undefined, joined: f.joined || undefined, scheduled: Number(f.scheduled) || 7.5, paidGranted: f.paid === "" ? undefined : Number(f.paid) } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{emp.name}（{emp.id}）の情報</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="xd">部署</label><input id="xd" maxLength={40} className="input" placeholder="例：営業部" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} /></div>
          <div><label className="label" htmlFor="xb">上司（報告先）</label><select id="xb" className="input" value={f.bossId} onChange={(e) => setF({ ...f, bossId: e.target.value })}><option value="">（なし）</option>{s.employees.filter((x) => x.id !== emp.id).map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}</select></div>
          <div><label className="label" htmlFor="xj">職種</label><select id="xj" className="input" value={f.job} onChange={(e) => setF({ ...f, job: e.target.value })}>{[...new Set([f.job, ...JOBS])].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label" htmlFor="xe">雇用区分</label><select id="xe" className="input" value={f.employment} onChange={(e) => setF({ ...f, employment: e.target.value })}>{[...new Set([f.employment, ...EMPLOYMENT_TYPES])].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label" htmlFor="xi">入社日</label><input id="xi" type="date" className="input" value={f.joined} onChange={(e) => setF({ ...f, joined: e.target.value })} /></div>
          <div><label className="label" htmlFor="xs">所定労働時間（時間/日）</label><input id="xs" type="number" step="0.25" min={1} max={8} className="input tabular" value={f.scheduled} onChange={(e) => setF({ ...f, scheduled: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="xm">会社メールアドレス（PIN再設定の本人確認に使用）</label><input id="xm" type="email" maxLength={120} className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />{!mailOk && <p className="mt-1 text-[12px] text-bad">メールアドレスの形式が正しくありません</p>}</div>
        <div><label className="label" htmlFor="xp">有給の付与日数（任意・今期の有効日数。空欄なら入社日から法定で自動計算）</label><input id="xp" type="number" step="0.5" min={0} max={60} className="input tabular" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></div>
        {cycle && <p role="alert" className="text-[13px] text-bad">上司の設定が循環しています。</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={cycle || !mailOk}>保存</button></div>
      </form>
    </div>
  );
}
export type { Employee };
