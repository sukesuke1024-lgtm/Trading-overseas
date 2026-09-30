"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { balanceSheet, fyStartOf, incomeStatement, isPosted, monthsOfFy, trialBalance } from "@/lib/accounting";
import { summarize, overtimeLevel } from "@/lib/attendance-calc";
import { verifyChain } from "@/lib/chain";
import { COURSES, DOCS, EMPLOYEES } from "@/lib/data";
import { can } from "@/lib/perm";
import { leaveDatesOf, useStore, ymd } from "@/lib/store";
import { Badge, PageHeader, Progress } from "@/components/ui";
import { PrintButton, PrintHeader, amt } from "@/components/report";

type Item = { id: string; label: string; note?: string; auto?: boolean };

export default function Ipo() {
  const { s, d, meId, role } = useStore();
  const today = ymd(new Date());
  const fy = fyStartOf(today), months = monthsOfFy(fy, today);

  const auto = useMemo(() => {
    const tb = trialBalance(s.journal, s.jApprovals, fy, today), pl = incomeStatement(tb), bs = balanceSheet(s.journal, s.jApprovals, fy, today);
    const days = Array.from({ length: 31 }, (_, i) => `${today.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
    const over45 = EMPLOYEES.filter((e) => overtimeLevel(summarize(days, s.punches[e.id] ?? {}, leaveDatesOf(s.workflows, e.id), today).overtime).level === "warn" || overtimeLevel(summarize(days, s.punches[e.id] ?? {}, leaveDatesOf(s.workflows, e.id), today).overtime).level === "danger").length;
    const closedRatio = months.length > 1 ? s.closed.length / (months.length - 1) : 1;
    const avgTraining = Object.values(s.progress).length ? Object.values(s.progress).reduce((a, p) => a + COURSES.filter((c) => c.required).reduce((x, c) => x + (p[c.id] ?? 0), 0) / COURSES.filter((c) => c.required).length, 0) / Object.values(s.progress).length : 0;
    const A: Record<string, boolean> = {
      sod: true, immut: verifyChain(s.journal).ok, auditlog: verifyChain(s.audit).ok, rbac: true, mfa: true,
      closing: closedRatio >= 1, balanced: bs.balanced, pendingJ: s.journal.every((j) => isPosted(j, s.jApprovals)), payLink: Object.values(s.payroll).some((p) => p.status === "確定"),
      ot: over45 === 0, rules: DOCS.filter((x) => x.kind === "規程").length >= 5, training: avgTraining >= 90,
    };
    return { A, pl, bs, over45, closedRatio, avgTraining };
  }, [s, fy, today, months.length]);

  const groups: { title: string; items: Item[] }[] = [
    { title: "内部統制（J-SOX）・システム統制", items: [
      { id: "sod", label: "職務分掌：仕訳の起票者と承認者を分離", note: "サーバー側でも強制", auto: true },
      { id: "immut", label: "仕訳の削除・改変不可（ハッシュ連鎖で検証）", auto: true },
      { id: "auditlog", label: "操作ログの改ざん検知", auto: true },
      { id: "rbac", label: "職務に応じたアクセス権限（RBAC）", auto: true },
      { id: "mfa", label: "全社員の二要素認証（TOTP）", auto: true },
      { id: "itgc", label: "IT全般統制の文書化（変更管理・バックアップ・DR）" },
      { id: "jsox", label: "内部統制報告制度（J-SOX）の評価・文書化（3点セット）" },
    ] },
    { title: "決算・会計", items: [
      { id: "closing", label: `月次締めの完了（当月以外）${(auto.closedRatio * 100).toFixed(0)}%`, auto: true },
      { id: "balanced", label: "貸借一致・試算表一致", auto: true },
      { id: "pendingJ", label: "承認待ち仕訳の滞留なし", auto: true },
      { id: "payLink", label: "給与確定→仕訳の自動連動", auto: true },
      { id: "fast", label: "月次決算の早期化（目標：翌営業日5日以内）" },
      { id: "budget", label: "予算・見通し・実績の管理（月次予実）" },
      { id: "conso", label: "連結決算体制（子会社・関連会社の管理）" },
      { id: "auditor", label: "会計監査人（監査法人）の選任・ショートレビュー" },
      { id: "xbrl", label: "決算短信・有価証券報告書の作成体制（XBRL）" },
    ] },
    { title: "労務・コンプライアンス", items: [
      { id: "ot", label: `36協定の上限（月45時間）超過者ゼロ（現在${auto.over45}名）`, auto: true },
      { id: "rules", label: "社内規程の整備（規程5本以上）", auto: true },
      { id: "training", label: `必須コンプライアンス研修の修了率90%以上（現在${auto.avgTraining.toFixed(0)}%）`, auto: true },
      { id: "antisocial", label: "反社会的勢力の排除体制（取引先・株主の調査）" },
      { id: "related", label: "関連当事者取引の管理・承認手続" },
      { id: "insider", label: "インサイダー取引管理・適時開示体制" },
      { id: "hotline", label: "内部通報制度（社外窓口）の運用" },
    ] },
    { title: "ガバナンス・開示", items: [
      { id: "board", label: "取締役会・監査役会（監査等委員会）の実効的な運営、独立社外取締役" },
      { id: "audit", label: "内部監査部門の設置と年次監査計画" },
      { id: "ir", label: "IR・情報開示方針、コーポレートガバナンス報告書" },
      { id: "shareholder", label: "株主名簿管理人・株式事務、株主総会運営" },
    ] },
  ];
  const all = groups.flatMap((g) => g.items), done = all.filter((i) => (i.auto ? auto.A[i.id] : s.ipo[i.id])).length;
  const canEdit = can.admin(role);
  const annualOrd = months.length ? (auto.pl.ordinaryIncome / months.length) * 12 : 0;
  const ref = [
    ["純資産 50億円以上", auto.bs.totalEquity >= 5_000_000_000, `${amt(auto.bs.totalEquity, 1_000_000)}百万円`],
    ["経常利益（年換算）が 12.5億円/年 以上（直近2年合計25億円の目安）", annualOrd >= 1_250_000_000, `${amt(annualOrd, 1_000_000)}百万円/年`],
  ] as const;

  if (!can.viewAccounting(role)) return <div className="card p-8 text-center text-ink-2">この画面は経理担当・監査・管理者のみ閲覧できます。</div>;
  return (
    <div>
      <div className="print:hidden"><PageHeader title="上場準備" sub="東証プライム上場を見据えた、システム・決算・統制・ガバナンスの準備状況。自動判定できる項目はデータから評価します。" actions={<PrintButton what="上場準備チェック" />} /></div>
      <PrintHeader title="上場準備 チェックリスト" period={ymd(new Date())} />
      <div className="card mb-5 p-4"><div className="mb-1 flex justify-between font-bold"><span>準備状況</span><span className="tabular">{done} / {all.length}（{Math.round((done / all.length) * 100)}%）</span></div><Progress value={(done / all.length) * 100} tone={done === all.length ? "good" : "brand"} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="card p-4 avoid-break"><h2 className="mb-2 font-bold">{g.title}</h2>
            <ul className="space-y-1.5">{g.items.map((i) => {
              const on = i.auto ? auto.A[i.id] : !!s.ipo[i.id];
              return <li key={i.id} className="flex items-start gap-2 text-[13.5px]">
                {i.auto ? (on ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-good" /> : <Circle size={17} className="mt-0.5 shrink-0 text-warn" />)
                  : <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={on} disabled={!canEdit} aria-label={i.label} onChange={(e) => d({ t: "ipo-set", id: i.id, v: e.target.checked, by: meId })} />}
                <span className="flex-1">{i.label}{i.note && <span className="ml-1 text-[12px] text-ink-3">（{i.note}）</span>}</span>{i.auto && <Badge tone={on ? "good" : "warn"}>{on ? "自動OK" : "要対応"}</Badge>}</li>;
            })}</ul></section>
        ))}
      </div>
      <section className="card mt-5 p-4 avoid-break"><h2 className="mb-2 font-bold">上場基準に対する現状（参考指標）</h2>
        <ul className="space-y-1 text-[13.5px]">{ref.map(([l, ok, v]) => <li key={l} className="flex justify-between gap-3"><span>{l}</span><span className="flex items-center gap-2 tabular">{v}<Badge tone={ok ? "good" : "warn"}>{ok ? "達成" : "未達"}</Badge></span></li>)}</ul>
        <p className="mt-3 text-[12px] text-ink-3">※ 上場基準（株主数・流通株式・時価総額・利益基準・株式の譲渡制限の撤廃 等）と審査項目は改正されます。デモの数値は架空です。実際の準備は、主幹事証券会社・監査法人・東京証券取引所の最新の基準に従ってください。手動項目のチェックは全社管理者のみ変更でき、変更は監査ログに記録されます。</p></section>
    </div>
  );
}
