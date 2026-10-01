"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MessageSquare, Plus, Save, Send, Trash2 } from "lucide-react";
import { latestCheck } from "@/lib/ops";
import { addDays, dowOf } from "@/lib/biz";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { fmtH, holidaySet, isHoliday, calcDay } from "@/lib/work";
import { Badge, Empty, PageHeader } from "@/components/ui";

const DOW = "日月火水木金土";
const jp = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}（${DOW[dowOf(iso)]}）`;
type Tab = "mine" | "team";

export default function ReportsPage() {
  const { s, meId, role } = useStore();
  const today = ymd(new Date());
  const [tab, setTab] = useState<Tab>("mine");
  const [date, setDate] = useState(today);
  const lead = can.viewAllReports(role);
  const recent = useMemo(() => Object.values(s.reports[meId] ?? {}).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14), [s.reports, meId]);

  return (
    <div>
      <PageHeader title="業務日報" sub="業務内容・時間・関与先コードを明細で記録します（必須）。関与先コードを入れると登録済みのデータが自動で入ります。提出後、役員・管理者が確認してコメントします。" />
      {lead && (
        <div className="mb-3 flex gap-1 border-b border-line" role="tablist">
          {([["mine", "自分の日報"], ["team", "全員の日報"]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${tab === k ? "border-brand text-brand" : "border-transparent text-ink-3"}`}>{l}</button>)}
        </div>
      )}
      {tab === "mine" || !lead ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <MyReport key={date} date={date} onDate={setDate} />
          <aside className="card self-start p-4"><h2 className="mb-2 font-bold">最近の日報</h2>
            <ul className="divide-y divide-line text-[13px]">{recent.map((r) => <li key={r.date}><button className="flex w-full items-center gap-2 py-2 text-left hover:bg-bg" onClick={() => setDate(r.date)}><span className="tabular w-20 shrink-0">{jp(r.date)}</span><Badge tone={r.status === "提出済" ? "good" : "gray"}>{r.status}</Badge>{r.comment && <MessageSquare size={13} className="text-brand-2" aria-label="コメントあり" />}</button></li>)}
              {recent.length === 0 && <li className="py-4 text-center text-ink-3">まだ日報がありません</li>}</ul></aside>
        </div>
      ) : <Team />}
      {recent.length === 0 && <p className="mt-3 text-[12px] text-ink-3">出勤した日は、退勤前までに提出してください。</p>}
    </div>
  );
}

type Row = { code: string; task: string; hours: string };
const emptyRow = (): Row => ({ code: "", task: "", hours: "" });

