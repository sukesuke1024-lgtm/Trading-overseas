"use client";

import { Pager, usePaged } from "@/components/Pager";
import { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";
import { BASE, STATIC } from "@/lib/auth";
import { verifyChain } from "@/lib/chain";
import { download } from "@/lib/csv";
import { auditCsv } from "@/lib/exports";
import { can } from "@/lib/perm";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader } from "@/components/report";

type AuthRow = { seq: number; at: string; actor: string; event: string; ip: string; detail?: string };
const RISKY = ["login_fail", "account_locked", "mfa_fail", "write_denied", "access_denied", "rate_limited", "login_blocked_locked", "password_change_fail"];

export default function Admin() {
  const { s, d, meId, role, nameOf } = useStore();
  const [q, setQ] = useState("");
  const [auth, setAuth] = useState<{ entries: AuthRow[]; ok: boolean } | null>(null);
  const ok = can.audit(role);
  useEffect(() => {
    if (STATIC || !ok) return;
    fetch(`${BASE}/api/authlog`, { credentials: "same-origin", cache: "no-store" }).then(async (r) => { if (r.ok) { const j = await r.json(); setAuth({ entries: j.entries, ok: j.verify.ok }); } }).catch(() => {});
  }, [ok]);
  const chain = useMemo(() => verifyChain(s.audit), [s.audit]);
  const rows = useMemo(() => [...s.audit].reverse().filter((a) => !q || `${a.actor}${a.action}${nameOf(a.actor)}`.includes(q)), [s.audit, q, nameOf]);
  const pg = usePaged(rows, 10, q);

  if (!ok) return (
    <div><PageHeader title="監査ログ・管理" /><div className="card p-8 text-center"><ShieldCheck className="mx-auto mb-2 text-ink-3" />この画面は監査・経理・管理者のみ閲覧できます。</div></div>
  );
  return (
    <div>
      <div className="print:hidden"><PageHeader title="監査ログ・管理" sub="申請・承認・打刻修正・仕訳・データ出力などの操作を、改ざん検知つき（ハッシュ連鎖）で記録します。" actions={<div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => { download(`監査ログ_${ymd(new Date())}.csv`, auditCsv(s.audit)); d({ t: "export-log", by: meId, what: "監査ログCSV" }); }}><Download size={14} />CSV</button>
        <PrintButton what="監査ログ" />
        {STATIC && role === "admin" && <button className="btn btn-danger" onClick={() => confirm("デモデータを初期状態に戻します。よろしいですか？") && d({ t: "reset" })}><RotateCcw size={14} />デモデータ初期化</button>}</div>} /></div>
      <PrintHeader title="監査ログ（操作履歴）" />
      <div className={`mb-4 rounded-lg px-3 py-2 text-[13px] font-semibold ${chain.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{chain.ok ? `✔ 改ざんは検出されませんでした（${chain.count}件の連鎖を検証）` : `✖ ${chain.brokenAt}件目で不整合を検出：${chain.reason}`}</div>
      {!STATIC && (
        <div className="card mb-5">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold">サーバー認証・アクセス拒否ログ</h2>{auth && <Badge tone={auth.ok ? "good" : "bad"}>{auth.ok ? "連鎖 正常" : "連鎖 不整合"}</Badge>}</div>
          <div className="max-h-72 overflow-y-auto"><table className="w-full text-[12.5px]"><thead><tr><th className="th">日時</th><th className="th">実行者</th><th className="th">イベント</th><th className="th">IP</th><th className="th">詳細</th></tr></thead>
            <tbody>{[...(auth?.entries ?? [])].reverse().slice(0, 200).map((e) => <tr key={e.seq}><td className="td tabular">{new Date(e.at).toLocaleString("ja-JP")}</td><td className="td">{e.actor}</td><td className="td">{RISKY.includes(e.event) ? <Badge tone="bad">{e.event}</Badge> : e.event}</td><td className="td tabular text-ink-3">{e.ip}</td><td className="td text-ink-3">{e.detail}</td></tr>)}</tbody></table>
            {!auth?.entries.length && <Empty>ログがありません</Empty>}</div>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between print:hidden"><h2 className="font-bold">操作ログ</h2><input className="input !w-64" placeholder="実行者・操作で絞り込み" aria-label="絞り込み" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[13px]"><thead><tr><th className="th w-14">連番</th><th className="th w-44">日時</th><th className="th w-40">実行者</th><th className="th">操作</th><th className="th w-28 print:hidden">ハッシュ</th></tr></thead>
          <tbody>{pg.items.map((a) => <tr key={a.seq}><td className="td tabular text-ink-3">{a.seq}</td><td className="td tabular">{new Date(a.at).toLocaleString("ja-JP")}</td><td className="td">{nameOf(a.actor)}</td><td className="td">{a.action}</td><td className="td tabular text-[11px] text-ink-3 print:hidden" title={a.hash}>{a.hash.slice(0, 10)}…</td></tr>)}</tbody></table>
        <Pager pg={pg} />
        {rows.length === 0 && <Empty>該当する操作ログはありません。申請や打刻・仕訳などを行うとここに記録されます。</Empty>}
      </div>
    </div>
  );
}
