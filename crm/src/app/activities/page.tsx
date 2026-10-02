"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { openQuickLog, useStore } from "@/lib/store";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { addDays, todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { Timeline } from "@/components/forms";

export default function Activities() {
  const d = useStore().data!;
  const [type, setType] = useState(""); const [user, setUser] = useState(""); const [period, setPeriod] = useState("30"); const [q, setQ] = useState("");
  const items = useMemo(() => {
    const from = period === "all" ? "" : addDays(todayStr(), -Number(period));
    return d.activities.filter((a) => (!type || a.type === type) && (!user || a.userId === user) && (!from || a.at.slice(0, 10) >= from)
      && (!q || (a.summary + a.note + d.organizations.find((o) => o.id === a.orgId)?.name).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.at.localeCompare(a.at));
  }, [d, type, user, period, q]);
  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title="活動履歴" sub={`${items.length}件　チーム全体の接触履歴`} actions={<button className="btn btn-primary" onClick={() => openQuickLog()}><Plus size={15} />活動を記録</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input !w-56" placeholder="内容・顧客で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select !w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">種別：すべて</option>{ACTIVITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select className="select !w-auto" value={user} onChange={(e) => setUser(e.target.value)}><option value="">担当：全員</option>{d.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select className="select !w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="7">直近7日</option><option value="30">直近30日</option><option value="90">直近90日</option><option value="all">すべて</option></select>
      </div>
      <div className="card p-5"><Timeline d={d} items={items} showOrg /></div>
    </div>
  );
}
