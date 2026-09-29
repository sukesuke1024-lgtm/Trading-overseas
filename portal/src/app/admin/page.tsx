"use client";

import { RotateCcw, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Empty, PageHeader } from "@/components/ui";

export default function Admin() {
  const { s, d } = useStore();
  const ok = s.role === "admin";
  return (
    <div>
      <PageHeader title="管理・監査ログ" sub="内部統制（J-SOX）対応のため、申請・承認・投稿等の操作を記録します。"
        actions={ok && <button className="btn btn-danger" onClick={() => confirm("デモデータを初期状態に戻します。よろしいですか？") && d({ t: "reset" })}><RotateCcw size={14} />デモデータを初期化</button>} />
      {!ok ? (
        <div className="card p-8 text-center"><ShieldCheck className="mx-auto mb-2 text-ink-3" />この画面は「全社管理者」ロールのみ閲覧できます。<br /><span className="text-[12px] text-ink-3">右上の「表示ロール」から切り替えてください（デモ）。</span></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13.5px]"><thead><tr><th className="th w-48">日時</th><th className="th w-40">実行者</th><th className="th">操作</th></tr></thead>
            <tbody>{s.audit.map((a, i) => <tr key={i}><td className="td tabular">{a.at}</td><td className="td">{a.actor}</td><td className="td">{a.action}</td></tr>)}</tbody></table>
          {s.audit.length === 0 && <Empty>まだ操作ログはありません。申請や投稿を行うとここに記録されます。</Empty>}
        </div>
      )}
    </div>
  );
}
