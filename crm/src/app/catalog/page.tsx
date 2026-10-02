"use client";
import { Fragment, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Beef, Download, FileText, Fish, Leaf, Mail, Plus, Printer, Wheat, Wine, Apple, Soup, Search, X } from "lucide-react";
import { addProduct, updateProduct, useMe, useStore } from "@/lib/store";
import { CATEGORY_HUE, catalogHtml, flyerHtml, productArt, priceLabel, type FlyerOpts } from "@/lib/flyer";
import { saveFlyerSel, downloadText } from "@/lib/flyerSel";
import type { Lang, Product, ProductCategory } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";
import { permsFor } from "@/lib/selectors";
import { yen } from "@/lib/format";
import { Drawer, Field, PageHeader, Segmented } from "@/components/ui";

const CATS = Object.keys(CATEGORY_HUE) as ProductCategory[];
const CAT_ICON: Record<ProductCategory, typeof Beef> = { "和牛・精肉": Beef, "水産物・冷凍": Fish, "日本酒・焼酎": Wine, "茶・抹茶": Leaf, "青果・果物": Apple, "調味料・加工食品": Soup, "米・穀物": Wheat };

export default function Catalog() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const router = useRouter();
  const [q, setQ] = useState(""); const [cat, setCat] = useState<ProductCategory | "">(""); const [lang, setLang] = useState<Lang>("ja");
  const [showPrice, setShowPrice] = useState(true);
  const [sel, setSel] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [flyer, setFlyer] = useState(false);
  const [adding, setAdding] = useState(false);

  const items = useMemo(() => d.products.filter((p) => p.active && (!cat || p.category === cat) && (!q || (p.name + p.nameEn + p.spec + p.category + p.producer).toLowerCase().includes(q.toLowerCase()))), [d.products, cat, q]);
  const validUntil = addDays(todayStr(), 60);
  const selected = sel.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 6 ? s : [...s, id]));
  const product = d.products.find((p) => p.id === open);

  return (
    <div>
      <PageHeader title="商品カタログ（電子）" sub={`${items.length}商品。電子カタログ（HTML／PDF）や電子チラシにして、バイヤーに送れます。仕入原価は社外向け資料には出ません。`}
        actions={<>
          <button className="btn" onClick={() => downloadText(`H-LINK-catalog-${lang}.html`, catalogHtml(items, lang, { validUntil, contactEmail: me.email, showPrice }))}><Download size={14} />電子カタログ（HTML）</button>
          <button className="btn" onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(catalogHtml(items, lang, { validUntil, contactEmail: me.email, showPrice })); w.document.close(); setTimeout(() => w.print(), 400); } }}><Printer size={14} />PDFで保存／印刷</button>
          {perms.isManager && <button className="btn" onClick={() => setAdding(true)}><Plus size={14} />商品を追加</button>}
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-56 !pl-8" placeholder="商品を検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1.5"><button className={`btn btn-sm ${!cat ? "btn-primary" : ""}`} onClick={() => setCat("")}>すべて</button>{CATS.map((c) => <button key={c} className={`btn btn-sm ${cat === c ? "btn-primary" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div className="ml-auto flex items-center gap-3"><Segmented value={lang} onChange={setLang} options={[{ id: "ja", label: "日本語" }, { id: "en", label: "English" }]} /><label className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />価格を表示</label></div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {items.map((p, i) => { const Icon = CAT_ICON[p.category]; const on = sel.includes(p.id); return (
          <article key={p.id} className="card anim-rise group overflow-hidden" style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}>
            <button className="relative block w-full text-left" onClick={() => setOpen(p.id)} aria-label={`${p.name}の詳細`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productArt(p, 480, 300)} alt="" className="h-[140px] w-full object-cover transition group-hover:scale-[1.02]" />
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur"><Icon size={12} />{p.category}</span>
            </button>
            <div className="p-3.5">
              <h3 className="text-[14.5px] font-bold leading-snug">{lang === "en" ? p.nameEn : p.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-[34px] text-[12px] leading-relaxed text-ink-2">{lang === "en" ? p.specEn : p.spec}</p>
              <div className="mt-2 flex items-end justify-between">
                <div>{showPrice && <div className="num text-[15px] font-bold">US${p.priceUSD.toLocaleString()}<span className="ml-1 text-[11px] font-normal text-ink-3">FOB／{p.unit}</span></div>}<div className="text-[11px] text-ink-3">MOQ {p.moq}{p.unit}・{p.storage}</div></div>
                <label className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}><input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(p.id)} />{on ? "選択中" : "チラシへ"}</label>
              </div>
            </div>
          </article>); })}
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_rgb(0_0_0/10%)] backdrop-blur lg:left-[232px] no-print">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3">
            <FileText size={16} className="text-ink-3" /><span className="text-[13px] font-semibold">チラシに入れる商品 {selected.length}/6</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{selected.map((p) => <span key={p.id} className="chip">{p.name}<button onClick={() => toggle(p.id)} aria-label="外す"><X size={11} /></button></span>)}</div>
            <button className="btn" onClick={() => setFlyer(true)}><Printer size={14} />電子チラシを作る</button>
            <button className="btn btn-primary" onClick={() => { saveFlyerSel({ ids: sel, title: "H-LINK 新商品・おすすめ商品のご案内", subtitle: "日本産食品をお届けします" }); router.push("/mail/"); }}><Mail size={14} />メールに挿入して配信へ</button>
          </div>
        </div>
      )}

      {product && <ProductDrawer p={product} lang={lang} canEdit={perms.isManager} onClose={() => setOpen(null)} />}
      {flyer && <FlyerDrawer items={selected} lang={lang} showPrice={showPrice} defaultContact={{ name: me.name, email: me.email }} validUntil={validUntil} onClose={() => setFlyer(false)} />}
      {adding && <AddDrawer onClose={() => setAdding(false)} />}
    </div>
  );
}

