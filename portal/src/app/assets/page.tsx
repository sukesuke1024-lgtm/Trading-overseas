"use client";

import { NumInput } from "@/components/NumInput";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { ASSET_CATEGORIES, ASSET_STATUS, DEFAULT_LIFE, bookValue, deptOf, nextAssetId, type Asset } from "@/lib/ops";
import { download, toCsv } from "@/lib/csv";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, yen } from "@/components/ui";

export default function AssetsPage() {
  const { s, d, meId, role, nameOf } = useStore();
  const [edit, setEdit] = useState<Asset | "new" | null>(null);
  const [cat, setCat] = useState<"すべて" | Asset["category"]>("すべて");
  const [q, setQ] = useState("");
  const manage = can.manageAssets(role);
  const today = ymd(new Date()).slice(0, 7);
  const mine = useMemo(() => (role === "employee" ? s.assets.filter((a) => a.assigneeId === meId) : s.assets), [s.assets, role, meId]);
  const list = useMemo(() => mine.filter((a) => (cat === "すべて" || a.category === cat) && `${a.id}${a.name}${a.serial ?? ""}${a.model ?? ""}${a.assigneeId ? nameOf(a.assigneeId) : ""}${a.dept ?? ""}`.includes(q)), [mine, cat, q, nameOf]);
  const total = list.reduce((sum, a) => sum + bookValue(a, today).value, 0);
  const csv = () => { download(`固定資産台帳_${ymd(new Date())}.csv`, toCsv(["資産番号", "名称", "区分", "メーカー", "型番", "シリアル/IMEI", "取得日", "取得価額", "耐用年数", "月額償却", "償却累計", "帳簿価額", "使用者", "事業部", "設置場所", "状態", "廃棄日", "備考"], list.map((a) => { const b = bookValue(a, today); return [a.id, a.name, a.category, a.maker ?? "", a.model ?? "", a.serial ?? "", a.purchaseDate, a.cost, a.usefulLife, b.monthly, b.accumulated, b.value, a.assigneeId ? nameOf(a.assigneeId) : "", a.dept ?? "", a.location ?? "", a.status, a.disposedAt ?? "", a.note ?? ""]; }))); d({ t: "export-log", by: meId, what: `固定資産台帳CSV（${list.length}件）` }); };

  return (
    <div>
      <PageHeader title="固定資産台帳" sub={manage ? "PC・スマートフォン・タブレット・USB等の資産を登録し、使用者・償却・状態を管理します。" : "あなたに割り当てられている資産です。"}
        actions={<div className="flex gap-2">{role !== "employee" && <button className="btn" onClick={csv}><Download size={15} />CSV</button>}{manage && <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />資産を登録</button>}</div>} />
      {role !== "employee" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {["すべて", ...ASSET_CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c as typeof cat)} aria-pressed={cat === c} className={`rounded-full border px-3 py-1 text-[12.5px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}</button>)}
          <input className="input ml-auto !w-56" placeholder="資産番号・名称・使用者で検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]"><thead><tr><th className="th">資産番号</th><th className="th">名称・型番</th><th className="th">使用者・事業部</th><th className="th">取得</th><th className="th text-right">取得価額</th><th className="th text-right">帳簿価額</th><th className="th">状態</th>{manage && <th className="th"><span className="sr-only">操作</span></th>}</tr></thead>
          <tbody>{list.map((a) => { const b = bookValue(a, today); return (
            <tr key={a.id}><td className="td tabular font-medium">{a.id}</td>
              <td className="td"><div className="font-medium">{a.name}</div><div className="text-[11.5px] text-ink-3">{a.category}{a.maker ? `・${a.maker}` : ""}{a.model ? ` ${a.model}` : ""}{a.serial ? `・S/N ${a.serial}` : ""}</div></td>
              <td className="td">{a.assigneeId ? nameOf(a.assigneeId) : "—"}<div className="text-[11.5px] text-ink-3">{a.dept}{a.location ? `・${a.location}` : ""}</div></td>
              <td className="td tabular">{a.purchaseDate}<div className="text-[11.5px] text-ink-3">耐用{a.usefulLife}年</div></td>
              <td className="td tabular text-right">{yen(a.cost)}</td><td className="td tabular text-right">{yen(b.value)}{b.expensed && <div className="text-[11px] text-ink-3">少額（費用処理）</div>}</td>
              <td className="td"><Badge tone={a.status === "使用中" ? "good" : a.status === "廃棄・売却" ? "gray" : "warn"}>{a.status}</Badge></td>
              {manage && <td className="td"><div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${a.name}を編集`} onClick={() => setEdit(a)}><Pencil size={13} /></button><button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${a.name}を削除`} onClick={() => confirm(`「${a.id} ${a.name}」を削除しますか？（廃棄の場合は状態を「廃棄・売却」にしてください）`) && d({ t: "asset-del", id: a.id, by: meId })}><Trash2 size={13} /></button></div></td>}</tr>); })}</tbody></table>
        {list.length === 0 && <Empty>{manage ? "資産がまだありません。「資産を登録」から追加してください。" : "割り当てられている資産はありません。"}</Empty>}
        {role !== "employee" && list.length > 0 && <div className="flex justify-between border-t border-line px-4 py-2 text-[12.5px]"><span className="text-ink-3">{list.length}件</span><span>帳簿価額の合計（{today}）：<b className="tabular">{yen(total)}</b></span></div>}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">償却は定額法（耐用年数の目安：PC・スマホ4年など）で月割計算、10万円未満は少額資産として取得時に費用処理する目安です。税務上の取扱い（30万円未満の特例など）は税理士に確認してください。USBメモリ等の記憶媒体は区分「USB・記憶媒体」にシリアル番号と使用者を登録して管理します。</p>
      {edit && <AssetForm key={edit === "new" ? "new" : edit.id} init={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AssetForm({ init, onClose }: { init: Asset | null; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [f, setF] = useState({ name: init?.name ?? "", category: init?.category ?? ("PC" as Asset["category"]), maker: init?.maker ?? "", model: init?.model ?? "", serial: init?.serial ?? "", mgmtId: init?.mgmtId ?? "", purchaseDate: init?.purchaseDate ?? ymd(new Date()), cost: String(init?.cost ?? ""), life: String(init?.usefulLife ?? DEFAULT_LIFE.PC), assigneeId: init?.assigneeId ?? "", dept: init?.dept ?? "", location: init?.location ?? "", status: init?.status ?? ("使用中" as Asset["status"]), disposedAt: init?.disposedAt ?? "", note: init?.note ?? "" });
  const upd = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const emp = s.employees.find((e) => e.id === f.assigneeId);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="資産の登録" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        const asset: Asset = { id: init?.id ?? nextAssetId(s.assets, f.category), name: f.name.trim(), category: f.category, ...(f.maker.trim() ? { maker: f.maker.trim() } : {}), ...(f.model.trim() ? { model: f.model.trim() } : {}), ...(f.serial.trim() ? { serial: f.serial.trim() } : {}), ...(f.mgmtId.trim() ? { mgmtId: f.mgmtId.trim() } : {}), purchaseDate: f.purchaseDate, cost: Number(f.cost) || 0, usefulLife: Math.max(1, Math.round(Number(f.life) || 4)), ...(f.assigneeId ? { assigneeId: f.assigneeId } : {}), ...(f.dept.trim() || emp?.dept ? { dept: f.dept.trim() || deptOf(emp) } : {}), ...(f.location.trim() ? { location: f.location.trim() } : {}), status: f.status, ...(f.status === "廃棄・売却" && f.disposedAt ? { disposedAt: f.disposedAt } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) };
        d({ t: "asset-save", asset, by: meId }); onClose();
      }}>
        <h2 className="text-lg font-bold">{init ? `${init.id} を編集` : "資産を登録"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="an">名称</label><input id="an" required maxLength={100} className="input" value={f.name} onChange={(e) => upd({ name: e.target.value })} /></div>
          <div><label className="label" htmlFor="ac">区分</label><select id="ac" className="input" disabled={!!init} value={f.category} onChange={(e) => upd({ category: e.target.value as Asset["category"], life: String(DEFAULT_LIFE[e.target.value as Asset["category"]]) })}>{ASSET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="as">状態</label><select id="as" className="input" value={f.status} onChange={(e) => upd({ status: e.target.value as Asset["status"] })}>{ASSET_STATUS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="am">メーカー</label><input id="am" maxLength={100} className="input" value={f.maker} onChange={(e) => upd({ maker: e.target.value })} /></div>
          <div><label className="label" htmlFor="ao">型番</label><input id="ao" maxLength={100} className="input" value={f.model} onChange={(e) => upd({ model: e.target.value })} /></div>
          <div><label className="label" htmlFor="ase">シリアル番号 / IMEI</label><input id="ase" maxLength={100} className="input tabular" value={f.serial} onChange={(e) => upd({ serial: e.target.value })} /></div>
          <div><label className="label" htmlFor="ami">管理ID（MACアドレス・PC名など）</label><input id="ami" maxLength={100} className="input tabular" value={f.mgmtId} onChange={(e) => upd({ mgmtId: e.target.value })} /></div>
          <div><label className="label" htmlFor="ap">取得日</label><input id="ap" type="date" required className="input" value={f.purchaseDate} onChange={(e) => upd({ purchaseDate: e.target.value })} /></div>
          <div><label className="label" htmlFor="aco">取得価額（円）</label><NumInput id="aco" required className="input" value={f.cost} onChange={(v) => upd({ cost: v })} /></div>
          <div><label className="label" htmlFor="al">耐用年数（年）</label><input id="al" type="number" min={1} max={60} required className="input tabular" value={f.life} onChange={(e) => upd({ life: e.target.value })} /></div>
          {f.status === "廃棄・売却" && <div><label className="label" htmlFor="ad">廃棄・売却日</label><input id="ad" type="date" className="input" value={f.disposedAt} onChange={(e) => upd({ disposedAt: e.target.value })} /></div>}
          <div><label className="label" htmlFor="aa">使用者</label><select id="aa" className="input" value={f.assigneeId} onChange={(e) => upd({ assigneeId: e.target.value })}><option value="">（共用・保管）</option>{s.employees.filter((e) => !e.left).map((e) => <option key={e.id} value={e.id}>{e.id} {e.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ade">事業部</label><input id="ade" maxLength={40} className="input" placeholder={emp ? deptOf(emp) : ""} value={f.dept} onChange={(e) => upd({ dept: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="alo">設置場所</label><input id="alo" maxLength={100} className="input" value={f.location} onChange={(e) => upd({ location: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="ano">備考</label><input id="ano" maxLength={200} className="input" value={f.note} onChange={(e) => upd({ note: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.name.trim()}>保存</button></div>
      </form>
    </div>
  );
}
