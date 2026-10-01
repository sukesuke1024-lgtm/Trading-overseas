"use client";

import { useRef, useState } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { uploadFile } from "@/lib/files";
import { PAY_KINDS, deptOf, parsePayName, type FileKind, type FileRec } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Badge, Fold, PageHeader } from "@/components/ui";
import { FileDownload, FileTable } from "@/components/Files";

export default function PayslipsPage() {
  const { me, meId, role, files: vfiles } = useStore();
  const [kind, setKind] = useState<"すべて" | FileKind>("すべて");
  const mine = vfiles.filter((f) => PAY_KINDS.includes(f.kind) && f.ownerId === meId).sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
  const shown = mine.filter((f) => kind === "すべて" || f.kind === kind);
  const years = [...new Set(shown.map((f) => (f.period ?? "").slice(0, 4)))];
  return (
    <div>
      <PageHeader title="給与明細・源泉徴収票" sub="いつでもご自身の給与明細・賞与明細・源泉徴収票をダウンロードできます。他の人の分は見られません。" />
      <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2"><ShieldCheck size={15} className="shrink-0" aria-hidden />個人情報保護のため、このページとダウンロード時はPINの再入力（15分有効）が必要です。ダウンロードは記録されます。</p>
      <div className="mb-3 flex flex-wrap gap-2">{(["すべて", ...PAY_KINDS] as const).map((k) => <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-full border px-3 py-1 text-[12.5px] ${kind === k ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{k}</button>)}</div>
      {shown.length === 0 ? <div className="card px-4 py-10 text-center text-ink-3">{me.name}さんの明細はまだ登録されていません。給与の確定後、管理部が登録します。</div> : years.map((y) => (
        <section key={y} className="card mb-3" aria-label={`${y}年`}><div className="border-b border-line px-4 py-2.5 font-bold">{y}年</div>
          <ul className="divide-y divide-line">{shown.filter((f) => (f.period ?? "").startsWith(y)).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13.5px]"><Badge tone={f.kind === "源泉徴収票" ? "brand" : f.kind === "賞与明細" ? "warn" : "gray"}>{f.kind}</Badge><span className="tabular w-24 font-medium">{f.period}</span><span className="min-w-0 flex-1 truncate text-ink-3">{f.name}</span><FileDownload rec={f} /></li>))}</ul></section>
      ))}
      {can.managePay(role) && <Admin />}
    </div>
  );
}

type Item = { file: File; empId: string; kind: FileKind; period: string };

function Admin() {
  const { s, d, me, meId, nameOf, emp, files: vfiles } = useStore();
  const [items, setItems] = useState<Item[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [manual, setManual] = useState({ empId: s.employees[0]?.id ?? "", kind: "給与明細" as FileKind, period: new Date().toISOString().slice(0, 7), file: null as File | null });
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const all = vfiles.filter((f) => PAY_KINDS.includes(f.kind));

  const pick = (files: File[] | FileList | null) => {
    const ok: Item[] = [], ng: string[] = [];
    for (const file of Array.from(files ?? [])) { const p = parsePayName(file.name); if (p && emp(p.empId)) ok.push({ file, ...p }); else ng.push(file.name); }
    setItems(ok); setBad(ng); setMsg("");
  };
  const send = async (list: Item[]) => {
    setBusy(true); setMsg(""); let n = 0; const errs: string[] = [];
    for (const it of list) {
      const r = await uploadFile(it.file);
      if ("error" in r) { errs.push(`${it.file.name}: ${r.error}`); continue; }
      const rec: FileRec = { id: r.id, name: r.name, size: r.size, mime: r.mime, kind: it.kind, scope: "本人", ownerId: it.empId, period: it.period, dept: deptOf(emp(it.empId)), uploadedBy: meId, at: new Date().toISOString() };
      d({ t: "file-add", rec }); n++;
    }
    setBusy(false); setItems([]); setBad([]); if (ref.current) ref.current.value = "";
    setMsg(`${n}件を登録しました。${errs.length ? `失敗：${errs.join(" / ")}` : ""}`);
  };
  void me;
  return (
    <section className="mt-6" aria-label="管理者：明細の登録">
      <h2 className="mb-2 text-lg font-bold">管理者：明細の登録</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><h3 className="mb-2 font-bold">一括登録（ファイル名で振り分け）</h3>
          <Fold className="mb-2" title="ファイル名のつけ方"><p>ファイル名を「<code>従業員番号_種別_期間.pdf</code>」にして複数まとめて選びます。例：<code>001_給与明細_2026-09.pdf</code>／<code>001_賞与明細_2026-12.pdf</code>／<code>001_源泉徴収票_2026.pdf</code></p></Fold>
          <div className="mb-2"><DropZone multiple compact accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" label="ここに明細ファイルをまとめてドラッグ＆ドロップ" hint="PDF・CSV・XLSX・PNG・JPG／ファイル名で振り分け" onFiles={(fs) => pick(fs)} /></div>
          {items.length > 0 && <ul className="mb-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-surface-2 p-2 text-[12.5px]">{items.map((it, i) => <li key={i}>{nameOf(it.empId)}（{it.empId}）・{it.kind}・{it.period}　<span className="text-ink-3">{it.file.name}</span></li>)}</ul>}
          {bad.length > 0 && <p role="alert" className="mb-2 text-[12.5px] text-bad">読み取れないファイル名（番号が未登録・形式が違う）：{bad.join("、")}</p>}
          <button className="btn btn-primary" disabled={busy || items.length === 0} onClick={() => send(items)}><FileUp size={15} />{busy ? "登録中…" : `${items.length}件を登録`}</button>
          {msg && <p role="status" className="mt-2 text-[13px] text-good">{msg}</p>}
        </div>
        <div className="card p-4"><h3 className="mb-2 font-bold">1件ずつ登録</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="pe">従業員</label><select id="pe" className="input" value={manual.empId} onChange={(e) => setManual({ ...manual, empId: e.target.value })}>{s.employees.map((e) => <option key={e.id} value={e.id}>{e.id} {e.name}</option>)}</select></div>
            <div><label className="label" htmlFor="pk">種別</label><select id="pk" className="input" value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value as FileKind, period: e.target.value === "源泉徴収票" ? manual.period.slice(0, 4) : manual.period.length === 4 ? `${manual.period}-01` : manual.period })}>{PAY_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div><label className="label" htmlFor="pp">対象期間（{manual.kind === "源泉徴収票" ? "年 例 2026" : "年月 例 2026-09"}）</label><input id="pp" className="input tabular" value={manual.period} onChange={(e) => setManual({ ...manual, period: e.target.value })} /></div>
            <div><div className="label">ファイル</div><DropZone compact label={manual.file ? `選択中：${manual.file.name}` : "ここにファイルをドラッグ＆ドロップ"} onFiles={(fs) => setManual({ ...manual, file: fs[0] ?? null })} /></div>
          </div>
          <button className="btn btn-primary mt-3" disabled={busy || !manual.file || !/^\d{4}(-\d{2})?$/.test(manual.period) || (manual.kind !== "源泉徴収票" && manual.period.length !== 7)} onClick={() => manual.file && send([{ file: manual.file, empId: manual.empId, kind: manual.kind, period: manual.period }])}>登録</button>
        </div>
      </div>
      <div className="card mt-4"><div className="border-b border-line px-4 py-2.5 font-bold">登録済みの明細（{all.length}件）</div><FileTable files={all.sort((a, b) => b.at.localeCompare(a.at))} empty="まだ登録されていません。" showTarget /></div>
    </section>
  );
}
