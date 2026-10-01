"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CircleDot, Plus, RotateCcw, X, Circle } from "lucide-react";
import { workdaysBetween } from "@/lib/work";
import { TAX_KINDS, acct, isInvoiceNo } from "@/lib/accounting";
import { WF_TYPES, type WfStatus, type WfType, type Workflow } from "@/lib/data";
import { EXPENSE_ACCOUNTS, useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, yen } from "@/components/ui";

const TONE: Record<WfStatus, "warn" | "good" | "bad" | "gray"> = { 承認待ち: "warn", 承認済: "good", 差戻し: "bad", 却下: "bad", 取下げ: "gray" };
type Tab = "todo" | "mine" | "all";

export default function WorkflowPage() {
  const { s, meId, role, nameOf } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id");
  const newType = sp.get("new") as WfType | null;
  const [tab, setTab] = useState<Tab>("todo");

  const rows = useMemo(() => s.workflows.filter((w) => {
    if (tab === "todo") return w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId;
    if (tab === "mine") return w.applicantId === meId;
    return role !== "employee";
  }), [s.workflows, role, tab, meId]);

  if (newType !== null || sp.has("new")) return <NewForm initial={WF_TYPES.some((t) => t.type === newType) ? newType! : "経費精算"} />;
  const cur = s.workflows.find((w) => w.id === id);
  if (cur) return <Detail w={cur} onBack={() => router.push("/workflow")} />;

  const todoCount = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId).length;
  return (
    <div>
      <PageHeader title="ワークフロー" sub="申請・承認。決裁権限表に基づき承認ルートが自動設定されます。"
        actions={<button className="btn btn-primary" onClick={() => router.push("/workflow?new")}><Plus size={15} />新規申請</button>} />
      <div className="mb-3 flex gap-1 border-b border-line" role="tablist">
        {([["todo", `承認待ち（${todoCount}）`], ["mine", "自分の申請"], ...(role !== "employee" ? [["all", "全件"]] : [])] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${tab === k ? "border-brand text-brand" : "border-transparent text-ink-3"}`}>{l}</button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead><tr><th className="th">申請番号</th><th className="th">種別</th><th className="th">件名</th><th className="th">申請者</th><th className="th text-right">金額</th><th className="th">状態</th></tr></thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="cursor-pointer hover:bg-bg" onClick={() => router.push(`/workflow?id=${w.id}`)}>
                <td className="td tabular text-ink-3">{w.id}</td><td className="td">{w.type}</td>
                <td className="td font-medium">{w.title}</td><td className="td">{nameOf(w.applicantId)}</td>
                <td className="td tabular text-right">{w.amount ? yen(w.amount) : "—"}</td>
                <td className="td"><Badge tone={TONE[w.status]}>{w.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>{tab === "todo" ? "承認待ちの案件はありません（「表示ロール」を承認者に切り替えると確認できます）" : "該当する申請はありません"}</Empty>}
      </div>
    </div>
  );
}

function NewForm({ initial }: { initial: WfType }) {
  const { d, meId, nextWfId, approvalRoute, nameOf, holidays } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ type: initial, title: "", amount: "", detail: "", from: ymd(new Date()), to: ymd(new Date()), category: "6210", taxKind: "課税10%", invoiceNo: "" });
  const amt = Number(f.amount) || 0;
  const route = approvalRoute(f.type, amt, meId);
  const isLeave = f.type === "休暇申請";
  const isExpense = f.type === "経費精算" || f.type === "出張申請";
  const invErr = isExpense && f.invoiceNo && !isInvoiceNo(f.invoiceNo) ? "登録番号は「T」＋13桁の数字です" : "";
  const days = workdaysBetween(f.from, f.to, holidays); // 土日祝を除いた日数を自動計算
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invErr) return;
    const w: Workflow = {
      id: nextWfId(), type: f.type,
      title: f.title || (isLeave ? `年次有給休暇 ${f.from}〜${f.to}（${days.length}日）` : f.type),
      applicantId: meId, amount: isLeave || !amt ? undefined : amt,
      ...(isLeave ? { from: f.from, to: f.to } : {}),
      ...(isExpense ? { category: f.category, taxKind: f.taxKind, invoiceNo: f.invoiceNo || undefined } : {}),
      detail: f.detail, createdAt: ymd(new Date()), status: "承認待ち", steps: route,
    };
    d({ t: "wf-new", w });
    router.push(`/workflow?id=${w.id}`);
  };
  return (
    <div className="max-w-3xl">
      <button className="btn mb-4" onClick={() => router.push("/workflow")}><ArrowLeft size={14} />一覧へ</button>
      <PageHeader title="新規申請" />
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="wt">申請種別</label><select id="wt" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as WfType })}>{WF_TYPES.map((t) => <option key={t.type}>{t.type}</option>)}</select></div>
          {!isLeave && <div><label className="label" htmlFor="wa">金額（円）</label><input id="wa" type="number" min={0} className="input tabular" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>}
        </div>
        {isLeave && <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="lf">開始日</label><input id="lf" type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div><div><label className="label" htmlFor="lt">終了日</label><input id="lt" type="date" min={f.from} className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div><p className="text-[12.5px] text-ink-2 sm:col-span-2">取得日数（土日祝を除く自動計算）：<b className="tabular">{days.length}日</b>{days.length === 0 && <span className="ml-2 text-bad">対象期間に営業日がありません</span>}</p></div>}
        {isExpense && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label" htmlFor="wc">勘定科目</label><select id="wc" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_ACCOUNTS.map((c) => <option key={c} value={c}>{acct(c)?.name}</option>)}</select></div>
            <div><label className="label" htmlFor="wx">税区分</label><select id="wx" className="input" value={f.taxKind} onChange={(e) => setF({ ...f, taxKind: e.target.value })}>{TAX_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div><label className="label" htmlFor="wi">適格請求書 登録番号</label><input id="wi" className="input tabular" placeholder="T1234567890123" value={f.invoiceNo} onChange={(e) => setF({ ...f, invoiceNo: e.target.value })} />{invErr && <p className="mt-1 text-[12px] text-bad">{invErr}</p>}</div>
            <p className="text-[12px] text-ink-3 sm:col-span-3">承認完了後、経理へ自動で仕訳（費用／仮払消費税／未払金）が作成されます。登録番号がない場合は仕入税額控除の対象外として処理されます。</p>
          </div>
        )}
        <div><label className="label" htmlFor="wn">件名</label><input id="wn" required={!isLeave} className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label" htmlFor="wd">内容・理由</label><textarea id="wd" required rows={5} className="input" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></div>
        <div>
          <div className="label">承認ルート（自動設定）</div>
          <ol className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {route.map((r, i) => <li key={i} className="flex items-center gap-2"><span className="rounded-md bg-surface-2 px-2 py-1">{r.label}：{nameOf(r.approverId)}</span>{i < route.length - 1 && <span className="text-ink-3">→</span>}</li>)}
          </ol>
          {f.type === "稟議" && amt >= 1000000 && <p className="mt-2 text-[12px] text-warn">100万円以上のため、決裁権限表により経営企画部の承認が追加されました。</p>}
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => router.push("/workflow")}>キャンセル</button><button className="btn btn-primary" disabled={isLeave && days.length === 0}>申請する</button></div>
      </form>
    </div>
  );
}

function Detail({ w, onBack }: { w: Workflow; onBack: () => void }) {
  const { d, meId, nameOf, emp } = useStore();
  const [comment, setComment] = useState("");
  const active = w.steps.find((x) => x.state === "承認待ち");
  const canAct = w.status === "承認待ち" && active?.approverId === meId;
  const mine = w.applicantId === meId;
  const act = (a: "承認" | "差戻し" | "却下") => {
    if (a !== "承認" && !comment.trim()) { alert("差戻し・却下の場合はコメントを入力してください。"); return; }
    d({ t: "wf-act", id: w.id, approverId: meId, act: a, comment });
    setComment("");
  };
  return (
    <div className="max-w-4xl">
      <button className="btn mb-4" onClick={onBack}><ArrowLeft size={14} />一覧へ</button>
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2"><Badge tone={TONE[w.status]}>{w.status}</Badge><span className="tabular text-[12px] text-ink-3">{w.id}・{w.type}</span></div>
        <h1 className="mb-4 text-xl font-bold">{w.title}</h1>
        <dl className="grid gap-3 text-[13.5px] sm:grid-cols-3">
          <div><dt className="text-[12px] text-ink-3">申請者</dt><dd>{nameOf(w.applicantId)}（{emp(w.applicantId)?.job}）</dd></div>
          <div><dt className="text-[12px] text-ink-3">申請日</dt><dd className="tabular">{w.createdAt}</dd></div>
          <div><dt className="text-[12px] text-ink-3">金額</dt><dd className="tabular">{w.amount ? yen(w.amount) : "—"}</dd></div>
        </dl>
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-bg p-3">{w.detail}</p>

        <h2 className="mb-2 mt-6 font-bold">承認履歴</h2>
        <ol className="space-y-3">
          {w.steps.map((st, i) => {
            const Icon = st.state === "承認" ? Check : st.state === "承認待ち" ? CircleDot : st.state === "待機" ? Circle : X;
            const c = st.state === "承認" ? "text-good" : st.state === "承認待ち" ? "text-brand-2" : st.state === "待機" ? "text-ink-3" : "text-bad";
            return (
              <li key={i} className="flex gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${c}`} aria-hidden />
                <div><div className="font-medium">{st.label}：{nameOf(st.approverId)}<span className={`ml-2 text-[12px] ${c}`}>{st.state}</span>{st.at && <span className="tabular ml-2 text-[12px] text-ink-3">{st.at}</span>}</div>{st.comment && <div className="text-[13px] text-ink-2">「{st.comment}」</div>}</div>
              </li>
            );
          })}
        </ol>

        {canAct && (
          <div className="mt-6 border-t border-line pt-4">
            <label className="label" htmlFor="cm">コメント（差戻し・却下は必須）</label>
            <textarea id="cm" rows={2} className="input mb-3" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2"><button className="btn btn-primary" onClick={() => act("承認")}><Check size={15} />承認</button><button className="btn" onClick={() => act("差戻し")}><RotateCcw size={14} />差戻し</button><button className="btn btn-danger" onClick={() => act("却下")}><X size={15} />却下</button></div>
          </div>
        )}
        {mine && w.status === "承認待ち" && <div className="mt-6 border-t border-line pt-4"><button className="btn btn-danger" onClick={() => confirm("この申請を取り下げますか？") && d({ t: "wf-cancel", id: w.id, by: meId })}>申請を取り下げる</button></div>}
        {!canAct && w.status === "承認待ち" && !mine && <p className="mt-4 text-[12px] text-ink-3">この案件の現在の承認者は {nameOf(active?.approverId ?? "")} です。</p>}
      </div>
    </div>
  );
}