function MyReport({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const { s, d, meId, me } = useStore();
  const cur = s.reports[meId]?.[date];
  const att = s.attendance[meId]?.[date];
  const worked = att ? calcDay(att, me.scheduled, holidaySet(s.conditions), s.conditions).worked : 0;
  const [f, setF] = useState({ done: cur?.done ?? "", plan: cur?.plan ?? "", issues: cur?.issues ?? "" });
  const [rows, setRows] = useState<Row[]>(() => (cur?.lines?.length ? cur.lines.map((l) => ({ code: l.clientCode, task: l.task, hours: String(l.hours) })) : [emptyRow()]));
  const [msg, setMsg] = useState("");
  const submitted = cur?.status === "提出済";
  const clients = s.clients.filter((c) => c.active);
  const find = (code: string) => clients.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  const filled = rows.filter((r) => r.code.trim() || r.task.trim() || r.hours.trim());
  const rowErr = (r: Row): string[] => {
    const e: string[] = [];
    if (!r.code.trim()) e.push("関与先コード"); else if (!find(r.code)) e.push("登録されている関与先コード");
    if (!r.task.trim()) e.push("業務内容");
    const h = Number(r.hours); if (!(h > 0 && h <= 24)) e.push("時間（0より大きい数）");
    return e;
  };
  const errs = filled.map(rowErr);
  const total = filled.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const ready = filled.length > 0 && errs.every((e) => e.length === 0) && total <= 24;
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = (status: "下書き" | "提出済") => {
    if (filled.some((r) => rowErr(r).length) || total > 24) { setMsg(""); return; }
    d({ t: "report-save", emp: meId, report: { date, done: f.done, plan: f.plan, issues: f.issues, hours: total || undefined, lines: filled.map((r) => ({ clientCode: find(r.code)?.code ?? r.code.trim(), clientName: find(r.code)?.name ?? "", task: r.task.trim(), hours: Number(r.hours) })), status, ...(status === "提出済" ? { at: new Date().toISOString() } : {}) } });
    setMsg(status === "提出済" ? "提出しました" : "下書きを保存しました");
  };
  return (
    <section className="card p-4" aria-label="日報の入力">
      <div className="mb-3 flex flex-wrap items-center gap-2"><label className="label !mb-0" htmlFor="rd">日付</label><input id="rd" type="date" className="input !w-44" value={date} max={addDays(ymd(new Date()), 0)} onChange={(e) => e.target.value && onDate(e.target.value)} />{submitted ? <Badge tone="good">提出済</Badge> : <Badge>{cur ? "下書き" : "未作成"}</Badge>}{att && <span className="text-[12.5px] text-ink-3">勤怠：{att.start ?? "—"}〜{att.end ?? "—"}（実働 {fmtH(worked)}）</span>}</div>
      <h2 className="mb-1 font-bold">業務の明細 <span className="text-[12px] font-normal text-bad">（必須：関与先コード・業務内容・時間）</span></h2>
      <p className="mb-2 text-[12px] text-ink-3">関与先コードを入れると、登録済みの関与先名・事業部が自動で入ります。コードは「関与先・与信/反社」で管理されています。</p>
      <datalist id="client-codes">{clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</datalist>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const c = find(r.code);
          const e = r.code || r.task || r.hours ? rowErr(r) : [];
          return (
            <div key={i} className="rounded-lg border border-line p-2.5">
              <div className="grid gap-2 sm:grid-cols-[130px_1fr_90px_auto]">
                <input aria-label={`明細${i + 1} 関与先コード`} list="client-codes" className={`input tabular ${r.code && !c ? "!border-bad" : ""}`} placeholder="関与先コード" value={r.code} onChange={(ev) => setRow(i, { code: ev.target.value.toUpperCase() })} />
                <input aria-label={`明細${i + 1} 業務内容`} className="input" placeholder="業務内容（例：月次訪問・見積作成）" maxLength={500} value={r.task} onChange={(ev) => setRow(i, { task: ev.target.value })} />
                <input aria-label={`明細${i + 1} 時間`} type="number" step="0.25" min={0} max={24} className="input tabular" placeholder="時間" value={r.hours} onChange={(ev) => setRow(i, { hours: ev.target.value })} />
                <button type="button" className="btn btn-danger !px-2.5" aria-label={`明細${i + 1}を削除`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={14} /></button>
              </div>
              {c ? <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px]"><b>{c.name}</b><span className="text-ink-3">事業部：{c.dept}</span>{c.contact && <span className="text-ink-3">連絡先：{c.contact}</span>}{c.note && <span className="text-ink-3">{c.note}</span>}<CheckBadges code={c.code} /></p> : r.code ? <p className="mt-1.5 text-[12px] text-bad">このコードは登録されていません。</p> : null}
              {e.length > 0 && <p className="mt-1 text-[11.5px] text-warn">未入力・不正：{e.join("・")}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3"><button type="button" className="btn !h-8" onClick={() => setRows([...rows, emptyRow()])}><Plus size={13} />行を追加</button><span className="tabular text-[12.5px] text-ink-2">合計 {total}時間{att ? `（勤怠の実働 ${fmtH(worked)}）` : ""}</span>{total > 24 && <span className="text-[12px] text-bad">24時間を超えています</span>}</div>
      <div className="mt-4 space-y-3">
        <div><label className="label" htmlFor="r1">所感・補足（任意）</label><textarea id="r1" rows={3} maxLength={4000} className="input" value={f.done} onChange={(e) => setF({ ...f, done: e.target.value })} /></div>
        <div><label className="label" htmlFor="r2">明日の予定</label><textarea id="r2" rows={2} maxLength={4000} className="input" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></div>
        <div><label className="label" htmlFor="r3">課題・相談</label><textarea id="r3" rows={2} maxLength={4000} className="input" value={f.issues} onChange={(e) => setF({ ...f, issues: e.target.value })} /></div>
      </div>
      {cur?.comment && <div className="mt-4 rounded-lg bg-surface-2 p-3 text-[13px]"><div className="mb-1 flex items-center gap-1.5 font-semibold"><MessageSquare size={14} aria-hidden />確認コメント（{s.employees.find((e) => e.id === cur.commentBy)?.name ?? cur.commentBy}）</div><p className="whitespace-pre-wrap">{cur.comment}</p></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2"><button className="btn" onClick={() => save("下書き")} disabled={filled.length === 0 && !f.done && !f.plan && !f.issues}><Save size={14} />下書き保存</button><button className="btn btn-primary" onClick={() => save("提出済")} disabled={!ready}><Send size={14} />{submitted ? "再提出" : "提出する"}</button>{!ready && <span className="text-[12px] text-ink-3">提出には、明細（関与先コード・業務内容・時間）が1行以上必要です</span>}{msg && <span role="status" className="flex items-center gap-1 text-[13px] text-good"><CheckCircle2 size={14} />{msg}</span>}</div>
    </section>
  );
}

/** 関与先の与信・反社確認の最新結果 */
function CheckBadges({ code }: { code: string }) {
  const { s } = useStore();
  return <>{(["与信", "反社"] as const).map((k) => { const c = latestCheck(s.checks, code, k); return <Badge key={k} tone={!c ? "gray" : c.result === "問題なし" ? "good" : c.result === "確認中" ? "warn" : "bad"}>{k}：{c ? c.result : "未確認"}</Badge>; })}</>;
}

function Team() {
  const { s, d, meId } = useStore();
  const [date, setDate] = useState(ymd(new Date()));
  const hs = useMemo(() => holidaySet(s.conditions), [s.conditions]);
  const off = isHoliday(date, hs);
  const rows = s.employees.map((e) => ({ e, r: s.reports[e.id]?.[date], worked: !!s.attendance[e.id]?.[date]?.start }));
  const submitted = rows.filter((x) => x.r?.status === "提出済").length;
  const missing = rows.filter((x) => x.r?.status !== "提出済" && x.worked);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3"><input type="date" aria-label="日付" className="input !w-44" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><span className="text-[13px] text-ink-2">提出 {submitted} / {rows.length}名{off ? "（休日）" : ""}</span>{missing.length > 0 && <span className="text-[13px] text-warn">出勤したが未提出：{missing.map((x) => x.e.name).join("、")}</span>}</div>
      {rows.every((x) => !x.r) && <div className="card"><Empty>この日の日報はまだありません</Empty></div>}
      {rows.filter((x) => x.r).map(({ e, r }) => r && (
        <article key={e.id} className="card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2"><b>{e.name}</b><span className="text-[12px] text-ink-3">{e.dept ?? e.job}</span><Badge tone={r.status === "提出済" ? "good" : "gray"}>{r.status}</Badge>{r.hours != null && <span className="tabular text-[12px] text-ink-3">{r.hours}h</span>}</div>
          {r.lines && r.lines.length > 0 && <table className="mb-2 w-full text-[13px]"><thead><tr><th className="th">関与先</th><th className="th">業務内容</th><th className="th text-right">時間</th></tr></thead><tbody>{r.lines.map((l, i) => <tr key={i}><td className="td"><span className="tabular text-ink-3">{l.clientCode}</span> {l.clientName}</td><td className="td">{l.task}</td><td className="td tabular text-right">{l.hours}</td></tr>)}</tbody></table>}
          {([["所感・補足", r.done], ["明日の予定", r.plan], ["課題・相談", r.issues]] as const).map(([l, v]) => v && <div key={l} className="mb-2"><div className="text-[11.5px] font-semibold text-ink-3">{l}</div><p className="whitespace-pre-wrap text-[13.5px] leading-6">{v}</p></div>)}
          <CommentBox key={`${e.id}-${date}-${r.comment ?? ""}`} init={r.comment ?? ""} onSave={(c) => d({ t: "report-comment", emp: e.id, date, comment: c, by: meId })} />
        </article>
      ))}
    </div>
  );
}
function CommentBox({ init, onSave }: { init: string; onSave: (c: string) => void }) {
  const [v, setV] = useState(init);
  return <div className="flex gap-2"><input className="input flex-1" aria-label="コメント" maxLength={500} placeholder="確認コメント" value={v} onChange={(e) => setV(e.target.value)} /><button className="btn" disabled={v === init || !v.trim()} onClick={() => onSave(v.trim())}><MessageSquare size={14} />コメント</button></div>;
}
