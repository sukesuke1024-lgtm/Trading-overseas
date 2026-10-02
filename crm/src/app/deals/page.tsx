"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Plus, Search } from "lucide-react";
import { useMe, useStore, setNextAction, updateDeal } from "@/lib/store";
import { dealJPY, followReasons, nextActionOf, permsFor } from "@/lib/selectors";
import { STAGES, flag, stageOf } from "@/lib/constants";
import type { Data, Deal, StageId } from "@/lib/types";
import { addDays, endOfWeek, monthKey, todayStr } from "@/lib/dates";
import { money, yenShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { Avatar, DueChip, PageHeader, StageChip, Empty } from "@/components/ui";
import { NewDealDrawer, useStageMove } from "@/components/forms";
import { Suspended } from "@/components/Suspended";

type SortKey = "name" | "org" | "stage" | "amount" | "close" | "next";

export default function Page() { return <Suspended><Deals /></Suspended>; }

function Deals() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState(sp.get("owner") ?? "");
  const [stage, setStage] = useState<string>(sp.get("stage") ?? "open");
  const [period, setPeriod] = useState("all");
  const [minAmt, setMinAmt] = useState("");
  const [naFilter, setNaFilter] = useState(sp.get("follow") ? "follow" : "all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "close", dir: 1 });
  const [adding, setAdding] = useState(false);
  const { move, modal } = useStageMove();
  const t = todayStr();

  const rows = useMemo(() => {
    const orgOf = (x: Deal) => d.organizations.find((o) => o.id === x.orgId);
    const filtered = d.deals.filter((x) => {
      if (stage === "open" ? stageOf(x.stage).kind !== "open" : stage !== "all" && x.stage !== stage) return false;
      if (owner && x.ownerId !== owner) return false;
      if (q && !(x.name + orgOf(x)?.name + d.contacts.find((c) => c.id === x.contactId)?.name).toLowerCase().includes(q.toLowerCase())) return false;
      if (period === "month" && !(x.expectedCloseDate && monthKey(x.expectedCloseDate) === monthKey(t))) return false;
      if (period === "next" && !(x.expectedCloseDate && monthKey(x.expectedCloseDate) === monthKey(addDays(t, 31)))) return false;
      if (minAmt && dealJPY(x) < Number(minAmt) * 10000) return false;
      const na = nextActionOf(d, x.id);
      if (naFilter === "none" && na) return false;
      if (naFilter === "overdue" && !(na?.dueDate && na.dueDate < t)) return false;
      if (naFilter === "week" && !(na?.dueDate && na.dueDate <= endOfWeek())) return false;
      if (naFilter === "follow" && followReasons(d, x).length === 0) return false;
      return true;
    });
    const val = (x: Deal): string | number => {
      switch (sort.k) {
        case "name": return x.name; case "org": return orgOf(x)?.name ?? "";
        case "stage": return STAGES.findIndex((s) => s.id === x.stage); case "amount": return dealJPY(x);
        case "close": return x.expectedCloseDate ?? "9999"; case "next": return nextActionOf(d, x.id)?.dueDate ?? "0000";
      }
    };
    return filtered.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * sort.dir; });
  }, [d, q, owner, stage, period, minAmt, naFilter, sort, t]);

  const th = (k: SortKey, label: string, cls = "") => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <span className="inline-flex items-center gap-1">{label}{sort.k === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</span>
    </th>
  );

  const exportCsv = () => downloadCsv("deals.csv", [
    ["案件名", "顧客", "国", "担当者", "担当営業", "ステージ", "金額", "通貨", "円換算", "確度%", "予定受注日", "Next Action", "期限", "失注理由"],
    ...rows.map((x) => { const o = d.organizations.find((y) => y.id === x.orgId); const na = nextActionOf(d, x.id); return [x.name, o?.name, o?.country, d.contacts.find((c) => c.id === x.contactId)?.name, d.users.find((u) => u.id === x.ownerId)?.name, stageOf(x.stage).label, x.amount, x.currency, dealJPY(x), x.probability, x.expectedCloseDate, na?.title, na?.dueDate, x.lostReason]; }),
  ]);

  return (
    <div>
      <PageHeader title="案件" sub={`${rows.length}件・合計 ${yenShort(rows.reduce((a, x) => a + dealJPY(x), 0))}（円換算）　ステージ・金額・期限・Next Action は一覧のまま編集できます`}
        actions={<><button className="btn" onClick={exportCsv}><Download size={14} />CSV</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />案件を追加</button></>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-60 !pl-8" placeholder="案件・顧客・担当者を検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select !w-auto" value={stage} onChange={(e) => setStage(e.target.value)}><option value="open">ステージ：進行中</option><option value="all">ステージ：すべて</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select className="select !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">担当：全員</option>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select className="select !w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">予定受注日：すべて</option><option value="month">今月</option><option value="next">来月</option></select>
        <select className="select !w-auto" value={naFilter} onChange={(e) => setNaFilter(e.target.value)}><option value="all">Next Action：すべて</option><option value="follow">要フォロー</option><option value="none">未設定</option><option value="overdue">期限超過</option><option value="week">今週まで</option></select>
        <input className="input num !w-36" inputMode="numeric" placeholder="金額（万円）以上" value={minAmt} onChange={(e) => setMinAmt(e.target.value.replace(/\D/g, ""))} />
        {me.role === "sales" && <button className={`btn ${owner === me.id ? "btn-primary" : ""}`} onClick={() => setOwner(owner === me.id ? "" : me.id)}>自分のみ</button>}
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[1280px]">
          <thead><tr>{th("name", "案件名")}{th("org", "顧客")}{th("stage", "ステージ")}{th("amount", "金額", "text-right")}<th className="text-right">確度</th>{th("close", "予定受注日")}<th>担当</th>{th("next", "Next Action（期限）")}</tr></thead>
          <tbody>
            {rows.map((x) => <Row key={x.id} d={d} x={x} editable={perms.canEdit(x.ownerId)} onStage={(s) => move(x.id, s)} />)}
            {rows.length === 0 && <tr><td colSpan={8}><Empty title="条件に一致する案件がありません" hint="フィルタを変更してください。" /></td></tr>}
          </tbody>
        </table>
      </div>
      <NewDealDrawer key={String(adding)} d={d} open={adding} onClose={() => setAdding(false)} />
      {modal}
    </div>
  );
}

