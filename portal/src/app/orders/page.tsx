"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Plus, ShoppingCart } from "lucide-react";
import { NumInput } from "@/components/NumInput";
import { ORDER_CATEGORIES, ORDER_STATUS, ORDER_VENDORS, deptOf, isHttps, orderMoveOk, orderTotal, type Order, type OrderStatus } from "@/lib/ops";
import { download, toCsv } from "@/lib/csv";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, yen } from "@/components/ui";

const tone = (s: OrderStatus) => (s === "納品済" ? "good" : s === "取消" ? "gray" : s === "依頼中" ? "warn" : "brand") as "good" | "gray" | "warn" | "brand";
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { 依頼中: "承認済", 承認済: "発注済", 発注済: "納品済" };

export default function OrdersPage() {
  const { s, d, me, meId, role, nameOf } = useStore();
  const [open, setOpen] = useState(false);
  const [flt, setFlt] = useState<"すべて" | OrderStatus>("すべて");
  const isAdmin = role === "admin";
  const list = useMemo(() => s.orders.filter((o) => flt === "すべて" || o.status === flt), [s.orders, flt]);
  const csv = () => download(`備品注文_${ymd(new Date())}.csv`, toCsv(["注文番号", "依頼日", "依頼者", "事業部", "区分", "発注先", "品名", "数量", "単価", "金額", "状態", "理由"], list.map((o) => [o.no, o.at.slice(0, 10), nameOf(o.requesterId), o.dept, o.category, o.vendor, o.item, o.qty, o.unitPrice ?? "", orderTotal(o), o.status, o.reason ?? ""])));
  const move = (o: Order, to: OrderStatus) => d({ t: "order-status", id: o.id, status: to, by: meId });

  return (
    <div>
      <PageHeader title="備品・名刺の注文リスト" sub="備品・消耗品・名刺などの注文を依頼します。承認 → 発注 → 納品の状況がここで分かります。"
        actions={<div className="flex gap-2">{role !== "employee" && <button className="btn" onClick={csv}><Download size={15} />CSV</button>}<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />注文を依頼</button></div>} />

      <section className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="発注先">
        {ORDER_VENDORS.map((v) => (
          <div key={v.name} className="card p-3">
            <div className="font-bold">{v.name}</div>
            <p className="mb-2 text-[12px] text-ink-3">{v.note}</p>
            {v.url ? <a className="btn !h-8 w-full" href={v.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />サイトを開く</a> : <span className="text-[11.5px] text-ink-3">社内の取引先</span>}
          </div>
        ))}
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["すべて", ...ORDER_STATUS] as const).map((k) => <button key={k} aria-pressed={flt === k} onClick={() => setFlt(k)} className={`rounded-full border px-3 py-1 text-[12.5px] ${flt === k ? "border-brand bg-brand text-white" : "border-line-strong"}`}>{k}</button>)}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead><tr><th className="th">注文番号</th><th className="th">依頼日</th><th className="th">依頼者</th><th className="th">発注先・区分</th><th className="th">品名</th><th className="th text-right">数量</th><th className="th text-right">金額</th><th className="th">状態</th><th className="th"></th></tr></thead>
          <tbody>
            {list.map((o) => {
              const next = NEXT[o.status];
              const last = o.history[o.history.length - 1];
              return (
                <tr key={o.id}>
                  <td className="td tabular whitespace-nowrap">{o.no}</td>
                  <td className="td tabular whitespace-nowrap">{o.at.slice(0, 10)}</td>
                  <td className="td">{nameOf(o.requesterId)}<div className="text-[11.5px] text-ink-3">{o.dept}</div></td>
                  <td className="td">{o.vendor}<div className="text-[11.5px] text-ink-3">{o.category}</div></td>
                  <td className="td"><div className="font-medium">{o.item}</div>{o.reason && <div className="text-[11.5px] text-ink-3">{o.reason}</div>}{o.url && isHttps(o.url) && <a className="text-[11.5px] text-brand underline" href={o.url} target="_blank" rel="noopener noreferrer">商品ページ</a>}</td>
                  <td className="td tabular text-right">{o.qty.toLocaleString("ja-JP")}</td>
                  <td className="td tabular text-right">{o.unitPrice != null ? yen(orderTotal(o)) : "—"}</td>
                  <td className="td"><Badge tone={tone(o.status)}>{o.status}</Badge>{last && <div className="text-[11px] text-ink-3">{last.at.slice(5, 10)} {nameOf(last.by)}</div>}</td>
                  <td className="td"><div className="flex gap-1 whitespace-nowrap">
                    {isAdmin && next && <button className="btn btn-primary !h-8" onClick={() => move(o, next)}>{next === "承認済" ? "承認" : next === "発注済" ? "発注した" : "納品済にする"}</button>}
                    {orderMoveOk(o.status, "取消", isAdmin, o.requesterId === meId) && <button className="btn btn-danger !h-8" onClick={() => confirm(`${o.no}「${o.item}」を取り消しますか？`) && move(o, "取消")}>取消</button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty>{role === "employee" ? "あなたの事業部の注文はまだありません。「注文を依頼」から追加してください。" : "注文はまだありません。"}</Empty>}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">{role === "employee" ? "自事業部の注文が表示されます。" : "全事業部の注文が表示されます。"}承認・発注・納品の更新は管理者が行います。実際の発注は、上のサイトまたは取引先へ行ってください。</p>
      {open && <OrderForm onClose={() => setOpen(false)} dept={deptOf(me)} />}
    </div>
  );
}

function OrderForm({ onClose, dept }: { onClose: () => void; dept: string }) {
  const { d, meId } = useStore();
  const [newId] = useState(() => `o${Date.now()}`);
  const [f, setF] = useState({ category: "備品" as Order["category"], vendor: ORDER_VENDORS[0].name, item: "", qty: "1", price: "", url: "", reason: "" });
  const qty = Number(f.qty), urlBad = f.url.trim() !== "" && !isHttps(f.url.trim());
  const ok = f.item.trim() !== "" && Number.isInteger(qty) && qty >= 1 && !urlBad;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    const order: Order = { id: newId, no: "", category: f.category, vendor: f.vendor, item: f.item.trim(), qty, ...(f.price !== "" ? { unitPrice: Number(f.price) } : {}), ...(f.url.trim() ? { url: f.url.trim() } : {}), ...(f.reason.trim() ? { reason: f.reason.trim() } : {}), dept, requesterId: meId, status: "依頼中", history: [], at: new Date().toISOString() };
    d({ t: "order-add", order });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="注文を依頼" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart size={18} />注文を依頼</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ov">発注先</label><select id="ov" className="input" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>{ORDER_VENDORS.map((v) => <option key={v.name}>{v.name}</option>)}</select></div>
          <div><label className="label" htmlFor="oc">区分</label><select id="oc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Order["category"] })}>{ORDER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="oi">品名（必須）</label><input id="oi" required maxLength={120} className="input" placeholder={f.category === "名刺" ? "例：名刺 100枚（営業部 山田太郎）" : "例：A4コピー用紙 5冊入"} value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="oq">数量</label><NumInput id="oq" required className="input" value={f.qty} onChange={(v) => setF({ ...f, qty: v })} /></div>
          <div><label className="label" htmlFor="op">単価（円・分かれば）</label><NumInput id="op" className="input" value={f.price} onChange={(v) => setF({ ...f, price: v })} /></div>
        </div>
        <div><label className="label" htmlFor="ou">商品ページのURL（任意）</label><input id="ou" inputMode="url" maxLength={300} className="input" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />{urlBad && <p role="alert" className="mt-1 text-[12px] text-bad">https:// から始まるURLを入力してください</p>}</div>
        <div><label className="label" htmlFor="or">理由・用途（任意）</label><input id="or" maxLength={300} className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok}>依頼する</button></div>
      </form>
    </div>
  );
}
