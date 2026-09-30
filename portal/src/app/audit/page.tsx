"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Download, XCircle } from "lucide-react";
import { fyStartOf, trialBalance } from "@/lib/accounting";
import { BASE, STATIC } from "@/lib/auth";
import { verifyChain, type Verify } from "@/lib/chain";
import { buildPackage, download } from "@/lib/csv";
import { COMPANY, empById } from "@/lib/data";
import { attendanceCsv, auditCsv, journalCsv, ledgerCsv, payrollCsv, trialBalanceCsv, workflowCsv } from "@/lib/exports";
import { can } from "@/lib/perm";
import { sha256 } from "@/lib/sha256";
import { useStore, ymd } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { PrintButton, PrintHeader } from "@/components/report";

export default function AuditPage() {
  const { s, d, meId, role } = useStore();
  const today = ymd(new Date());
  const [from, setFrom] = useState(fyStartOf(today));
  const [to, setTo] = useState(today);
  const [auth, setAuth] = useState<{ count: number; v: Verify } | null | "denied">(null);

  useEffect(() => {
    if (STATIC || !can.audit(role)) return;
    fetch(`${BASE}/api/authlog`, { credentials: "same-origin", cache: "no-store" }).then(async (r) => {
      if (!r.ok) { setAuth("denied"); return; }
      const j = await r.json(); setAuth({ count: j.entries.length, v: j.verify });
    }).catch(() => setAuth(null));
  }, [role]);

  const files = useMemo(() => {
    const tb = trialBalance(s.journal, s.jApprovals, fyStartOf(to), to);
    return [
      { name: "01_仕訳帳.csv", desc: "全仕訳（借貸・税区分・部門・証憑・登録番号・起票/承認者・ハッシュ）", content: journalCsv(s.journal, s.jApprovals, from, to) },
      { name: "02_総勘定元帳.csv", desc: "科目別の日付順・残高推移", content: ledgerCsv(s.journal, s.jApprovals, from, to) },
      { name: "03_試算表.csv", desc: "期首・借方・貸方・期末", content: trialBalanceCsv(tb) },
      { name: "04_給与台帳.csv", desc: "月別・社員別の支給／控除（賃金台帳）", content: payrollCsv(Object.values(s.payroll)) },
      { name: "05_出勤簿.csv", desc: "打刻・休憩・実働・時間外・深夜・休日労働", content: attendanceCsv(s.punches, from, to) },
      { name: "06_承認履歴.csv", desc: "ワークフローの承認段階・処理者・コメント", content: workflowCsv(s.workflows) },
      { name: "07_監査ログ.csv", desc: "操作履歴（ハッシュチェーン）", content: auditCsv(s.audit) },
    ].map((f) => ({ ...f, hash: sha256(f.content), rows: f.content.split("\r\n").length - 2 }));
  }, [s, from, to]);

  if (!can.audit(role)) return <div className="card p-8 text-center text-ink-2">この画面は監査・経理・管理者のみ閲覧できます。</div>;
  const jc = verifyChain(s.journal), ac = verifyChain(s.audit);
  const stamp = () => new Date().toLocaleString("ja-JP");
  const pkg = () => {
    const bytes = buildPackage(files.map((f) => ({ name: f.name, content: f.content })), { by: `${empById(meId)?.name}(${meId})`, at: stamp(), company: COMPANY.name });
    download(`監査提出パッケージ_${today}.zip`, bytes, "application/zip");
    d({ t: "export-log", by: meId, what: `提出パッケージZIP（${from}〜${to}）` });
  };


  return (
    <div>
      <div className="print:hidden"><PageHeader title="監査・税務調査 出力" sub="税務調査・会計監査・労基署調査の提出資料を、CSV・ZIP・印刷/PDFで出力します。出力操作は監査ログに記録されます。" actions={<div className="flex gap-2"><PrintButton what="提出資料一覧" /><button className="btn btn-primary" onClick={pkg}><Archive size={15} />一括ZIP（CSV＋ハッシュ一覧）</button></div>} /></div>
      <PrintHeader title="監査・税務調査 提出資料一覧" period={`対象期間 ${from} 〜 ${to}`} />
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <Ok v={jc} label="仕訳帳 ハッシュ連鎖" /><Ok v={ac} label="監査ログ ハッシュ連鎖" />
        {STATIC ? <div className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">サーバー認証ログ：デモ版では対象外（サーバー版で有効）</div>
          : auth === "denied" ? <div className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">サーバー認証ログを取得できません</div>
          : auth ? <Ok v={auth.v} label={`サーバー認証ログ（ログイン・失敗・権限拒否 ${auth.count}件）`} /> : <div className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">認証ログを検証中…</div>}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden"><label className="text-[12.5px]">対象期間</label><input type="date" className="input !w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="開始日" /><span>〜</span><input type="date" className="input !w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="終了日" /></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]"><thead><tr><th className="th">ファイル</th><th className="th">内容</th><th className="th text-right">行数</th><th className="th">SHA-256</th><th className="th w-20 print:hidden"><span className="sr-only">出力</span></th></tr></thead>
          <tbody>{files.map((f) => (
            <tr key={f.name} className="avoid-break"><td className="td font-medium">{f.name}</td><td className="td text-ink-2">{f.desc}</td><td className="td tabular text-right">{f.rows}</td><td className="td tabular break-all text-[11px] text-ink-3">{f.hash}</td>
              <td className="td print:hidden"><button className="btn !h-8" onClick={() => { download(f.name, f.content); d({ t: "export-log", by: meId, what: `${f.name}（${from}〜${to}）` }); }}><Download size={13} />CSV</button></td></tr>))}</tbody></table>
      </div>
      <div className="card mt-5 p-4 text-[13px]">
        <h2 className="mb-2 font-bold">電子帳簿保存法・内部統制への対応状況</h2>
        <ul className="grid gap-1.5 md:grid-cols-2">
          {[["検索機能（取引日・金額・取引先／範囲指定・複数条件）", "仕訳帳の検索欄"], ["訂正・削除の履歴（削除不可・取消は反対仕訳）", "仕訳はハッシュ連鎖で追記のみ"], ["見読性（画面表示・書面出力）", "画面／印刷・PDF保存"], ["ダウンロード（CSV・提出パッケージ）", "本画面"], ["職務分掌（起票者と承認者の分離）", "サーバー側でも強制"], ["月次締め後の変更禁止", "締め済み月は起票・取消不可"], ["アクセス権限（経理・監査・管理者のみ）", "サーバー側で読み書きを制限"], ["操作ログの改ざん検知・出力記録", "ハッシュ連鎖・出力も記録"]].map(([a, b]) => <li key={a} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-good" /><span>{a}<span className="ml-1 text-ink-3">— {b}</span></span></li>)}
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">※ 本システムの機能面の整理です。電子帳簿保存法の要件充足（事務処理規程の整備、タイムスタンプ／訂正削除履歴の方式の届出・確認、スキャナ保存の要件など）の最終判断は、税理士・所轄税務署にご確認ください。</p>
      </div>
    </div>
  );
}

function Ok({ v, label }: { v: Verify; label: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 ${v.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{v.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}<div><div className="font-semibold">{label}</div><div className="text-[12.5px]">{v.ok ? `改ざんなし（${v.count}件）` : `${v.brokenAt}件目で不整合：${v.reason}`}</div></div></div>
  );
}
