"use client";

import { NumInput } from "@/components/NumInput";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CircleDot, Paperclip, Plus, RotateCcw, X, Circle } from "lucide-react";
import { workdaysBetween } from "@/lib/work";
import { TAX_KINDS, acct, isInvoiceNo } from "@/lib/accounting";
import { WF_TYPES, type WfStatus, type WfType, type Workflow } from "@/lib/data";
import { EXPENSE_ACCOUNTS, useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader, yen } from "@/components/ui";
import { FileDownload, UploadButton } from "@/components/Files";
import { DropZone } from "@/components/DropZone";
import { uploadFile, type Uploaded } from "@/lib/files";
import { deptOf, fmtBytes } from "@/lib/ops";
import { describeRule, ruleFor } from "@/lib/authority";

const TONE: Record<WfStatus, "warn" | "good" | "bad" | "gray"> = { 承認待ち: "warn", 承認済: "good", 差戻し: "bad", 却下: "bad", 取下げ: "gray" };
type Tab = "todo" | "mine" | "all";

export default function WorkflowPage() {
  const { s, meId, role, nameOf } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id");
  const newType = sp.get("new") as WfType | null;
  const typeFilter = WF_TYPES.find((x) => x.type === sp.get("type"))?.type ?? null; // 経費精算・稟議など種別ごとの一覧
  const [tab, setTab] = useState<Tab>("todo");

  const rows = useMemo(() => s.workflows.filter((w) => {
    if (typeFilter && w.type !== typeFilter) return false;
    if (tab === "todo") return w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId;
    if (tab === "mine") return w.applicantId === meId;
    return role !== "employee";
  }), [s.workflows, role, tab, meId, typeFilter]);

  if (newType !== null || sp.has("new")) return <NewForm initial={WF_TYPES.some((t) => t.type === newType) ? newType! : "経費精算"} />;
  const cur = s.workflows.find((w) => w.id === id);
  if (cur) return <Detail w={cur} onBack={() => router.push("/workflow")} />;

  const todoCount = s.workflows.filter((w) => w.status === "承認待ち" && w.steps.find((x) => x.state === "承認待ち")?.approverId === meId).length;
  return (
    <div>
      <PageHeader title={typeFilter ?? "申請・承認"} sub={typeFilter === "経費精算" ? "経費の精算申請。最終承認で仕訳が自動作成されます。" : typeFilter === "稟議" ? "稟議書・決裁。金額に応じて承認ルートが自動設定されます。" : "経費精算・休暇・出張・稟議などの申請と承認。承認ルートは金額・申請者に応じて自動設定されます。"}
        actions={<button className="btn btn-primary" onClick={() => router.push(typeFilter ? `/workflow?new=${encodeURIComponent(typeFilter)}` : "/workflow?new")}><Plus size={15} />{typeFilter ? `${typeFilter}を申請` : "新規申請"}</button>} />
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
  const { s, d, me, meId, nextWfId, approvalRoute, nameOf, holidays } = useStore();
  const router = useRouter();
  const [pending, setPending] = useState<Uploaded[]>([]);
  const [upErr, setUpErr] = useState("");
  const [wfId] = useState(() => nextWfId());
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
      id: wfId, type: f.type,
      title: f.title || (isLeave ? `年次有給休暇 ${f.from}〜${f.to}（${days.length}日）` : f.type),
      applicantId: meId, amount: isLeave || !amt ? undefined : amt,
      ...(isLeave ? { from: f.from, to: f.to } : {}),
      ...(isExpense ? { category: f.category, taxKind: f.taxKind, invoiceNo: f.invoiceNo || undefined } : {}),
      detail: f.detail, createdAt: ymd(new Date()), status: "承認待ち", steps: route,
    };
    d({ t: "wf-new", w });
    for (const u of pending) d({ t: "file-add", rec: { id: u.id, name: u.name, size: u.size, mime: u.mime, kind: "申請添付", scope: "申請", wfId: w.id, dept: deptOf(me), uploadedBy: meId, at: new Date().toISOString() } });
    router.push(`/workflow?id=${w.id}`);
  };
  return (
    <div className="max-w-3xl">
      <button className="btn mb-4" onClick={() => router.push("/workflow")}><ArrowLeft size={14} />一覧へ</button>
      <PageHeader title="新規申請" />
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="wt">申請種別</label><select id="wt" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as WfType })}>{WF_TYPES.filter((t) => t.type !== "異動変更届").map((t) => <option key={t.type}>{t.type}</option>)}</select></div>
          {!isLeave && <div><label className="label" htmlFor="wa">金額（円）</label><NumInput id="wa" className="input" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></div>}
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
          {(() => { const r = ruleFor(s.authority, f.type, amt); return r ? <p className="mt-2 text-[12px] text-ink-3">職務権限規程：{describeRule(r)}（金額に応じて自動で分岐します。<a href="/authority" className="underline">規程を見る</a>）</p> : null; })()}
        </div>
        <div>
          <div className="label">添付ファイル（領収書・見積書など）</div>
          <DropZone multiple compact label="ここに領収書・見積書をドラッグ＆ドロップ" onFiles={async (files) => { setUpErr(""); for (const file of files) { const r = await uploadFile(file); if ("error" in r) setUpErr(`${file.name}：${r.error}`); else setPending((p) => [...p, r]); } }} />
          {upErr && <p role="alert" className="mt-1 text-[12px] text-bad">{upErr}</p>}
          <ul className="mt-1 space-y-0.5 text-[12.5px]">{pending.map((u) => <li key={u.id} className="flex items-center gap-2"><Paperclip size={12} aria-hidden />{u.name}（{fmtBytes(u.size)}）<button type="button" className="text-ink-3 underline" onClick={() => setPending((p) => p.filter((x) => x.id !== u.id))}>外す</button></li>)}</ul>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => router.push("/workflow")}>キャンセル</button><button className="btn btn-primary" disabled={isLeave && days.length === 0}>申請する</button></div>
      </form>
    </div>
  );
}