function ProductDrawer({ p, lang, canEdit, onClose }: { p: Product; lang: Lang; canEdit: boolean; onClose: () => void }) {
  const set = (patch: Partial<Product>) => updateProduct(p.id, patch);
  return (
    <Drawer open onClose={onClose} title={lang === "en" ? p.nameEn : p.name} width={480}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={productArt(p)} alt="" className="mb-4 h-[180px] w-full rounded-xl object-cover" />
      <p className="mb-4 text-[13px] leading-relaxed text-ink-2">{lang === "en" ? p.descEn : p.desc}</p>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
        {([["規格", lang === "en" ? p.specEn : p.spec], ["産地・生産者", `${p.origin}／${p.producer}`], ["最小ロット", `${p.moq}${p.unit}`], ["保存・期限", `${p.storage}／${p.shelfLife}`], ["HSコード", p.hsCode], ["認証", p.certs.join(" / ") || "—"], ["標準価格", priceLabel(p, "ja")]] as const).map(([k, v]) => <Fragment key={k}><dt className="text-ink-3">{k}</dt><dd className="font-medium">{v}</dd></Fragment>)}
      </dl>
      {canEdit ? (
        <div className="mt-5 space-y-3 rounded-xl bg-surface-2 p-3.5">
          <div className="text-[12.5px] font-bold">価格・原価の編集（Manager 以上）</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="標準価格（USD／単位）"><input className="input num" defaultValue={p.priceUSD} key={p.priceUSD} onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n !== p.priceUSD) set({ priceUSD: n }); }} /></Field>
            <Field label={`仕入原価（円／${p.unit}）※社外秘`}><input className="input num" defaultValue={p.costJPY} key={p.costJPY} onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n !== p.costJPY) set({ costJPY: n }); }} /></Field>
          </div>
          <p className="text-[11.5px] text-ink-3">原価 {yen(p.costJPY)}／{p.unit} に対し、標準価格での粗利率は目安で <b>{Math.round((1 - p.costJPY / (p.priceUSD * 152)) * 100)}%</b>（FOB・152円換算）。変更しても、作成済みの案件の明細・売上は変わりません（明細の単価は案件ごとに固定）。</p>
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })} />カタログに掲載する</label>
        </div>
      ) : <p className="mt-5 rounded-xl bg-surface-2 p-3 text-[12px] text-ink-3">価格・原価の変更は Manager 以上が行います。</p>}
    </Drawer>
  );
}

