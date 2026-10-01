"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addMonths, kpiAttainment, type Kpi } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, Progress } from "@/components/ui";

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 2 }));

export default function KpiPage() {
  const { s, role, meId } = useStore();
  const [month, setMonth] = useState(ymd(new Date()).slice(0, 7));
  const [edit, setEdit] = useState<Kpi | "new" | null>(null);
  const manage = can.manageKpis(role);
  const list = role === "employee" ? s.kpis.filter((k) => !k.ownerId || k.ownerId === meId) : s.kpis; // 従業員は全社KPIと自分のKPIだけ（サーバー版は届く時点で絞り込み済み）
  const company = list.filter((k) => !k.ownerId), personal = list.filter((k) => k.ownerId);
  const hit = list.filter((k) => kpiAttainment(k, month).ok === true).length, entered = list.filter((k) => kpiAttainment(k, month).actual != null).length;

  return (
    <div>
      <PageHeader title="KPI管理" sub="目標と月ごとの実績を管理します。担当者は自分のKPIの実績を入力できます。"
        actions={<div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1"><button className="btn !h-9 !w-9 !p-0" aria-label="前月" onClick={() => setMonth(addMonths(month, -1))}>‹</button><span className="tabular min-w-24 text-center font-bold">{month.slice(0, 4)}年{Number(month.slice(5))}月</span><button className="btn !h-9 !w-9 !p-0" aria-label="翌月" onClick={() => setMonth(addMonths(month, 1))}>›</button></div>{manage && <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />KPIを登録</button>}</div>} />
      {list.length > 0 && <p className="mb-3 text-[13px] text-ink-2">{month.slice(5)}月：入力済み {entered}/{list.length}・達成 {hit}</p>}
      {list.length === 0 && <div className="card"><Empty>{manage ? "KPIがまだありません。「KPIを登録」から追加してください。" : "表示できるKPIはありません。"}</Empty></div>}
      <KpiTable title="全社KPI" rows={company} month={month} onEdit={setEdit} /><KpiTable title={role === "employee" ? "あなたのKPI" : "個人・チームのKPI"} rows={personal} month={month} onEdit={setEdit} />
      {edit && <KpiForm key={edit === "new" ? "new" : edit.id} init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function KpiRow({ k, month, onEdit }: { k: Kpi; month: string; onEdit: (k: Kpi) => void }) {
  const { d, meId, role, nameOf } = useStore();
  const manage = can.manageKpis(role);
  const a = kpiAttainment(k, month), canInput = manage || k.ownerId === meId;
  return (
    <tr>
      <td className="td"><div className="font-medium">{k.name}</div>{k.note && <div className="text-[11.5px] text-ink-3">{k.note}</div>}</td>
      <td className="td">{k.ownerId ? nameOf(k.ownerId) : <Badge tone="brand">全社</Badge>}</td>
      <td className="td tabular text-right">{fmt(k.target)}<span className="ml-0.5 text-[11px] text-ink-3">{k.unit}</span>{k.lowerIsBetter && <div className="text-[10.5px] text-ink-3">低いほど良い</div>}</td>
      <td className="td w-40">{canInput ? <ValueInput key={`${k.id}-${month}-${a.actual ?? ""}`} init={a.actual} onSave={(v) => d({ t: "kpi-value", id: k.id, month, value: v })} label={`${k.name}の${month}実績`} unit={k.unit} /> : <span className="tabular">{fmt(a.actual)} <span className="text-[11px] text-ink-3">{k.unit}</span></span>}</td>
      <td className="td w-44">{a.rate == null ? <span className="text-ink-3">未入力</span> : <div><div className="mb-1 flex justify-between text-[12px]"><span className="tabular">{Math.round(a.rate * 100)}%</span><Badge tone={a.ok ? "good" : a.rate >= 0.8 ? "warn" : "bad"}>{a.ok ? "達成" : a.rate >= 0.8 ? "あと少し" : "未達"}</Badge></div><Progress value={a.rate * 100} tone={a.ok ? "good" : a.rate >= 0.8 ? "warn" : "bad"} /></div>}</td>
      {manage && <td className="td"><div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${k.name}を編集`} onClick={() => onEdit(k)}><Pencil size={13} /></button><button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${k.name}を削除`} onClick={() => confirm(`「${k.name}」を削除しますか？`) && d({ t: "kpi-del", id: k.id, by: meId })}><Trash2 size={13} /></button></div></td>}
    </tr>
  );
}
function KpiTable({ title, rows, month, onEdit }: { title: string; rows: Kpi[]; month: string; onEdit: (k: Kpi) => void }) {
  const { role } = useStore();
  const manage = can.manageKpis(role);
  if (rows.length === 0) return null;
  return (
    <section className="card mb-5 overflow-x-auto" aria-label={title}><div className="border-b border-line px-4 py-3 font-bold">{title}</div>
      <table className="w-full min-w-[760px] text-[13px]"><thead><tr><th className="th">KPI</th><th className="th">担当</th><th className="th text-right">目標（月）</th><th className="th">実績</th><th className="th">達成率</th>{manage && <th className="th"><span className="sr-only">操作</span></th>}</tr></thead><tbody>{rows.map((k) => <KpiRow key={k.id} k={k} month={month} onEdit={onEdit} />)}</tbody></table></section>
  );
}

function ValueInput({ init, onSave, label, unit }: { init: number | null; onSave: (v: number | null) => void; label: string; unit: string }) {
  const [v, setV] = useState(init == null ? "" : String(init));
  const commit = () => { const n = v.trim() === "" ? null : Number(v); if ((n == null || Number.isFinite(n)) && n !== init) onSave(n); };
  return <div className="flex items-center gap-1"><input aria-label={label} inputMode="decimal" className="input tabular !h-8 !w-24" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} /><span className="text-[11px] text-ink-3">{unit}</span></div>;
}

function KpiForm({ init, onClose }: { init: Kpi | null; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [f, setF] = useState({ name: init?.name ?? "", unit: init?.unit ?? "", target: String(init?.target ?? ""), ownerId: init?.ownerId ?? "", lower: !!init?.lowerIsBetter, note: init?.note ?? "" });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="KPIの登録" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        d({ t: "kpi-save", by: meId, kpi: { id: init?.id ?? `kpi${Date.now()}`, name: f.name.trim(), unit: f.unit.trim(), target: Number(f.target), ownerId: f.ownerId, ...(f.lower ? { lowerIsBetter: true } : {}), values: init?.values ?? {}, ...(f.note.trim() ? { note: f.note.trim() } : {}) } });
        onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? "KPIを編集" : "KPIを登録"}</h2>
        <div><label className="label" htmlFor="kn">KPI名</label><input id="kn" required maxLength={80} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="kt">月の目標値</label><input id="kt" required inputMode="decimal" className="input tabular" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></div><div><label className="label" htmlFor="ku">単位</label><input id="ku" maxLength={20} placeholder="件・万円・時間 など" className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div></div>
        <div><label className="label" htmlFor="ko">担当</label><select id="ko" className="input" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">全社</option>{s.employees.map((e) => <option key={e.id} value={e.id}>{e.id} {e.name}</option>)}</select></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.lower} onChange={(e) => setF({ ...f, lower: e.target.checked })} />低いほど良い指標（時間外労働・クレーム件数など）</label>
        <div><label className="label" htmlFor="kd">メモ</label><input id="kd" maxLength={300} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.name.trim() || !Number.isFinite(Number(f.target)) || f.target === ""}>保存</button></div>
      </form>
    </div>
  );
}
