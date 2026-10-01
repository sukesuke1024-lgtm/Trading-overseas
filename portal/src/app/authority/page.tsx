"use client";

import { NumInput } from "@/components/NumInput";
import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { APPROVERS, APPROVER_DESC, DEFAULT_AUTHORITY, describeRule, routeFor, yenJp, type Approver, type AuthorityRule } from "@/lib/authority";
import { WF_TYPES, type WfType } from "@/lib/data";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Badge, PageHeader } from "@/components/ui";

export default function AuthorityPage() {
  const { s, d, meId, role, nameOf } = useStore();
  const manage = can.manageAuthority(role);
  const [rules, setRules] = useState<AuthorityRule[]>(s.authority);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(rules) !== JSON.stringify(s.authority);
  const types = WF_TYPES.map((t) => t.type);
  const update = (i: number, patch: Partial<AuthorityRule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const toggle = (i: number, a: Approver) => { const cur = rules[i].steps; const next = cur.includes(a) ? cur.filter((x) => x !== a) : APPROVERS.filter((x) => cur.includes(x) || x === a); update(i, { steps: next }); };
  const valid = rules.every((r) => r.steps.length > 0 && r.min >= 0) && types.every((ty) => rules.some((r) => r.type === ty && r.min === 0));
  // 例：営業の社員が申請したときのルート（確認用）
  const sample = s.employees.find((e) => e.role === "employee" && e.bossId) ?? s.employees.find((e) => e.role === "employee");
  return (
    <div>
      <PageHeader title="職務権限規程（承認ルート）" sub="申請の種類と金額に応じて、承認者が自動で決まります。中小企業の標準的な水準を既定値にしています。"
        actions={manage ? <div className="flex gap-2"><button className="btn" onClick={() => { if (confirm("既定値に戻しますか？")) setRules(DEFAULT_AUTHORITY); }}><RotateCcw size={14} />既定値に戻す</button><button className="btn btn-primary" disabled={!dirty || !valid} onClick={() => { d({ t: "authority-set", rules, by: meId }); setMsg("保存しました。以後の申請から適用されます。"); }}>保存</button></div> : undefined} />
      {msg && <p role="status" className="mb-3 rounded-lg bg-good-soft px-3 py-2 text-[13px] text-good">{msg}</p>}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {types.map((ty) => {
          const rs = rules.map((r, i) => ({ r, i })).filter((x) => x.r.type === ty).sort((a, b) => a.r.min - b.r.min);
          return (
            <section key={ty} className="card p-4" aria-label={ty}>
              <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">{ty}</h2>{manage && <button className="btn !h-8" onClick={() => setRules([...rules, { type: ty as WfType, min: (rs.at(-1)?.r.min ?? 0) + 1_000_000, steps: ["所属長", "管理部"] }])}><Plus size={13} />区分を追加</button>}</div>
              <ul className="space-y-2">{rs.map(({ r, i }, k) => (
                <li key={i} className="rounded-lg bg-surface-2 p-2.5 text-[13px]">
                  {manage ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><label className="text-[12px] text-ink-3" htmlFor={`min-${i}`}>金額</label><NumInput id={`min-${i}`} disabled={r.min === 0 && k === 0} className="input !h-8 !w-36" value={String(r.min)} onChange={(v) => update(i, { min: Math.max(0, Number(v) || 0) })} /><span className="text-[12px] text-ink-3">円以上</span>{!(r.min === 0 && k === 0) && <button className="btn btn-danger !ml-auto !h-8 !w-8 !p-0" aria-label="この区分を削除" onClick={() => setRules(rules.filter((_, x) => x !== i))}><Trash2 size={13} /></button>}</div>
                      <div className="flex flex-wrap gap-1.5">{APPROVERS.map((a) => <label key={a} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] ${r.steps.includes(a) ? "border-brand bg-brand-soft font-semibold" : "border-line-strong"}`}><input type="checkbox" className="sr-only" checked={r.steps.includes(a)} onChange={() => toggle(i, a)} />{a}</label>)}</div>
                      <p className="text-[12px] text-ink-3">承認の順番：{r.steps.join(" → ") || "（承認者を選んでください）"}</p>
                    </div>
                  ) : <span>{describeRule(r, rs[k + 1]?.r)}</span>}
                </li>))}</ul>
            </section>
          );
        })}
      </div>
      <section className="card mb-4 p-4"><h2 className="mb-2 font-bold">承認者の決まり方</h2>
        <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">{APPROVERS.map((a) => <div key={a} className="flex gap-2"><dt className="w-14 shrink-0 font-semibold">{a}</dt><dd className="text-ink-2">{APPROVER_DESC[a]}</dd></div>)}</dl>
        <p className="mt-2 text-[12px] text-ink-3">申請者本人や、同じ人が重複する場合は自動で除きます。承認者が見つからない場合は社長決裁になります。承認の記録（いつ・誰が・理由）は社長・役員も含めて全て残ります。</p></section>
      {sample && <section className="card p-4"><h2 className="mb-2 font-bold">確認：{nameOf(sample.id)}さんが申請した場合</h2>
        <ul className="space-y-1 text-[13px]">{[["経費精算", 20_000], ["経費精算", 300_000], ["稟議", 1_000_000], ["稟議", 6_000_000]].map(([ty, amt]) => <li key={`${ty}${amt}`} className="flex flex-wrap items-center gap-2"><Badge>{ty}</Badge><span className="tabular w-20">{yenJp(amt as number)}</span><span className="text-ink-2">{routeFor(s.employees, rules, ty as WfType, amt as number, sample.id).map((x) => `${x.label}（${nameOf(x.approverId)}）`).join(" → ")}</span></li>)}</ul></section>}
      {role !== "admin" && <p className="mt-3 text-[12px] text-ink-3">規程の変更は管理者が行います。</p>}
    </div>
  );
}
