"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck2 } from "lucide-react";
import { paidLeave } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, Progress } from "@/components/ui";

export default function LeavePage() {
  const { s, me, meId, role } = useStore();
  const today = ymd(new Date());
  const [onlyAlert, setOnlyAlert] = useState(false);
  const mine = paidLeave(me, s.attendance[meId], today);
  const all = can.viewAllLeave(role);
  const rows = s.employees.filter((e) => !e.left).map((e) => ({ e, p: paidLeave(e, s.attendance[e.id], today) }));
  const alerts = rows.filter((x) => x.p?.obligation && x.p.needMore > 0 && x.p.daysToDeadline <= 120);
  const myDays = Object.values(s.attendance[meId] ?? {}).filter((d) => d.kind === "有給休暇" && mine && d.date >= mine.grantDate && d.date < mine.nextGrant).map((d) => d.date).sort();

  return (
    <div>
      <PageHeader title="有給管理" sub="年次有給休暇の付与・取得・残日数。取得日数は勤怠の「有給休暇」から自動で数えます。" actions={<Link href="/workflow?new=休暇申請" className="btn btn-primary"><CalendarCheck2 size={15} />休暇を申請</Link>} />
      <section className="card mb-5 p-4" aria-label="あなたの有給">
        <h2 className="mb-3 font-bold">あなたの有給（{me.name}）</h2>
        {!mine ? <p className="text-[13px] text-ink-2">入社日が未登録のため計算できません。管理者に入社日（または付与日数）の登録を依頼してください。</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["今期の付与", `${mine.granted}日`, mine.manual ? "手入力" : `法定${mine.statutory}日${mine.carry ? `＋繰越${mine.carry}日` : ""}`], ["取得済み", `${mine.used}日`, ""], ["残り", `${mine.remaining}日`, ""], ["次回付与日", mine.nextGrant, `あと${mine.daysToDeadline}日`]].map(([l, v, sub]) => <div key={l} className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[11.5px] text-ink-3">{l}</div><div className="tabular text-lg font-bold">{v}</div>{sub && <div className="text-[11px] text-ink-3">{sub}</div>}</div>)}
            </div>
            <div className="mt-3"><div className="mb-1 flex justify-between text-[12.5px]"><span>取得率</span><span className="tabular">{mine.granted ? Math.round((mine.used / mine.granted) * 100) : 0}%</span></div><Progress value={mine.granted ? (mine.used / mine.granted) * 100 : 0} /></div>
            {mine.obligation && (mine.needMore > 0
              ? <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />年5日の取得義務があります。{mine.nextGrant}までに、あと<b>{mine.needMore}日</b>取得してください。</p>
              : <p className="mt-3 rounded-lg bg-good-soft px-3 py-2 text-[13px] text-good">年5日の取得義務は達成しています。</p>)}
            {myDays.length > 0 && <p className="mt-3 text-[12.5px] text-ink-2">取得日：{myDays.join("、")}</p>}
            <p className="mt-2 text-[11.5px] text-ink-3">付与期間 {mine.grantDate} 〜 {mine.nextGrant}。前期の未消化分は繰越（時効2年）。パート・短時間勤務など法定と異なる場合は、管理者が付与日数を手入力します。</p>
          </>
        )}
      </section>

      {all && (
        <section className="card overflow-x-auto" aria-label="全員の有給">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3"><h2 className="font-bold">全員の有給</h2>{alerts.length > 0 && <Badge tone="warn">5日取得が未達 {alerts.length}名</Badge>}<label className="ml-auto flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={onlyAlert} onChange={(e) => setOnlyAlert(e.target.checked)} />要対応のみ</label></div>
          <table className="w-full min-w-[760px] text-[13px]"><thead><tr><th className="th">氏名</th><th className="th text-right">付与</th><th className="th text-right">取得</th><th className="th text-right">残</th><th className="th">次回付与</th><th className="th">5日取得</th></tr></thead>
            <tbody>{rows.filter((x) => !onlyAlert || (x.p?.obligation && x.p.needMore > 0)).map(({ e, p }) => (
              <tr key={e.id}><td className="td font-medium">{e.name}<span className="ml-2 text-[11.5px] text-ink-3">{e.dept ?? e.job}</span></td>
                {p ? <><td className="td tabular text-right">{p.granted}</td><td className="td tabular text-right">{p.used}</td><td className="td tabular text-right font-semibold">{p.remaining}</td><td className="td tabular">{p.nextGrant}</td><td className="td">{!p.obligation ? <span className="text-ink-3">対象外</span> : p.needMore === 0 ? <Badge tone="good">達成</Badge> : <Badge tone={p.daysToDeadline <= 120 ? "bad" : "warn"}>あと{p.needMore}日</Badge>}</td></> : <td className="td text-ink-3" colSpan={5}>入社日が未登録（従業員マスタで設定）</td>}</tr>))}</tbody></table>
          {rows.length === 0 && <Empty>従業員がいません</Empty>}
          {can.manageEmployees(role) && <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">付与日数や入社日の修正は「従業員・権限」の編集から行えます。</p>}
        </section>
      )}
    </div>
  );
}
