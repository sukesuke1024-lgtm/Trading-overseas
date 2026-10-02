"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Crown, Download, Mail, Phone, Plus, Search, Star } from "lucide-react";
import { updateContact, useMe, useStore } from "@/lib/store";
import { permsFor } from "@/lib/selectors";
import { flag } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { Empty, PageHeader } from "@/components/ui";
import { NewContactDrawer } from "@/components/forms";

export default function Contacts() {
  const d = useStore().data!;
  const perms = permsFor(useMe());
  const [q, setQ] = useState(""); const [flagOnly, setFlagOnly] = useState("all"); const [adding, setAdding] = useState(false);
  const rows = useMemo(() => d.contacts.filter((c) => {
    const o = d.organizations.find((x) => x.id === c.orgId);
    if (q && !(c.name + c.email + c.title + o?.name).toLowerCase().includes(q.toLowerCase())) return false;
    if (flagOnly === "dm" && !c.isDecisionMaker) return false;
    if (flagOnly === "primary" && !c.isPrimary) return false;
    return true;
  }).sort((a, b) => (d.organizations.find((o) => o.id === a.orgId)?.name ?? "").localeCompare(d.organizations.find((o) => o.id === b.orgId)?.name ?? "")), [d, q, flagOnly]);
  return (
    <div>
      <PageHeader title="担当者" sub={`${rows.length}名　主要連絡先・意思決定者はワンクリックで切り替えできます`}
        actions={<><button className="btn" onClick={() => downloadCsv("contacts.csv", [["氏名", "顧客", "部署", "役職", "Email", "電話", "主要連絡先", "意思決定者", "備考"], ...rows.map((c) => [c.name, d.organizations.find((o) => o.id === c.orgId)?.name, c.department, c.title, c.email, c.phone, c.isPrimary ? "○" : "", c.isDecisionMaker ? "○" : "", c.note])])}><Download size={14} />CSV</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />担当者を追加</button></>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[10px] text-ink-3" /><input className="input !w-64 !pl-8" placeholder="氏名・会社・Email で検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select !w-auto" value={flagOnly} onChange={(e) => setFlagOnly(e.target.value)}><option value="all">すべて</option><option value="dm">意思決定者のみ</option><option value="primary">主要連絡先のみ</option></select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[900px]">
          <thead><tr><th>氏名</th><th>顧客</th><th>部署・役職</th><th>連絡先</th><th className="text-center">主要</th><th className="text-center">決裁者</th><th>備考</th></tr></thead>
          <tbody>
            {rows.map((c) => { const o = d.organizations.find((x) => x.id === c.orgId); const ed = perms.canEdit(o?.ownerId); return (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td><Link className="link !font-medium" href={`/customers/view/?id=${c.orgId}`}>{flag(o?.country ?? "")} {o?.name}</Link></td>
                <td className="text-ink-2">{[c.department, c.title].filter(Boolean).join("・")}</td>
                <td className="text-[12px] text-ink-2"><a className="flex items-center gap-1 hover:text-accent-2" href={`mailto:${c.email}`}><Mail size={11} />{c.email}</a><a className="flex items-center gap-1 hover:text-accent-2" href={`tel:${c.phone}`}><Phone size={11} />{c.phone}</a></td>
                <td className="text-center"><button disabled={!ed} aria-label="主要連絡先" onClick={() => updateContact(c.id, { isPrimary: !c.isPrimary })} className={c.isPrimary ? "text-accent-2" : "text-ink-3/40 hover:text-ink-2"}><Star size={16} fill={c.isPrimary ? "currentColor" : "none"} /></button></td>
                <td className="text-center"><button disabled={!ed} aria-label="意思決定者" onClick={() => updateContact(c.id, { isDecisionMaker: !c.isDecisionMaker })} className={c.isDecisionMaker ? "text-warn" : "text-ink-3/40 hover:text-ink-2"}><Crown size={16} fill={c.isDecisionMaker ? "currentColor" : "none"} /></button></td>
                <td className="max-w-[260px] truncate text-[12px] text-ink-3">{c.note}</td>
              </tr>); })}
            {rows.length === 0 && <tr><td colSpan={7}><Empty title="該当する担当者がいません" /></td></tr>}
          </tbody>
        </table>
      </div>
      <NewContactDrawer key={String(adding)} d={d} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
