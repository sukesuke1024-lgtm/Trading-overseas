"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, DEPARTMENTS, EMPLOYEES } from "@/lib/data";
import { Empty, PageHeader } from "@/components/ui";

export default function Directory() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [dept, setDept] = useState("すべて");
  const [view, setView] = useState<"list" | "org">("list");
  const t = q.trim().toLowerCase();
  const rows = EMPLOYEES.filter((e) => (dept === "すべて" || e.dept === dept) && (!t || `${e.name}${e.kana}${e.dept}${e.title}${e.skills.join("")}${e.ext}`.toLowerCase().includes(t)));

  return (
    <div>
      <PageHeader title="社員名簿・組織図" sub="氏名・部署・スキルで検索できます。個人情報の取り扱いには十分ご注意ください。"
        actions={<div className="flex gap-1 rounded-lg border border-line-strong bg-surface p-0.5">{([["list", "名簿"], ["org", "組織図"]] as const).map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)} className={`rounded-md px-3 py-1 text-[13px] font-semibold ${view === k ? "bg-brand text-white" : ""}`}>{l}</button>)}</div>} />
      {view === "list" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input !w-72" placeholder="氏名・部署・スキル・内線で検索" value={q} onChange={(e) => setQ(e.target.value)} aria-label="検索" />
            <select className="input !w-56" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="部署"><option>すべて</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
            <span className="self-center text-[12.5px] text-ink-3">{rows.length}名</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft font-bold text-brand" aria-hidden>{e.name[0]}</div>
                  <div><div className="font-bold">{e.name}</div><div className="text-[12px] text-ink-3">{e.kana}</div></div>
                </div>
                <div className="mt-2 text-[13px]">{e.dept}／{e.title}</div>
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-ink-2">
                  <li className="flex items-center gap-2"><Phone size={13} aria-hidden />内線 <span className="tabular">{e.ext}</span></li>
                  <li className="flex items-center gap-2"><Mail size={13} aria-hidden /><a className="text-brand-2 hover:underline" href={`mailto:${e.email}`}>{e.email}</a></li>
                  <li className="flex items-center gap-2"><MapPin size={13} aria-hidden />{e.location}</li>
                </ul>
                <div className="mt-2 flex flex-wrap gap-1">{e.skills.map((s) => <span key={s} className="rounded bg-surface-2 px-1.5 text-[11px] text-ink-2">{s}</span>)}</div>
              </div>
            ))}
          </div>
          {rows.length === 0 && <Empty>該当する社員がいません</Empty>}
        </>
      ) : (
        <div className="card p-5">
          <div className="mx-auto mb-4 w-fit rounded-lg bg-brand px-5 py-2 font-bold text-white">{COMPANY.name} 代表取締役社長</div>
          <div className="mx-auto mb-4 h-4 w-px bg-line-strong" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map((dn) => {
              const m = EMPLOYEES.filter((e) => e.dept === dn);
              return (
                <div key={dn} className="rounded-lg border border-line p-3">
                  <div className="mb-1.5 flex justify-between font-bold"><span>{dn}</span><span className="tabular text-[12px] font-normal text-ink-3">{m.length}名</span></div>
                  <ul className="space-y-0.5 text-[13px]">{m.map((e) => <li key={e.id} className="flex justify-between"><span>{e.name}</span><span className="text-ink-3">{e.title}</span></li>)}</ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