const ACTION_TONE: Record<string, "good" | "bad" | "warn" | "gray"> = { 申請: "gray", 承認: "good", 差戻し: "warn", 却下: "bad", 取下げ: "gray", 修正再申請: "warn" };
const stamp = (iso?: string) => (iso && iso.length > 10 ? iso.slice(0, 16).replace("T", " ") : iso ?? "");

function Detail({ w, onBack }: { w: Workflow; onBack: () => void }) {
  const { d, me, meId, role, nameOf, emp, approvalRoute, files: vfiles } = useStore();
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [edit, setEdit] = useState(false);
  const active = w.steps.find((x) => x.state === "承認待ち");
  const canAct = w.status === "承認待ち" && active?.approverId === meId;
  const mine = w.applicantId === meId;
  const files = vfiles.filter((f) => f.wfId === w.id);
  const history = w.history ?? [];
  const act = (a: "承認" | "差戻し" | "却下") => {
    if (a !== "承認" && !comment.trim()) { alert("差戻し・却下は、理由の入力が必要です。"); return; }
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
          <div><dt className="text-[12px] text-ink-3">申請者</dt><dd>{nameOf(w.applicantId)}（{emp(w.applicantId)?.dept ?? ""} {emp(w.applicantId)?.job}）</dd></div>
          <div><dt className="text-[12px] text-ink-3">申請日</dt><dd className="tabular">{w.createdAt}</dd></div>
          <div><dt className="text-[12px] text-ink-3">金額</dt><dd className="tabular">{w.amount ? yen(w.amount) : "—"}</dd></div>
        </dl>
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-bg p-3">{w.detail}</p>

        <h2 className="mb-2 mt-6 flex items-center gap-2 font-bold"><Paperclip size={15} aria-hidden />添付ファイル</h2>
        {files.length === 0 && <p className="mb-2 text-[12.5px] text-ink-3">添付はありません。</p>}
        <ul className="mb-2 space-y-1.5 text-[13px]">{files.map((f) => <li key={f.id} className="flex flex-wrap items-center gap-2"><span className="break-all font-medium">{f.name}</span><span className="text-[11.5px] text-ink-3">{fmtBytes(f.size)}・{nameOf(f.uploadedBy)}・{stamp(f.at)}</span><FileDownload rec={f} /></li>)}</ul>
        {(mine || role === "admin") && (w.status === "承認待ち" || w.status === "差戻し") && <UploadButton compact label="添付を追加（ドラッグ＆ドロップ可）" meta={{ kind: "申請添付", scope: "申請", wfId: w.id, dept: deptOf(me) }} />}

        <h2 className="mb-2 mt-6 font-bold">承認ルート</h2>
        <ol className="space-y-3">
          {w.steps.map((st, i) => {
            const Icon = st.state === "承認" ? Check : st.state === "承認待ち" ? CircleDot : st.state === "待機" ? Circle : X;
            const c = st.state === "承認" ? "text-good" : st.state === "承認待ち" ? "text-brand-2" : st.state === "待機" ? "text-ink-3" : "text-bad";
            return (
              <li key={i} className="flex gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${c}`} aria-hidden />
                <div><div className="font-medium">{st.label}：{nameOf(st.approverId)}<span className="ml-1 text-[12px] text-ink-3">{emp(st.approverId)?.job}</span><span className={`ml-2 text-[12px] ${c}`}>{st.state}</span>{st.at && <span className="tabular ml-2 text-[12px] text-ink-3">{stamp(st.at)}</span>}</div>{st.comment && <div className="text-[13px] text-ink-2">「{st.comment}」</div>}</div>
              </li>
            );
          })}
        </ol>

        <h2 className="mb-2 mt-6 font-bold">操作の記録（いつ・誰が・何を・理由）</h2>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-[13px]"><thead><tr><th className="th">日時</th><th className="th">実行者</th><th className="th">操作</th><th className="th">理由・コメント</th></tr></thead>
            <tbody>{history.map((h, i) => <tr key={i}><td className="td tabular whitespace-nowrap">{stamp(h.at)}</td><td className="td">{nameOf(h.by)}<span className="ml-1 text-[11.5px] text-ink-3">{emp(h.by)?.job}</span></td><td className="td"><Badge tone={ACTION_TONE[h.action]}>{h.action}</Badge></td><td className="td whitespace-pre-wrap">{h.reason ?? "—"}</td></tr>)}
              {history.length === 0 && <tr><td className="td text-ink-3" colSpan={4}>記録はありません（この機能の導入前の申請です）</td></tr>}</tbody></table>
        </div>
        <p className="mt-1 text-[11.5px] text-ink-3">社長・役員を含め、承認・差戻し・却下・取下げ・修正の全てが、実行者・日時（サーバー時刻）・理由とともに残り、後から書き換えられません。</p>

        {canAct && (
          <div className="mt-6 border-t border-line pt-4">
            <label className="label" htmlFor="cm">理由・コメント（差戻し・却下は必須）</label>
            <textarea id="cm" rows={2} className="input mb-3" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-2"><button className="btn btn-primary" onClick={() => act("承認")}><Check size={15} />承認</button><button className="btn" onClick={() => act("差戻し")}><RotateCcw size={14} />差戻し</button><button className="btn btn-danger" onClick={() => act("却下")}><X size={14} />却下</button></div>
          </div>
        )}
        {mine && w.status === "承認待ち" && (
          <div className="mt-6 border-t border-line pt-4">
            <label className="label" htmlFor="cr">取り下げる理由（必須）</label>
            <div className="flex gap-2"><input id="cr" className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /><button className="btn btn-danger shrink-0" disabled={!cancelReason.trim()} onClick={() => confirm("この申請を取り下げますか？") && d({ t: "wf-cancel", id: w.id, by: meId, reason: cancelReason.trim() })}>取り下げる</button></div>
          </div>
        )}
        {mine && w.status === "差戻し" && !edit && <div className="mt-6 border-t border-line pt-4"><p className="mb-2 text-[13px] text-warn">差戻しされました。内容を修正して再申請してください（変更の理由が必要です。承認ルートは金額に応じて自動で再設定されます）。</p><button className="btn btn-primary" onClick={() => setEdit(true)}>修正して再申請する</button></div>}
        {edit && <ResubmitForm w={w} route={approvalRoute} onClose={() => setEdit(false)} />}
        {!canAct && w.status === "承認待ち" && !mine && <p className="mt-4 text-[12px] text-ink-3">この案件の現在の承認者は {nameOf(active?.approverId ?? "")} です。</p>}
      </div>
    </div>
  );
}