function FlyerDrawer({ items, lang, showPrice, defaultContact, validUntil, onClose }: { items: Product[]; lang: Lang; showPrice: boolean; defaultContact: { name: string; email: string }; validUntil: string; onClose: () => void }) {
  const [o, setO] = useState<FlyerOpts>({ title: lang === "en" ? "Japanese Food Selection" : "日本産食品 おすすめのご案内", subtitle: lang === "en" ? "Premium products from Japan, delivered worldwide" : "生産者こだわりの日本産食品を、世界へ", validUntil, contactName: defaultContact.name, contactEmail: defaultContact.email, lang, showPrice, note: "" });
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => flyerHtml(items, o), [items, o]);
  const set = (k: keyof FlyerOpts, v: string | boolean) => setO((x) => ({ ...x, [k]: v }));
  return (
    <Drawer open onClose={onClose} title="電子チラシを作る" width={760}
      footer={<><button className="btn" onClick={() => downloadText("H-LINK-flyer.html", html)}><Download size={14} />HTMLで保存</button><button className="btn btn-primary" onClick={() => ref.current?.contentWindow?.print()}><Printer size={14} />PDFで保存／印刷</button></>}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <Field label="タイトル"><input className="input" value={o.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="サブタイトル"><input className="input" value={o.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
          <Field label="有効期限"><input className="input" value={o.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></Field>
          <Field label="担当者名"><input className="input" value={o.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
          <Field label="連絡先メール"><input className="input" value={o.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
          <Field label="ひとこと"><textarea className="textarea" rows={3} value={o.note} onChange={(e) => set("note", e.target.value)} placeholder="例：サンプルのご依頼は随時承ります" /></Field>
          <Segmented value={o.lang} onChange={(v) => set("lang", v)} options={[{ id: "ja", label: "日本語" }, { id: "en", label: "English" }]} />
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={o.showPrice} onChange={(e) => set("showPrice", e.target.checked)} />価格（FOB）を載せる</label>
        </div>
        <iframe ref={ref} title="チラシのプレビュー" srcDoc={html} className="h-[640px] w-full rounded-xl bg-surface-3 ring-1 ring-line" />
      </div>
    </Drawer>
  );
}

function AddDrawer({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", nameEn: "", category: CATS[0] as ProductCategory, unit: "kg", moq: "100", costJPY: "", priceUSD: "", storage: "冷凍" as Product["storage"], origin: "", producer: "" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.name.trim() && Number(f.costJPY) > 0 && Number(f.priceUSD) > 0;
  return (
    <Drawer open onClose={onClose} title="商品を追加" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok} onClick={() => { addProduct({ sku: `HL-NEW-${Date.now().toString(36).slice(-4).toUpperCase()}`, name: f.name.trim(), nameEn: f.nameEn.trim() || f.name.trim(), category: f.category, producer: f.producer, origin: f.origin, spec: "", specEn: "", unit: f.unit, moq: Number(f.moq) || 1, storage: f.storage, shelfLife: "", costJPY: Number(f.costJPY), priceUSD: Number(f.priceUSD), hsCode: "", certs: [], desc: "", descEn: "", active: true }); onClose(); }}>追加する</button></>}>
      <div className="space-y-4">
        <Field label="商品名 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="商品名（英語）"><input className="input" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="カテゴリー"><select className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="保存"><select className="select" value={f.storage} onChange={(e) => set("storage", e.target.value)}><option>冷凍</option><option>冷蔵</option><option>常温</option></select></Field></div>
        <div className="grid grid-cols-3 gap-3"><Field label="単位"><input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} /></Field><Field label="最小ロット"><input className="input num" value={f.moq} onChange={(e) => set("moq", e.target.value)} /></Field><Field label="産地"><input className="input" value={f.origin} onChange={(e) => set("origin", e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="仕入原価（円／単位）*"><input className="input num" value={f.costJPY} onChange={(e) => set("costJPY", e.target.value)} /></Field><Field label="標準価格（USD／単位）*"><input className="input num" value={f.priceUSD} onChange={(e) => set("priceUSD", e.target.value)} /></Field></div>
        <Field label="生産者"><input className="input" value={f.producer} onChange={(e) => set("producer", e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}
