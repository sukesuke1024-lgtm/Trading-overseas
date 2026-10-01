"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, KeyRound, LifeBuoy, Monitor, Search, ShieldAlert, Wrench } from "lucide-react";
import { COMPANY } from "@/lib/data";
import { HELPDESK_FAQ, type MailCategory } from "@/lib/ops";
import { PageHeader } from "@/components/ui";
import { MailCompose } from "@/components/MailCompose";

const TOPICS: { cat: MailCategory; title: string; desc: string; icon: typeof LifeBuoy; anon?: boolean }[] = [
  { cat: "ハラスメント相談", title: "ハラスメント相談", desc: "パワハラ・セクハラ・マタハラなど。匿名で相談できます。管理者（人事）のみが閲覧。", icon: ShieldAlert, anon: true },
  { cat: "情シス・PC", title: "PC・ネットワーク", desc: "PCの不具合、アカウント、VPN、ソフトの導入など", icon: Monitor },
  { cat: "ツールの使い方", title: "ツールの使い方", desc: "ポータル・Excel・勤怠入力・申請のやり方", icon: Wrench },
  { cat: "人事", title: "人事・労務", desc: "勤怠・休暇・各種届出・福利厚生について", icon: HeartHandshake },
];

export default function HelpdeskPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState<{ category: MailCategory; anon?: boolean } | null>(null);
  const faq = HELPDESK_FAQ.filter((f) => `${f.q}${f.a}${f.cat}`.includes(q));
  return (
    <div>
      <PageHeader title="社内ヘルプデスク" sub={`ハラスメント・PC操作・ツールの使い方などの相談窓口です。担当：${COMPANY.helpdesk}`} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOPICS.map(({ cat, title, desc, icon: I, anon }) => (
          <section key={cat} className="card flex flex-col p-4" aria-label={title}>
            <I size={20} className="mb-2 text-brand-2" aria-hidden /><h2 className="font-bold">{title}</h2><p className="mb-3 flex-1 text-[12.5px] text-ink-2">{desc}</p>
            <button className="btn btn-primary" onClick={() => setCompose({ category: cat, anon })}>{anon ? "相談する（匿名可）" : "相談する"}</button>
          </section>
        ))}
      </div>
      <section className="card p-4" aria-label="よくある質問">
        <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="flex items-center gap-2 font-bold"><KeyRound size={15} aria-hidden />よくある質問</h2><div className="relative ml-auto"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><input className="input !w-64 !pl-8" placeholder="キーワードで検索" aria-label="検索" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div className="divide-y divide-line">{faq.map((f) => (
          <details key={f.q} className="group py-2"><summary className="flex cursor-pointer items-center gap-2 py-1 font-medium"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">{f.cat}</span>{f.q}</summary><p className="mt-1 whitespace-pre-wrap pl-1 text-[13.5px] leading-7 text-ink-2">{f.a}</p></details>
        ))}{faq.length === 0 && <p className="py-6 text-center text-ink-3">該当する質問はありません。上の「相談する」からお問い合わせください。</p>}</div>
      </section>
      <p className="mt-3 text-[12px] text-ink-3">相談内容は、窓口の担当者（管理者）が確認し、「問い合わせBox」で返信します。緊急の場合は{COMPANY.helpdesk}へ直接ご連絡ください。</p>
      {compose && <MailCompose init={{ toType: "窓口", category: compose.category, anon: compose.anon }} onClose={() => setCompose(null)} onSent={() => router.push("/inbox?box=sent")} />}
    </div>
  );
}