function ResubmitForm({ w, route, onClose }: { w: Workflow; route: (t: WfType, a: number | undefined, id: string) => Workflow["steps"]; onClose: () => void }) {
  const { d, meId, nameOf } = useStore();
  const [f, setF] = useState({ title: w.title, detail: w.detail, amount: w.amount ? String(w.amount) : "", reason: "" });
  const amt = Number(f.amount) || 0;
  const r = route(w.type, w.type === "休暇申請" ? undefined : amt, meId);
  return (
    <form className="mt-6 space-y-3 border-t border-line pt-4" onSubmit={(e) => {
      e.preventDefault();
      if (!f.reason.trim()) return;
      d({ t: "wf-edit", id: w.id, by: meId, reason: f.reason.trim(), route: r, patch: { title: f.title, detail: f.detail, ...(w.type === "休暇申請" ? {} : { amount: amt || undefined }) } });
      onClose();
    }}>
      <h3 className="font-bold">修正して再申請</h3>
      <div><label className="label" htmlFor="rt">件名</label><input id="rt" required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      {w.type !== "休暇申請" && <div className="max-w-xs"><label className="label" htmlFor="ra">金額（円）</label><NumInput id="ra" className="input" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></div>}
      <div><label className="label" htmlFor="rd">内容</label><textarea id="rd" required rows={4} className="input" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></div>
      <div><label className="label" htmlFor="rr">変更の理由（必須）</label><textarea id="rr" required rows={2} className="input" placeholder="例：金額の根拠資料を追加し、金額を見直したため" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
      <div className="text-[12.5px] text-ink-2">再申請後の承認ルート：{r.map((x) => `${x.label}（${nameOf(x.approverId)}）`).join(" → ")}</div>
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.reason.trim()}>再申請する</button></div>
    </form>
  );
}
