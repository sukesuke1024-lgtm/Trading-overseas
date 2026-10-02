"use client";
import { BookOpen, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FILES = [
  { title: "操作マニュアル（PDF）", desc: "印刷・配布用。画面の使い方、1日の流れ、よくある質問、運用ルール", href: `${base}/docs/H-LINK-CRM_操作マニュアル.pdf`, icon: FileText },
  { title: "操作マニュアル（Word）", desc: "社内向けに編集・加筆できる版（.docx）", href: `${base}/docs/H-LINK-CRM_操作マニュアル.docx`, icon: FileText },
  { title: "設計書（PDF）", desc: "設計レビュー、画面一覧、Customer 360°／パイプライン設計、DB/ER、権限、セキュリティ、開発順序", href: `${base}/docs/H-LINK-CRM_設計書.pdf`, icon: BookOpen },
  { title: "設計書（Word）", desc: "編集可能な設計書（.docx）", href: `${base}/docs/H-LINK-CRM_設計書.docx`, icon: BookOpen },
];
const QUICK = [
  ["まず見る場所", "ダッシュボードの「今日やること」と「要フォロー案件」。ここだけ見れば、今日動くべき相手がわかります。"],
  ["活動を記録する", "画面右上の「活動を記録」（ショートカット N）。顧客と内容の1行だけで記録でき、案件を選ぶと次の一手（Next Action）も同時に設定できます。"],
  ["案件を進める", "パイプラインでカードをドラッグ、または案件画面の上部のステージをクリック。失注のときだけ理由の選択が必要です。"],
  ["Next Action", "進行中の案件は必ず「次に何をするか」と期限を持ちます。完了したらその場で次を入力。未設定・期限超過は赤で表示されます。"],
  ["探す", "⌘K（Ctrl+K）で顧客・案件・担当者を横断検索できます。"],
];
export default function Manual() {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="マニュアル" sub="操作マニュアルと設計書をダウンロードできます。Word 版は社内の運用に合わせて自由に編集してください。" />
      <div className="grid gap-3 sm:grid-cols-2">
        {FILES.map((f) => (
          <a key={f.href} href={f.href} download className="card group flex items-start gap-3 p-4 transition hover:shadow-[0_4px_16px_rgb(16_18_23/10%),0_0_0_1px_var(--line-strong)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><f.icon size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{f.title}</span><span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{f.desc}</span></span>
            <Download size={16} className="mt-1 text-ink-3 group-hover:text-accent-2" />
          </a>
        ))}
      </div>
      <section className="card mt-6 p-5">
        <h2 className="card-t mb-3">5つだけ覚えれば使えます</h2>
        <dl className="divide-y divide-line">{QUICK.map(([t, b], i) => (<div key={t} className="grid grid-cols-[28px_120px_1fr] items-baseline gap-3 py-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">{i + 1}</span><dt className="text-[13px] font-bold">{t}</dt><dd className="text-[13px] leading-relaxed text-ink-2">{b}</dd></div>))}</dl>
      </section>
    </div>
  );
}
