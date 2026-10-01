"use client";

import { useMemo, useState } from "react";
import { Building2, Network, Search } from "lucide-react";
import { ROLE_LABEL, type Employee } from "@/lib/data";
import { buildOrg, groupByDept, type OrgNode } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

type Tab = "list" | "org" | "dept";

export default function DirectoryPage() {
  const { s, role } = useStore();
  const [tab, setTab] = useState<Tab>("org");
  const [q, setQ] = useState("");
  const detail = can.viewEmployees(role); // 役員・管理者は雇用区分・メールも見える
  const list = useMemo(() => s.employees.filter((e) => !e.left && `${e.id}${e.name}${e.kana ?? ""}${e.job}${e.dept ?? ""}`.includes(q)), [s.employees, q]);
  const tree = useMemo(() => buildOrg(s.employees.filter((e) => !e.left)), [s.employees]);
  const groups = useMemo(() => groupByDept(s.employees.filter((e) => !e.left)), [s.employees]);

  return (
    <div>
      <PageHeader title="従業員名簿・組織図" sub="社内の連絡先と組織。部署・上司は管理者が従業員マスタで設定します。" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-2 p-1 text-[13px]" role="tablist">
          {([["org", "組織図", Network], ["dept", "部署別", Building2], ["list", "名簿", Search]] as const).map(([k, l, I]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-1 rounded-md px-3 py-1 ${tab === k ? "bg-white font-bold shadow-sm" : "text-ink-2"}`}><I size={13} aria-hidden />{l}</button>)}
        </div>
        {tab === "list" && <input className="input !w-64" placeholder="氏名・部署・職種で検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>

      {tab === "org" && (
        <div className="card overflow-x-auto p-4">
          {tree.length === 0 && <Empty>従業員がいません</Empty>}
          <ul className="space-y-1">{tree.map((n) => <OrgItem key={n.emp.id} n={n} depth={0} />)}</ul>
          {s.employees.every((e) => !e.bossId) && <p className="mt-4 text-[12px] text-ink-3">上司（報告先）がまだ設定されていません。管理者が「従業員・権限」で設定すると、階層の組織図になります。</p>}
        </div>
      )}
      {tab === "dept" && (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.dept} className="card p-4"><h2 className="mb-2 flex items-center gap-2 font-bold"><Building2 size={15} aria-hidden />{g.dept}<span className="text-[12px] font-normal text-ink-3">{g.members.length}名</span></h2>
              <ul className="divide-y divide-line text-[13px]">{g.members.map((e) => <li key={e.id} className="flex items-center gap-2 py-1.5"><Avatar e={e} /><span className="flex-1">{e.name}</span><span className="text-ink-3">{e.job}</span></li>)}</ul></section>
          ))}
        </div>
      )}
      {tab === "list" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]"><thead><tr><th className="th">氏名</th><th className="th">部署</th><th className="th">職種・役職</th>{detail && <><th className="th">雇用区分</th><th className="th">メール</th></>}</tr></thead>
            <tbody>{list.map((e) => <tr key={e.id}><td className="td"><div className="flex items-center gap-2"><Avatar e={e} /><div><div className="font-medium">{e.name}</div>{e.kana && <div className="text-[11.5px] text-ink-3">{e.kana}</div>}</div></div></td><td className="td">{e.dept ?? "—"}</td><td className="td">{e.job}</td>{detail && <><td className="td">{e.employment}</td><td className="td break-all">{e.email ?? "—"}</td></>}</tr>)}</tbody></table>
          {list.length === 0 && <Empty>該当する従業員はいません</Empty>}
        </div>
      )}
    </div>
  );
}

function Avatar({ e }: { e: Employee }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white" aria-hidden>{e.name[0]}</span>;
}

function OrgItem({ n, depth }: { n: OrgNode; depth: number }) {
  const e = n.emp;
  return (
    <li>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2" style={{ marginLeft: depth * 22 }}>
        <Avatar e={e} />
        <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{e.name}</div><div className="truncate text-[12px] text-ink-3">{e.dept ? `${e.dept}・` : ""}{e.job}</div></div>
        {e.role !== "employee" && <Badge tone={e.role === "admin" ? "bad" : "gray"}>{ROLE_LABEL[e.role]}</Badge>}
        {n.children.length > 0 && <span className="text-[11.5px] text-ink-3">部下 {n.children.length}名</span>}
      </div>
      {n.children.length > 0 && <ul className="mt-1 space-y-1 border-l border-line-strong" style={{ marginLeft: depth * 22 + 14 }}>{n.children.map((c) => <OrgItem key={c.emp.id} n={c} depth={1} />)}</ul>}
    </li>
  );
}
