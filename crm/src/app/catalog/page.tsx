"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FileText, Paperclip, Plus, Search } from "lucide-react";
import { addProduct, updateProduct, useMe, useStore } from "@/lib/store";
import { DOC_KINDS, addDoc, fmtSize, openDoc, useDocs, type DocKind } from "@/lib/library";
import { permsFor } from "@/lib/selectors";
import { downloadCsv } from "@/lib/csv";
import { yen } from "@/lib/format";
import { rateNow } from "@/lib/fx";
import type { Product, ProductCategory } from "@/lib/types";
import { Drawer, Field, PageHeader } from "@/components/ui";
import { recordAudit } from "@/lib/store";

const CATS: ProductCategory[] = ["和牛・精肉", "水産物・冷凍", "日本酒・焼酎", "茶・抹茶", "青果・果物", "調味料・加工食品", "米・穀物"];

/** 商品マスタ：商品の規格・価格・原価と、生産者から受け取った実際の資料（マイソク・カタログ・規格書）をひもづける */
export default function Catalog() {
  const d = useStore().data!;
  const perms = permsFor(useMe());
  const { docs } = useDocs();
  const [q, setQ] = useState(""); const [cat, setCat] = useState<ProductCategory | "">("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const usd = rateNow("USD");
  const items = useMemo(() => d.products.filter((p) => (!cat || p.category === cat) && (!q || (p.name + p.nameEn + p.spec + p.producer + p.sku).toLowerCase().includes(q.toLowerCase()))), [d.products, cat, q]);
  const docCount = (id: string) => (docs ?? []).filter((x) => x.productId === id).length;
  const product = d.products.find((p) => p.id === open);

  return (
    <div>
      <PageHeader title="商品マスタ" sub="商品の規格・標準価格と、生産者から受け取ったマイソク・カタログ・規格書の実ファイルをひもづけます。案件の明細・見積計算の元になります。"
        actions={<>
          <Link href="/library/" className="btn"><Paperclip size={14} />資料ライブラリ</Link>
          <button className="btn" onClick={() => downloadCsv("products.csv", [["SKU", "商品名", "英語名", "カテゴリー", "生産者", "産地", "規格", "単位", "最小ロット", "保存", "賞味期限", "HSコード", "認証", "標準価格(USD)", ...(perms.isManager ? ["仕入原価(円)"] : [])], ...items.map((p) => [p.sku, p.name, p.nameEn, p.category, p.producer, p.origin, p.spec, p.unit, p.moq, p.storage, p.shelfLife, p.hsCode, p.certs.join("/"), p.priceUSD, ...(perms.isManager ? [p.costJPY] : [])])])}><Download size={14} />CSV</button>
          {perms.isManager && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />商品を追加</button>}
        </>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-60 !pl-8" placeholder="商品・生産者・SKUで検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1.5"><button className={`btn btn-sm ${!cat ? "btn-primary" : ""}`} onClick={() => setCat("")}>すべて</button>{CATS.map((c) => <button key={c} className={`btn btn-sm ${cat === c ? "btn-primary" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[1180px]"><thead><tr><th>SKU</th><th>商品</th><th>生産者・産地</th><th>規格</th><th>保存</th><th className="text-right">最小ロット</th><th>HSコード</th><th className="text-right">標準価格（FOB）</th>{perms.isManager && <th className="text-right" title="標準価格での粗利率の目安">粗利率</th>}<th>資料</th></tr></thead>
          <tbody>{items.map((p) => { const n = docCount(p.id); const margin = Math.round((1 - p.costJPY / (p.priceUSD * usd)) * 100); return (
            <tr key={p.id} className={`cursor-pointer ${p.active ? "" : "opacity-50"}`} onClick={() => setOpen(p.id)}>
              <td className="num text-[12px] text-ink-3">{p.sku}</td>
              <td className="min-w-[200px]"><div className="font-semibold">{p.name}</div><div className="text-[11.5px] text-ink-3">{p.nameEn}</div></td>
              <td className="text-ink-2">{p.producer}<div className="text-[11.5px] text-ink-3">{p.origin}</div></td>
              <td className="max-w-[240px] text-[12.5px] text-ink-2">{p.spec}</td>
              <td><span className="chip">{p.storage}</span></td>
              <td className="num text-right">{p.moq}{p.unit}</td><td className="num text-[12px] text-ink-2">{p.hsCode}</td>
              <td className="num text-right font-semibold">US${p.priceUSD.toLocaleString()}<span className="ml-1 text-[11px] font-normal text-ink-3">/{p.unit}</span></td>
              {perms.isManager && <td className={`num text-right ${margin < 15 ? "font-semibold text-bad" : "text-ink-2"}`}>{margin}%</td>}
              <td>{n > 0 ? <span className="chip chip-good"><FileText size={11} />{n}件</span> : <span className="chip chip-warn">資料なし</span>}</td>
            </tr>); })}
            {items.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-ink-3">該当する商品がありません</td></tr>}</tbody></table>
      </div>
      <p className="mt-3 px-1 text-[11.5px] text-ink-3">商品の紹介資料は、デザインされた実際のマイソク・カタログ（PDF・画像）を資料ライブラリに保存して使います。仕入原価・粗利率は Manager 以上にだけ表示されます。</p>
      {product && <ProductDrawer key={product.id} p={product} canEdit={perms.isManager} onClose={() => setOpen(null)} />}
      {adding && <AddDrawer onClose={() => setAdding(false)} />}
    </div>
  );
}

function ProductDrawer({ p, canEdit, onClose }: { p: Product; canEdit: boolean; onClose: () => void }) {
  const me = useMe()!;
  const { docs } = useDocs();
  const mine = (docs ?? []).filter((x) => x.productId === p.id);
  const [kind, setKind] = useState<DocKind>("マイソク");
  const [err, setErr] = useState("");
  const set = (patch: Partial<Product>) => updateProduct(p.id, patch);
  const num = (e: React.FocusEvent<HTMLInputElement>, cur: number, key: "priceUSD" | "costJPY" | "moq") => { const n = Number(e.target.value.replace(/,/g, "")); if (n > 0 && n !== cur) set({ [key]: n } as Partial<Product>); };
  const upload = async (files: FileList | null) => { if (!files) return; setErr(""); for (const f of Array.from(files)) { try { await addDoc(f, { kind, productId: p.id, addedBy: me.id }); recordAudit("資料を追加", "資料", `${f.name}（${p.name}）`); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } } };
  return (
    <Drawer open onClose={onClose} title={p.name} width={520}>
      <p className="mb-1 text-[12px] text-ink-3">{p.nameEn}・{p.sku}</p>
      <dl className="mb-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
        <dt className="text-ink-3">生産者・産地</dt><dd className="font-medium">{p.producer}／{p.origin}</dd>
        <dt className="text-ink-3">規格</dt><dd className="font-medium">{p.spec}</dd>
        <dt className="text-ink-3">保存・期限</dt><dd className="font-medium">{p.storage}／{p.shelfLife}</dd>
        <dt className="text-ink-3">HSコード</dt><dd className="num font-medium">{p.hsCode}</dd>
        <dt className="text-ink-3">認証</dt><dd className="font-medium">{p.certs.join(" / ") || "—"}</dd>
      </dl>
      <section className="rounded-xl bg-surface-2 p-3.5">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold">資料（マイソク・カタログ・規格書）</h3><Link href={`/library/?product=${p.id}`} className="text-xs text-accent-2 hover:underline">ライブラリで開く →</Link></div>
        <ul className="space-y-1.5">{mine.map((x) => <li key={x.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[12.5px]"><FileText size={14} className="shrink-0 text-ink-3" /><button className="min-w-0 flex-1 truncate text-left font-medium hover:text-accent-2" onClick={() => openDoc(x.id)}>{x.name}</button><span className="chip">{x.kind}</span><span className="num text-[11px] text-ink-3">{fmtSize(x.size)}</span></li>)}
          {mine.length === 0 && <li className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">この商品の資料がありません。生産者のマイソク・カタログ・規格書を追加してください。</li>}</ul>
        <div className="mt-2.5 flex items-center gap-2"><select className="select !h-8 !w-auto" value={kind} onChange={(e) => setKind(e.target.value as DocKind)} aria-label="資料の種類">{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select><label className="btn btn-sm cursor-pointer"><Paperclip size={12} />ファイルを追加<input type="file" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label></div>
        {err && <p role="alert" className="mt-2 text-xs text-bad">{err}</p>}
      </section>
      {canEdit ? (
        <div className="mt-5 space-y-3 rounded-xl bg-surface-2 p-3.5">
          <div className="text-[12.5px] font-bold">価格・原価（Manager 以上）</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="標準価格（USD/単位）"><input className="input num" defaultValue={p.priceUSD} key={p.priceUSD} onBlur={(e) => num(e, p.priceUSD, "priceUSD")} /></Field>
            <Field label={`仕入原価（円/${p.unit}）`}><input className="input num" defaultValue={p.costJPY} key={p.costJPY} onBlur={(e) => num(e, p.costJPY, "costJPY")} /></Field>
            <Field label="最小ロット"><input className="input num" defaultValue={p.moq} key={p.moq} onBlur={(e) => num(e, p.moq, "moq")} /></Field>
          </div>
          <p className="text-[11.5px] text-ink-3">原価 {yen(p.costJPY)}／{p.unit}。変更しても、作成済みの案件の明細・売上は変わりません（明細の単価は案件ごとに固定）。</p>
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })} />案件・見積の商品候補に表示する</label>
        </div>
      ) : <p className="mt-5 rounded-xl bg-surface-2 p-3 text-[12px] text-ink-3">価格・原価の変更は Manager 以上が行います。</p>}
    </Drawer>
  );
}

function AddDrawer({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", nameEn: "", category: CATS[0] as ProductCategory, unit: "kg", moq: "100", costJPY: "", priceUSD: "", storage: "冷凍" as Product["storage"], origin: "", producer: "", spec: "", hsCode: "" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.name.trim() && Number(f.costJPY) > 0 && Number(f.priceUSD) > 0;
  return (
    <Drawer open onClose={onClose} title="商品を追加" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok} onClick={() => { addProduct({ sku: `HL-NEW-${Date.now().toString(36).slice(-4).toUpperCase()}`, name: f.name.trim(), nameEn: f.nameEn.trim() || f.name.trim(), category: f.category, producer: f.producer, origin: f.origin, spec: f.spec, specEn: f.spec, unit: f.unit, moq: Number(f.moq) || 1, storage: f.storage, shelfLife: "", costJPY: Number(f.costJPY), priceUSD: Number(f.priceUSD), hsCode: f.hsCode, certs: [], desc: "", descEn: "", active: true }); onClose(); }}>追加する</button></>}>
      <div className="space-y-4">
        <Field label="商品名 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="商品名（英語）"><input className="input" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="カテゴリー"><select className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="保存"><select className="select" value={f.storage} onChange={(e) => set("storage", e.target.value)}><option>冷凍</option><option>冷蔵</option><option>常温</option></select></Field></div>
        <Field label="規格"><input className="input" value={f.spec} onChange={(e) => set("spec", e.target.value)} placeholder="例：A5等級・ブロック／約5kg・冷凍" /></Field>
        <div className="grid grid-cols-3 gap-3"><Field label="単位"><input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} /></Field><Field label="最小ロット"><input className="input num" value={f.moq} onChange={(e) => set("moq", e.target.value)} /></Field><Field label="HSコード"><input className="input num" value={f.hsCode} onChange={(e) => set("hsCode", e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="仕入原価（円/単位）*"><input className="input num" value={f.costJPY} onChange={(e) => set("costJPY", e.target.value)} /></Field><Field label="標準価格（USD/単位）*"><input className="input num" value={f.priceUSD} onChange={(e) => set("priceUSD", e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="生産者"><input className="input" value={f.producer} onChange={(e) => set("producer", e.target.value)} /></Field><Field label="産地"><input className="input" value={f.origin} onChange={(e) => set("origin", e.target.value)} /></Field></div>
      </div>
    </Drawer>
  );
}
