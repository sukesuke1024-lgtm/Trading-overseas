"use client";

import { useMemo, useState } from "react";
import { Check, Download, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ACCOUNTS, TAX_KINDS, acct, checkEntry, isInvoiceNo, isPosted, type JLine, type TaxKind } from "@/lib/accounting";
import { can } from "@/lib/perm";
import { download } from "@/lib/csv";
import { verifyChain } from "@/lib/chain";
import { journalCsv } from "@/lib/exports";
import { DEPARTMENTS, empById } from "@/lib/data";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader } from "@/components/report";

export default function Journal() {
  const { s, d, meId, role } = useStore();
  const w = can.writeAccounting(role);
  const [q, setQ] = useState({ text: "", from: "", to: "", min: "", max: "", partner: "", state: "" });
  const [open, setOpen] = useState(false);
  // 電子帳簿保存法の検索要件：取引年月日・取引金額・取引先で検索、範囲指定・複数条件
  const rows = useMemo(() => [...s.journal].reverse().filter((j) => {
    const amt = j.lines.filter((l) => l.side === "D").reduce((a, l) => a + l.amount, 0);
    return (!q.text || `${j.memo}${j.id}${j.evidenceNo ?? ""}`.includes(q.text)) && (!q.from || j.date >= q.from) && (!q.to || j.date <= q.to)
      && (!q.min || amt >= Number(q.min)) && (!q.max || amt <= Number(q.max)) && (!q.partner || (j.partner ?? "").includes(q.partner))
      && (!q.state || (q.state === "承認待ち") === !isPosted(j, s.jApprovals));
  }), [s.journal, s.jApprovals, q]);
  const chain = useMemo(() => verifyChain(s.journal), [s.journal]);
  const pending = s.journal.filter((j) => !isPosted(j, s.jApprovals)).length;

  if (!can.viewAccounting(role)) return <div className="card p-8 text-center text-ink-2">この画面は経理担当・監査・管理者のみ閲覧できます。</div>;
  return (
    <div>
      <div className="print:hidden"><PageHeader title="仕訳帳" sub="仕訳は削除できません（取消は反対仕訳で記録）。手動仕訳は起票者以外の承認で転記されます。" actions={<div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => { download(`仕訳帳_${ymd(new Date())}.csv`, journalCsv(s.journal, s.jApprovals, "0000-00-00", "9999-12-31")); d({ t: "export-log", by: meId, what: "仕訳帳CSV（全期間）" }); }}><Download size={14} />CSV</button>
        <PrintButton what="仕訳帳" />
        {w && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />仕訳を起票</button>}</div>} /></div>
      <PrintHeader title="仕訳帳" period={`${q.from || "期初"} 〜 ${q.to || "現在"}`} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] print:hidden">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${chain.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{chain.ok ? `✔ 改ざんなし（${chain.count}件のハッシュ連鎖を検証）` : `✖ ${chain.brokenAt}件目で不整合：${chain.reason}`}</span>
        {pending > 0 && <Badge tone="warn">承認待ち {pending}件</Badge>}
      </div>
      <div className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 lg:grid-cols-7 print:hidden">
        <input className="input" placeholder="摘要・番号" aria-label="摘要" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
        <input className="input" type="date" aria-label="取引日（自）" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} />
        <input className="input" type="date" aria-label="取引日（至）" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} />
        <input className="input tabular" type="number" placeholder="金額 下限" aria-label="金額下限" value={q.min} onChange={(e) => setQ({ ...q, min: e.target.value })} />
        <input className="input tabular" type="number" placeholder="金額 上限" aria-label="金額上限" value={q.max} onChange={(e) => setQ({ ...q, max: e.target.value })} />
        <input className="input" placeholder="取引先" aria-label="取引先" value={q.partner} onChange={(e) => setQ({ ...q, partner: e.target.value })} />
        <select className="input" aria-label="状態" value={q.state} onChange={(e) => setQ({ ...q, state: e.target.value })}><option value="">状態: すべて</option><option>承認待ち</option><option>転記済</option></select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]"><thead><tr><th className="th">番号</th><th className="th">日付</th><th className="th">摘要 / 取引先</th><th className="th">借方</th><th className="th">貸方</th><th className="th text-right">金額</th><th className="th">状態</th><th className="th w-24 print:hidden"><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {rows.slice(0, 300).map((j) => {
              const posted = isPosted(j, s.jApprovals), amt = j.lines.filter((l) => l.side === "D").reduce((a, l) => a + l.amount, 0);
              const reversed = s.journal.some((x) => x.reverses === j.id), canAct = w && j.createdBy !== meId;
              return (
                <tr key={j.id} className="avoid-break align-top">
                  <td className="td tabular text-ink-3">{j.id}</td><td className="td tabular">{j.date}</td>
                  <td className="td"><div className="font-medium">{j.memo}</div><div className="text-[11.5px] text-ink-3">{[j.partner, j.evidenceNo, j.invoiceNo].filter(Boolean).join("・")}・起票 {empById(j.createdBy)?.name ?? j.createdBy}{s.jApprovals[j.id] && `・承認 ${empById(s.jApprovals[j.id].by)?.name}`}</div></td>
                  <td className="td">{j.lines.filter((l) => l.side === "D").map((l, i) => <div key={i}>{acct(l.account)?.name}</div>)}</td>
                  <td className="td">{j.lines.filter((l) => l.side === "C").map((l, i) => <div key={i}>{acct(l.account)?.name}</div>)}</td>
                  <td className="td tabular text-right">{amt.toLocaleString("ja-JP")}</td>
                  <td className="td"><div className="flex flex-col gap-1"><Badge tone={posted ? "good" : "warn"}>{posted ? "転記済" : "承認待ち"}</Badge>{reversed && <Badge tone="gray">取消済</Badge>}{j.reverses && <Badge tone="gray">反対仕訳</Badge>}</div></td>
                  <td className="td print:hidden"><div className="flex gap-1">
                    {!posted && canAct && <button className="btn !h-7 !px-2 text-[12px]" title="承認して転記" onClick={() => d({ t: "journal-approve", id: j.id, by: meId })}><Check size={13} />承認</button>}
                    {!posted && !canAct && w && <span className="text-[11px] text-ink-3">起票者以外が承認</span>}
                    {posted && !reversed && !j.reverses && w && j.source !== "opening" && <button className="btn !h-7 !px-2 text-[12px]" title="反対仕訳で取消" onClick={() => confirm(`${j.id} を取り消します（反対仕訳を追加）。`) && d({ t: "journal-reverse", id: j.id, by: meId })}><RotateCcw size={13} />取消</button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody></table>
        {rows.length === 0 && <Empty>該当する仕訳がありません</Empty>}
        {rows.length > 300 && <p className="px-4 py-2 text-[12px] text-ink-3">先頭300件を表示しています（CSVには全件が含まれます）。</p>}
      </div>
      {open && <Compose onClose={() => setOpen(false)} />}
    </div>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const { s, d, meId } = useStore();
  const blank = (side: "D" | "C"): JLine & { amt: string } => ({ account: side === "D" ? "6250" : "1120", side, amount: 0, amt: "", tax: "課税10%", dept: "" });
  const [f, setF] = useState({ date: ymd(new Date()), memo: "", partner: "", evidenceNo: "", invoiceNo: "" });
  const [lines, setLines] = useState([blank("D"), blank("C")]);
  const conv: JLine[] = lines.map((l) => ({ account: l.account, side: l.side, amount: Number(l.amt) || 0, tax: l.tax as TaxKind, dept: l.dept || undefined }));
  const err = checkEntry({ date: f.date, lines: conv }) ?? (s.closed.includes(f.date.slice(0, 7)) ? "この月は締め済みです" : f.invoiceNo && !isInvoiceNo(f.invoiceNo) ? "登録番号は T + 13桁の数字です" : null);
  const set = (i: number, p: Partial<JLine & { amt: string }>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...p } : l)));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="仕訳起票">
      <form className="card my-6 w-full max-w-3xl space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (err) return; d({ t: "journal-add", core: { ...f, partner: f.partner || undefined, evidenceNo: f.evidenceNo || undefined, invoiceNo: f.invoiceNo || undefined, lines: conv, source: "manual", createdBy: meId } }); onClose(); }}>
        <h2 className="text-lg font-bold">仕訳の起票</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="label" htmlFor="jd">取引日</label><input id="jd" type="date" required className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="sm:col-span-3"><label className="label" htmlFor="jm">摘要</label><input id="jm" required className="input" value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></div>
          <div><label className="label" htmlFor="jp">取引先</label><input id="jp" className="input" value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })} /></div>
          <div><label className="label" htmlFor="je">証憑番号</label><input id="je" className="input" value={f.evidenceNo} onChange={(e) => setF({ ...f, evidenceNo: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="ji">適格請求書 登録番号</label><input id="ji" className="input tabular" placeholder="T1234567890123" value={f.invoiceNo} onChange={(e) => setF({ ...f, invoiceNo: e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2 sm:grid-cols-[3rem_1fr_7rem_6.5rem_8rem_2rem]">
              <select aria-label="貸借" className="input !px-1" value={l.side} onChange={(e) => set(i, { side: e.target.value as "D" | "C" })}><option value="D">借</option><option value="C">貸</option></select>
              <select aria-label="勘定科目" className="input" value={l.account} onChange={(e) => set(i, { account: e.target.value })}>{ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select>
              <input aria-label="金額" type="number" min={1} className="input tabular" placeholder="金額" value={l.amt} onChange={(e) => set(i, { amt: e.target.value })} />
              <select aria-label="税区分" className="input hidden sm:block" value={l.tax} onChange={(e) => set(i, { tax: e.target.value as TaxKind })}>{TAX_KINDS.map((t) => <option key={t}>{t}</option>)}</select>
              <select aria-label="部門" className="input hidden sm:block" value={l.dept} onChange={(e) => set(i, { dept: e.target.value })}><option value="">部門</option>{DEPARTMENTS.map((x) => <option key={x}>{x}</option>)}</select>
              <button type="button" aria-label="行を削除" className="hidden text-ink-3 sm:block" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn !h-8" onClick={() => setLines([...lines, blank("D")])}><Plus size={13} />行を追加</button>
        </div>
        <p className={`text-[12.5px] ${err ? "text-bad" : "text-good"}`}>{err ?? "✔ 貸借一致。起票後は「承認待ち」となり、起票者以外の経理担当・管理者が承認すると転記されます。"}</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!!err}>起票する</button></div>
      </form>
    </div>
  );
}
