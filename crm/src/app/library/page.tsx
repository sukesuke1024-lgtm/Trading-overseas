"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, File as FileIcon, FileImage, FileSpreadsheet, FileText, Mail, Trash2, Upload, X } from "lucide-react";
import { recordAudit, useMe, useStore } from "@/lib/store";
import { DOC_KINDS, MAX_FILE_BYTES, addDoc, deleteDoc, downloadDoc, fmtSize, openDoc, updateDoc, useDocs, type DocKind, type DocMeta } from "@/lib/library";
import { saveAttachSel } from "@/lib/attachSel";
import { fmtDateTime } from "@/lib/dates";
import { permsFor } from "@/lib/selectors";
import { PageHeader } from "@/components/ui";
import { Suspended } from "@/components/Suspended";
import { useSearchParams } from "next/navigation";

export default function Page() { return <Suspended><Library /></Suspended>; }

const icon = (t: string) => (t.startsWith("image/") ? FileImage : t === "application/pdf" ? FileText : t.includes("sheet") || t.includes("excel") || t === "text/csv" ? FileSpreadsheet : FileIcon);

/** 資料ライブラリ：マイソク・商品カタログ・チラシ・規格書などの実ファイルを保管し、メールに添付する */
function Library() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const router = useRouter();
  const sp = useSearchParams();
  const { docs, error } = useDocs();
  const [kind, setKind] = useState<DocKind | "">("");
  const [product, setProduct] = useState(sp.get("product") ?? "");
  const [q, setQ] = useState("");
  const [upKind, setUpKind] = useState<DocKind>("マイソク");
  const [upProduct, setUpProduct] = useState(sp.get("product") ?? "");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const list = useMemo(() => (docs ?? []).filter((x) => (!kind || x.kind === kind) && (!product || x.productId === product) && (!q || (x.name + x.note).toLowerCase().includes(q.toLowerCase()))), [docs, kind, product, q]);
  const total = (docs ?? []).reduce((a, x) => a + x.size, 0);

  const upload = async (files: FileList | File[]) => {
    setBusy(true); setMsg(null);
    const errs: string[] = []; let ok = 0;
    for (const f of Array.from(files)) { try { await addDoc(f, { kind: upKind, productId: upProduct, addedBy: me.id }); ok++; recordAudit("資料を追加", "資料", `${f.name}（${upKind}）`); } catch (e) { errs.push(e instanceof Error ? e.message : String(e)); } }
    setBusy(false);
    setMsg(errs.length ? { tone: "bad", text: errs.join(" ／ ") } : { tone: "ok", text: `${ok}件を追加しました` });
  };
  const canEdit = (x: DocMeta) => perms.isManager || x.addedBy === me.id;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="資料ライブラリ" sub="マイソク（販売図面）・商品カタログ・チラシ・規格書・見積書などの実ファイルを保管します。メール配信に、そのまま添付できます。"
        actions={sel.length > 0 && <button className="btn btn-primary" onClick={() => { saveAttachSel(sel); router.push("/mail/"); }}><Mail size={15} />選んだ{sel.length}件をメールに添付</button>} />

      <section className={`card mb-5 p-4 transition ${drag ? "ring-2 ring-[var(--accent-2)]" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent-2"><Upload size={20} /></div>
          <div className="min-w-[220px] flex-1"><div className="text-[14px] font-bold">ここにファイルをドラッグ＆ドロップ</div><div className="text-[12px] text-ink-3">PDF・画像・Word・Excel・PowerPoint。1ファイル {Math.round(MAX_FILE_BYTES / 1048576)}MB まで。この端末のブラウザ内に保存されます。</div></div>
          <select className="select !w-auto" value={upKind} onChange={(e) => setUpKind(e.target.value as DocKind)} aria-label="種類">{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <select className="select !w-auto max-w-[200px]" value={upProduct} onChange={(e) => setUpProduct(e.target.value)} aria-label="商品"><option value="">商品：指定なし</option>{d.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input ref={input} type="file" multiple className="sr-only" id="lib-file" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
          <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}><Upload size={14} />ファイルを選ぶ</button>
        </div>
        {msg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.tone === "ok" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{msg.text}</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>}
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-56" placeholder="ファイル名・メモで検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5"><button className={`btn btn-sm ${!kind ? "btn-primary" : ""}`} onClick={() => setKind("")}>すべて</button>{DOC_KINDS.map((k) => <button key={k} className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`} onClick={() => setKind(k)}>{k}</button>)}</div>
        <select className="select !w-auto max-w-[220px]" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">商品：すべて</option>{d.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <span className="ml-auto text-[12px] text-ink-3">{docs?.length ?? 0}件・{fmtSize(total)}</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[860px]"><thead><tr><th className="w-8" /><th>ファイル</th><th>種類</th><th>商品</th><th>メモ</th><th className="text-right">サイズ</th><th>追加</th><th /></tr></thead>
          <tbody>
            {list.map((x) => { const I = icon(x.type); const on = sel.includes(x.id); return (
              <tr key={x.id}>
                <td><input type="checkbox" checked={on} aria-label={`${x.name}を選ぶ`} onChange={() => setSel((s) => (on ? s.filter((i) => i !== x.id) : [...s, x.id]))} /></td>
                <td className="max-w-[300px]"><button className="inline-flex max-w-full items-center gap-2 text-left font-semibold hover:text-accent-2" onClick={() => openDoc(x.id)}><I size={16} className="shrink-0 text-ink-3" /><span className="truncate">{x.name}</span></button></td>
                <td><select aria-label="種類" className="inline" disabled={!canEdit(x)} value={x.kind} onChange={(e) => updateDoc(x.id, { kind: e.target.value as DocKind })}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select></td>
                <td className="max-w-[170px]"><select aria-label="商品" className="inline" disabled={!canEdit(x)} value={x.productId} onChange={(e) => updateDoc(x.id, { productId: e.target.value })}><option value="">—</option>{d.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td className="min-w-[160px]"><input className="inline" aria-label="メモ" disabled={!canEdit(x)} defaultValue={x.note} placeholder="メモ" onBlur={(e) => e.target.value !== x.note && updateDoc(x.id, { note: e.target.value })} /></td>
                <td className="num text-right text-ink-2">{fmtSize(x.size)}</td>
                <td className="whitespace-nowrap text-[12px] text-ink-3">{fmtDateTime(x.addedAt)}<br />{d.users.find((u) => u.id === x.addedBy)?.name}</td>
                <td className="whitespace-nowrap text-right"><button className="btn btn-ghost btn-sm" aria-label="ダウンロード" onClick={() => downloadDoc(x)}><Download size={13} /></button>{canEdit(x) && <button className="btn btn-ghost btn-sm btn-danger" aria-label="削除" onClick={async () => { if (confirm(`${x.name} を削除しますか？`)) { await deleteDoc(x.id); recordAudit("資料を削除", "資料", x.name); setSel((s) => s.filter((i) => i !== x.id)); } }}><Trash2 size={13} /></button>}</td>
              </tr>); })}
            {docs && list.length === 0 && <tr><td colSpan={8} className="py-14 text-center"><div className="text-[13px] font-semibold">資料がありません</div><div className="mx-auto mt-1 max-w-md text-xs text-ink-3">生産者から受け取ったマイソク・カタログ・チラシ（PDF や画像）をアップロードすると、商品や案件に関連づけて、メールにそのまま添付できます。</div></td></tr>}
            {!docs && <tr><td colSpan={8} className="py-10 text-center text-ink-3">読み込み中…</td></tr>}
          </tbody></table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11.5px] text-ink-3"><X size={11} className="hidden" />デモ版では、資料はこの端末・このブラウザの中にだけ保存され、他の人とは共有されません（本番ではクラウドのストレージに保存し、チームで共有します）。仕入原価・契約条件など社外秘の資料は、種類を「契約書」「その他」にして、メールに添付しないよう注意してください。</p>
    </div>
  );
}