function Row({ d, x, editable, onStage }: { d: Data; x: Deal; editable: boolean; onStage: (s: StageId) => void }) {
  const org = d.organizations.find((o) => o.id === x.orgId);
  const na = nextActionOf(d, x.id);
  const open = stageOf(x.stage).kind === "open";
  const [draft, setDraft] = useState<string | null>(null);
  const commitNa = () => { if (draft !== null && draft.trim() && draft.trim() !== na?.title) setNextAction(x.id, { title: draft.trim(), type: na?.type ?? "email", due: na?.dueDate ?? addDays(todayStr(), 3) }); setDraft(null); };
  return (
    <tr>
      <td className="min-w-[250px]"><Link href={`/deals/view/?id=${x.id}`} className="link line-clamp-2 leading-snug">{x.name}</Link></td>
      <td className="min-w-[190px] max-w-[220px]"><Link href={`/customers/view/?id=${x.orgId}`} className="inline-flex max-w-full items-center gap-1.5 text-ink-2 hover:text-accent-2"><span>{flag(org?.country ?? "")}</span><span className="truncate">{org?.name}</span></Link></td>
      <td className="w-[128px]">
        <select aria-label="ステージ" className="inline font-medium" disabled={!editable} value={x.stage} onChange={(e) => onStage(e.target.value as StageId)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </td>
      <td className="num text-right font-semibold"><span className="whitespace-nowrap">{money(x.amount, x.currency)}</span>{x.currency !== "JPY" && <div className="text-[10.5px] font-normal text-ink-3">≈{yenShort(dealJPY(x))}</div>}</td>
      <td className="num w-[58px] text-right text-ink-2">{open ? `${x.probability}%` : "—"}</td>
      <td className="w-[132px]">{open ? <input type="date" aria-label="予定受注日" className="inline num" disabled={!editable} value={x.expectedCloseDate ?? ""} onChange={(e) => updateDeal(x.id, { expectedCloseDate: e.target.value || null })} /> : <StageChip stage={x.stage} />}</td>
      <td className="w-[104px]"><span className="inline-flex items-center gap-1.5"><Avatar user={d.users.find((u) => u.id === x.ownerId)} size={20} /><span className="truncate">{d.users.find((u) => u.id === x.ownerId)?.name}</span></span></td>
      <td className="min-w-[320px]">
        {open ? (
          <div className="flex items-center gap-2">
            <input aria-label="Next Action" className={`inline flex-1 ${!na ? "!bg-bad-soft placeholder:!text-bad" : ""}`} disabled={!editable} placeholder="Next Action を入力…" value={draft ?? na?.title ?? ""} onChange={(e) => setDraft(e.target.value)} onBlur={commitNa} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            {na && (
              <label className="relative shrink-0 cursor-pointer"><DueChip due={na.dueDate} />
                {editable && <input type="date" aria-label="期限" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={na.dueDate ?? ""} onChange={(e) => setNextAction(x.id, { title: na.title, type: na.type, due: e.target.value || null })} />}
              </label>
            )}
          </div>
        ) : <span className="text-ink-3">{x.stage === "lost" ? `失注：${x.lostReason}` : "—"}</span>}
      </td>
    </tr>
  );
}
