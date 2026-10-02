"use client";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { COUNTRY_RANK_LABEL, rankOf } from "@/lib/credit";
import { creditUsage, reviewOf } from "@/lib/selectors";
import { fmtDate } from "@/lib/dates";
import { yenShort } from "@/lib/format";
import type { Data, Organization } from "@/lib/types";
import { RatingBadge } from "./RatingBadge";

/** 顧客の与信の状態（格付け・限度額・使用状況・期限）。審査がなければ審査を促す */
export function CreditStrip({ d, org, compact = false }: { d: Data; org: Organization; compact?: boolean }) {
  const rv = reviewOf(d, org.id);
  const { review, usage } = creditUsage(d, org.id);
  const today = new Date().toISOString().slice(0, 10);
  const expired = rv?.status === "approved" && rv.validUntil < today;
  if (!rv || !review) {
    return (
      <div className={`flex flex-wrap items-center gap-3 rounded-xl ${compact ? "p-3" : "card p-4"} ${rv?.status === "submitted" ? "bg-accent-soft" : "bg-warn-soft"}`}>
        <ShieldAlert size={18} className="shrink-0 text-warn" />
        <div className="min-w-0 flex-1 text-[12.5px]"><b>{!rv ? "与信審査がありません" : expired ? "与信審査の期限が切れています" : rv.status === "submitted" ? "与信審査は承認待ちです" : rv.status === "rejected" ? "与信審査は否認されました" : "与信審査は下書きです"}</b><div className="text-ink-2">{!rv ? "取引条件・限度額を決める前に、審査してください。" : `格付け ${rv.result.rating}（点数 ${rv.result.score}）`}・国別リスク {COUNTRY_RANK_LABEL[rv?.input.countryRank ?? rankOf(org.country)]}</div></div>
        <Link href={`/credit/?org=${org.id}`} className="btn btn-sm">{rv ? "審査を開く" : "審査を始める"} →</Link>
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-4 ${compact ? "rounded-xl bg-surface-2 p-3" : "card p-4"}`}>
      <RatingBadge r={review.result.rating} size={compact ? "md" : "lg"} />
      <div className="min-w-[160px] flex-1">
        <div className="text-[11px] text-ink-3">与信（承認済み・{fmtDate(review.validUntil, true)}まで）</div>
        <div className="num text-[15px] font-bold">限度額 {yenShort(review.result.totalLimitJPY)}<span className="ml-2 text-[12px] font-normal text-ink-2">使用 {yenShort(usage.confirmed)}（{Number.isFinite(usage.rate) ? Math.round(usage.rate * 100) : "—"}%）</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((Number.isFinite(usage.rate) ? usage.rate : 1) * 100))}%`, background: usage.level === "over" ? "#c0362c" : usage.level === "ok" ? "#17784a" : "#c47a1c" }} /></div>
        {usage.level === "over" && <div className="mt-1 text-[11.5px] font-semibold text-bad">限度額を超えています。追加出荷は止めてください。</div>}
        {usage.level === "future-over" && <div className="mt-1 text-[11.5px] font-semibold text-warn">進行中の案件を含めると、限度額を超える見込みです。</div>}
      </div>
      <Link href={`/credit/?org=${org.id}`} className="text-xs text-accent-2 hover:underline">与信の詳細 →</Link>
    </div>
  );
}
