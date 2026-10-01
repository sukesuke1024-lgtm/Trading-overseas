"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, FileSpreadsheet, Lock, Plus, ShieldCheck, X } from "lucide-react";
import { EMPLOYMENT_TYPES, JOBS, PRESIDENT_ID, ROLES, ROLE_DESC, ROLE_LABEL, defaultRole, type Employee, type Role } from "@/lib/data";
import { can, PERMISSION_MATRIX } from "@/lib/perm";
import { STATIC } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

type Imported = { id: string; name: string; kana: string; employment: string; job: string; wageType: string; scheduled: number; joined?: string; left?: string; paidGranted?: number };

export default function Employees() {
  const { s, d, meId, role } = useStore();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [preview, setPreview] = useState<Imported[] | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const admin = can.manageEmployees(role);
  if (!can.viewEmployees(role)) return <div className="card p-8 text-center text-ink-2"><Lock className="mx-auto mb-2 text-ink-3" />この画面は役員・管理者のみ閲覧できます。</div>;

  const rows = s.employees.filter((e) => !q || `${e.id}${e.name}${e.kana ?? ""}${e.job}${e.employment}`.includes(q));
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
  const setRole = (id: string, r: Role) => d({ t: "emp-update", id, patch: { role: r }, by: meId });

  return (
    <div>
      <PageHeader title="従業員・権限" sub="従業員マスタ（賃金計算ブックの④従業員マスタ）と連携します。権限は「管理者／役員／従業員」の3区分で、閲覧・編集できる範囲が異なります。"
        actions={admin && <div className="flex gap-2"><input ref={file} type="file" accept=".xlsx" className="sr-only" id="emp-file" onChange={(e) => onFile(e.target.files?.[0])} /><label htmlFor="emp-file" className="btn cursor-pointer"><FileSpreadsheet size={15} />Excelから取り込む</label><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />従業員を追加</button></div>} />

      {err && <p role="alert" className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
      {!admin && <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]"><Lock size={14} aria-hidden />役員は閲覧のみです。取込・編集・権限の変更は管理者が行います。</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2"><input className="input !w-72" placeholder="番号・氏名・職種で検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} /><span className="text-[12.5px] text-ink-3">{rows.length}名</span></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]"><thead><tr><th className="th">従業員番号</th><th className="th">氏名</th><th className="th">雇用区分</th><th className="th">職種</th><th className="th text-right">所定(時間/日)</th><th className="th">入社日</th><th className="th">権限</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}>
              <td className="td tabular">{e.id}</td>
              <td className="td"><div className="font-medium">{e.name}{e.id === PRESIDENT_ID && <span className="ml-2 text-[11px] text-ink-3">社長</span>}{e.sample && <span className="ml-2"><Badge>サンプル</Badge></span>}</div>{e.kana && <div className="text-[11.5px] text-ink-3">{e.kana}</div>}</td>
              <td className="td">{e.employment}</td><td className="td">{e.job}</td><td className="td tabular text-right">{e.scheduled}</td><td className="td tabular">{e.joined?.slice(0, 10) ?? ""}</td>
              <td className="td">{admin ? (
                <select aria-label={`${e.name} の権限`} className="input !h-8 !w-28" value={e.role} disabled={e.id === PRESIDENT_ID} onChange={(ev) => setRole(e.id, ev.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              ) : <Badge tone={e.role === "admin" ? "bad" : "gray"}>{ROLE_LABEL[e.role]}</Badge>}</td>
            </tr>))}
          </tbody></table>
        {rows.length === 0 && <Empty>該当する従業員はいません</Empty>}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">{STATIC ? "デモ版のため、ログインできるのはサンプル3名と社長のみです。" : "従業員を追加・取込すると、その人のログインアカウントが自動で作られます。従業員番号と初期パスワードでログインし、初回に二要素認証の登録とパスワード変更を行います。"} 給与額・生年月日・マイナンバーなどは、ポータルには取り込みません（Excelで管理）。</p>

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
export type { Employee };
