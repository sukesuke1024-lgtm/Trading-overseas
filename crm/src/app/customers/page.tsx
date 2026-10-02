"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Plus, Search } from "lucide-react";
import { updateOrg, useMe, useStore } from "@/lib/store";
import { daysSince, orgRows, permsFor } from "@/lib/selectors";
import { COUNTRIES, SEGMENTS, flag, segmentLabel } from "@/lib/constants";
import { relativeDays } from "@/lib/dates";
import { yenShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { Avatar, DueChip, Empty, PageHeader } from "@/components/ui";
import { NewOrgDrawer } from "@/components/forms";
import { useRouter } from "next/navigation";

type K = "name" | "open" | "last" | "next";
export default function Customers() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const router = useRouter();
  const [q, setQ] = useState(""); const [country, setCountry] = useState(""); const [segment, setSegment] = useState(""); const [owner, setOwner] = useState("");
  const [sort, setSort] = useState<{ k: K; dir: 1 | -1 }>({ k: "name", dir: 1 });
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const f = orgRows(d).filter(({ org }) => (!q || (org.name + org.city + org.industry).toLowerCase().includes(q.toLowerCase())) && (!country || org.country === country) && (!segment || org.segment === segment) && (!owner || org.ownerId === owner));
    const v = (r: ReturnType<typeof orgRows>[number]): string | number => sort.k === "name" ? r.org.name : sort.k === "open" ? r.openJPY : sort.k === "last" ? r.last ?? "" : r.next?.dueDate ?? "9999";
    return f.sort((a, b) => { const A = v(a), B = v(b); return (A < B ? -1 : A > B ? 1 : 0) * sort.dir; });
  }, [d, q, country, segment, owner, sort]);
  const countries = [...new Set(d.organizations.map((o) => o.country))].sort((a, b) => COUNTRIES.indexOf(a) - COUNTRIES.indexOf(b));

  const th = (k: K, label: string, cls = "") => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}><span className="inline-flex items-center gap-1">{label}{sort.k === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</span></th>
  );
  return (
    <div>
      <PageHeader title="顧客" sub={`${rows.length}社　最終接触・次回予定は活動と Task から自動で表示されます`}
        actions={<><button className="btn" onClick={() => downloadCsv("customers.csv", [["会社名", "国", "都市", "区分", "獲得経路", "担当営業", "進行案件数", "進行案件額(円)", "最終接触", "次回予定"], ...rows.map(({ org, open, openJPY, last, next }) => [org.name, org.country, org.city, segmentLabel(org.segment), org.source, d.users.find((u) => u.id === org.ownerId)?.name, open.length, openJPY, last?.slice(0, 10), next?.dueDate])])}><Download size={14} />CSV</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />顧客を追加</button></>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-60 !pl-8" placeholder="会社名・都市・業種で検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select !w-auto" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">国：すべて</option>{countries.map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}</select>
        <select className="select !w-auto" value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">区分：すべて</option>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select className="select !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">担当：全員</option>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[960px]">
          <thead><tr>{th("name", "顧客")}<th>区分</th><th>担当営業</th>{th("open", "進行案件", "text-right")}{th("last", "最終接触")}{th("next", "次回予定")}</tr></thead>
          <tbody>
            {rows.map(({ org, open, openJPY, last, next }) => {
              const ds = daysSince(last);
              return (
                <tr key={org.id} className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest("select,a")) router.push(`/customers/view/?id=${org.id}`); }}>
                  <td className="max-w-[300px]"><Link href={`/customers/view/?id=${org.id}`} className="link">{flag(org.country)} {org.name}</Link><div className="text-[11.5px] text-ink-3">{org.city}・{org.industry}</div></td>
                  <td className="text-ink-2">{segmentLabel(org.segment)}</td>
                  <td className="w-[150px]"><div className="flex items-center gap-1.5"><Avatar user={d.users.find((u) => u.id === org.ownerId)} size={20} />
                    <select aria-label="担当営業" className="inline" disabled={!perms.canEdit(org.ownerId)} value={org.ownerId} onChange={(e) => updateOrg(org.id, { ownerId: e.target.value })}>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div></td>
                  <td className="num text-right">{open.length ? <><span className="font-semibold">{yenShort(openJPY)}</span><span className="ml-1 text-xs text-ink-3">{open.length}件</span></> : <span className="text-ink-3">—</span>}</td>
                  <td className="whitespace-nowrap">{last ? <span className={ds !== null && ds >= 30 ? "text-warn" : "text-ink-2"}>{relativeDays(last)}</span> : <span className="text-ink-3">なし</span>}</td>
                  <td className="max-w-[260px]">{next ? <div className="flex items-center gap-2"><DueChip due={next.dueDate} /><span className="truncate text-[12.5px] text-ink-2">{next.title}</span></div> : <span className="chip chip-warn">予定なし</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6}><Empty title="条件に一致する顧客がありません" /></td></tr>}
          </tbody>
        </table>
      </div>
      <NewOrgDrawer key={String(adding)} d={d} open={adding} onClose={() => setAdding(false)} onCreated={(id) => router.push(`/customers/view/?id=${id}`)} />
    </div>
  );
}
