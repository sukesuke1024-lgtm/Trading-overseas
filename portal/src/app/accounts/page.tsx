"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, KeyRound, RotateCcw } from "lucide-react";
import { adminResetApi, type AcctRow } from "@/lib/auth";
import { STATIC } from "@/lib/auth";
import { can } from "@/lib/perm";
import { download, toCsv } from "@/lib/csv";
import { useStore, ymd } from "@/lib/store";
import { Pager, usePaged } from "@/components/Pager";
import { Badge, Empty, Fold, PageHeader } from "@/components/ui";

const KIND: Record<string, string> = { pin_reset_link_issued: "再設定URLを発行", pin_reset_to_initial: "初期PINに戻した", pin_reset_done: "再設定URLで新PINを登録", pin_changed: "本人がPINを変更", pin_reset_requested: "メールで再設定を依頼", pin_reset_admin_request: "管理者へ再設定を申請" };
const ROLE: Record<string, string> = { admin: "管理者", executive: "役員", employee: "従業員" };
const when = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");

export default function AccountsPage() {
  const { role, nameOf } = useStore();
  const [rows, setRows] = useState<AcctRow[]>([]);
  const [q, setQ] = useState(""), [flt, setFlt] = useState<"all" | "initial" | "set">("all");
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null), [msg, setMsg] = useState("");
  const reload = useCallback(() => { adminResetApi.ledger().then(setRows); }, []);
  useEffect(() => { const t = setTimeout(reload, 0); return () => clearTimeout(t); }, [reload]);
  const list = useMemo(() => rows.filter((r) => (flt === "all" || (flt === "initial") === r.pin.startsWith("初期")) && `${r.id}${r.name}${r.dept}`.includes(q)), [rows, q, flt]);
  const pg = usePaged(list, 10, `${q}|${flt}`);
  const loginUrl = typeof location !== "undefined" ? `${location.origin}${location.pathname.replace(/accounts\/?$/, "")}` : "";
  if (!can.admin(role)) return <div><PageHeader title="ID・PIN・URL管理台帳" /><div className="card"><Empty>管理者のみ利用できます。</Empty></div></div>;

  const issue = async (r: AcctRow) => { setMsg(""); const x = await adminResetApi.link(r.id); if (x.url) { setUrl({ id: r.id, url: x.url }); reload(); } else setMsg(x.error ?? "発行できませんでした。"); };
  const initial = async (r: AcctRow) => { if (!confirm(`${r.name}（${r.id}）のPINを初期PINに戻しますか？\n次回ログイン時に新しいPINの設定が必須になります。`)) return; const e = await adminResetApi.initial(r.id); setMsg(e ?? `${r.name}を初期PINに戻しました。`); reload(); };
  const csv = () => download(`ID・PIN状態台帳_${ymd(new Date())}.csv`, toCsv(["ID", "氏名", "権限", "事業部", "PINの状態", "PIN最終変更", "最終ログイン", "再設定URL発行回数", "最終発行日時", "最終発行者"], list.map((r) => [r.id, r.name, ROLE[r.role] ?? r.role, r.dept, r.pin, when(r.pinChangedAt), when(r.lastLoginAt), r.urlIssued, when(r.lastUrlAt), r.lastUrlBy ? nameOf(r.lastUrlBy) : ""])));

  return (
    <div>
      <PageHeader title="ID・PIN・URL管理台帳" sub="社員IDの発行状況、PINの設定状況、再設定URLの発行履歴を管理します。PINそのものは誰にも見えません（ハッシュ化して保管）。"
        actions={<button className="btn" onClick={csv}><Download size={15} />CSV</button>} />

      <section className="card mb-4 grid gap-3 p-4 md:grid-cols-3" aria-label="運用ルール">
        <div><div className="mb-1 flex items-center gap-1.5 font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] text-white">1</span>初回</div><p className="text-[12.5px] text-ink-2">全員に<b>共通の初期PIN</b>とログインURLをお渡しします。初回ログイン時に、本人が<b>自分だけのPINへ変更</b>しないと先へ進めません。</p></div>
        <div><div className="mb-1 flex items-center gap-1.5 font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] text-white">2</span>以後</div><p className="text-[12.5px] text-ink-2">PINは<b>本人だけが管理</b>します。管理者にも分かりません。変更は右上の設定から、いつでも可能です。</p></div>
        <div><div className="mb-1 flex items-center gap-1.5 font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] text-white">3</span>忘れたとき</div><p className="text-[12.5px] text-ink-2">本人確認のうえ、下の表から<b>「再設定URLを発行」</b>（15分・1回限り）。本人がURLを開いて新しいPINを登録し直します。発行はすべてここに記録されます。</p></div>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-56" placeholder="ID・氏名・事業部で検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} />
        {([["all", "すべて"], ["initial", "初期PINのまま"], ["set", "本人設定済"]] as const).map(([k, l]) => <button key={k} aria-pressed={flt === k} onClick={() => setFlt(k)} className={`rounded-full border px-3 py-1 text-[12.5px] ${flt === k ? "border-brand bg-brand text-white" : "border-line-strong"}`}>{l}</button>)}
        <span className="ml-auto text-[12px] text-ink-3">ログインURL：<span className="tabular select-all">{loginUrl}</span></span>
      </div>

      {url && (
        <div className="card mb-3 space-y-2 border-brand/40 p-4" role="status">
          <div className="font-bold">{nameOf(url.id)}さん用の再設定URL（15分・1回限り）</div>
          <div className="tabular break-all rounded bg-surface-2 p-2 text-[12px]">{url.url}</div>
          <div className="flex gap-2"><button className="btn !h-8" onClick={() => navigator.clipboard?.writeText(url.url)}><Copy size={13} />コピー</button><button className="btn !h-8" onClick={() => setUrl(null)}>閉じる</button></div>
          <p className="text-[12px] text-ink-3">本人確認（対面・社内電話など）のうえ、本人にだけ伝えてください。他の人に転送されないようご注意ください。</p>
        </div>
      )}
      {msg && <p role="status" className="mb-3 text-[13px] text-ink-2">{msg}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead><tr><th className="th">ID</th><th className="th">氏名</th><th className="th">権限・事業部</th><th className="th">PINの状態</th><th className="th">PIN最終変更</th><th className="th">最終ログイン</th><th className="th">再設定URL</th><th className="th"></th></tr></thead>
          <tbody>
            {pg.items.map((r) => (
              <tr key={r.id} className={r.left ? "opacity-50" : ""}>
                <td className="td tabular font-medium">{r.id}</td>
                <td className="td">{r.name}{r.left && <span className="ml-1 text-[11px] text-ink-3">（退職）</span>}{r.locked && <Badge tone="bad">ロック中</Badge>}</td>
                <td className="td">{ROLE[r.role] ?? r.role}<div className="text-[11.5px] text-ink-3">{r.dept || "—"}</div></td>
                <td className="td whitespace-nowrap"><Badge tone={r.pin.startsWith("初期") ? "warn" : "good"}>{r.pin}</Badge></td>
                <td className="td tabular whitespace-nowrap">{when(r.pinChangedAt)}</td>
                <td className="td tabular whitespace-nowrap">{when(r.lastLoginAt)}</td>
                <td className="td text-[12px]">{r.urlIssued}回{r.lastUrlAt && <div className="tabular text-ink-3">最終 {when(r.lastUrlAt)}</div>}</td>
                <td className="td"><div className="flex gap-1 whitespace-nowrap">
                  <button className="btn btn-primary !h-8" onClick={() => issue(r)} disabled={!!r.left}><KeyRound size={13} />再設定URLを発行</button>
                  <button className="btn !h-8" onClick={() => initial(r)} disabled={!!r.left} title="共通の初期PINに戻し、次回ログイン時に変更を必須にします"><RotateCcw size={13} />初期PINへ</button>
                </div>
                  {r.history.length > 0 && <Fold className="mt-1 !border-0" title={`履歴（${r.history.length}件）`}><ul className="space-y-0.5">{r.history.slice(0, 8).map((h, i) => <li key={i} className="tabular">{when(h.at)}　{KIND[h.kind] ?? h.kind}（{h.by === "本人" || h.by === "管理者" ? h.by : nameOf(h.by)}）</li>)}</ul></Fold>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty>該当するIDがありません。</Empty>}
        <Pager pg={pg} />
      </div>
      <p className="mt-2 text-[12px] text-ink-3">{STATIC ? "デモ版では、この端末で行った操作だけが履歴に残ります。" : "履歴は改ざん防止（ハッシュ連鎖）の認証ログから集計しています。"}初期PINの値は、サーバー設定（環境変数 PORTAL_INITIAL_PIN）で管理者が決め、利用者へ個別にお伝えください。</p>
    </div>
  );
}
