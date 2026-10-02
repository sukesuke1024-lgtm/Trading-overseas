"use client";
import { useState } from "react";
import { Check, Download, Minus, RotateCcw } from "lucide-react";
import { resetDemo, updateUser, useMe, useStore } from "@/lib/store";
import { FX, ROLES, STAGES } from "@/lib/constants";
import { permsFor } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { Avatar, PageHeader, ROLE_LABEL, Segmented, StageChip } from "@/components/ui";
import type { Role } from "@/lib/types";

const MATRIX: [string, boolean, boolean, boolean][] = [
  ["顧客・案件・活動・Task を閲覧", true, true, true],
  ["自分が担当するデータを編集", true, true, true],
  ["他の担当者のデータを編集", true, true, false],
  ["担当営業の変更", true, true, false],
  ["データの削除（顧客・案件・活動）", true, true, false],
  ["チーム全体の分析（ダッシュボード）", true, true, true],
  ["監査ログの閲覧", true, true, false],
  ["ユーザー・権限の管理", true, false, false],
];

export default function Settings() {
  const d = useStore().data!;
  const me = useMe()!;
  const perms = permsFor(me);
  const [tab, setTab] = useState<"users" | "stages" | "audit" | "data">("users");
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="設定・監査ログ" sub="ユーザーと権限、営業ステージの設計、操作履歴" actions={<Segmented value={tab} onChange={setTab} options={[{ id: "users", label: "ユーザーと権限" }, { id: "stages", label: "営業ステージ" }, { id: "audit", label: "監査ログ" }, { id: "data", label: "データ" }]} />} />

      {tab === "users" && (
        <div className="space-y-5">
          <section className="card overflow-x-auto">
            <table className="tbl min-w-[640px]"><thead><tr><th>ユーザー</th><th>役職</th><th>Email</th><th>ロール</th></tr></thead>
              <tbody>{d.users.map((u) => (
                <tr key={u.id}><td><span className="inline-flex items-center gap-2 font-semibold"><Avatar user={u} size={24} />{u.name}</span></td><td className="text-ink-2">{u.title}</td><td className="text-ink-2">{u.email}</td>
                  <td className="w-[160px]"><select aria-label="ロール" className="select !h-8" disabled={!perms.isAdmin || u.id === me.id} value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td></tr>
              ))}</tbody></table>
            {!perms.isAdmin && <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">ロールの変更は Admin のみ可能です。</p>}
          </section>
          <section className="card overflow-x-auto">
            <div className="card-h"><h2 className="card-t">権限マトリクス（RBAC）</h2></div>
            <table className="tbl mt-2 min-w-[560px]"><thead><tr><th>操作</th>{ROLES.map((r) => <th key={r.id} className="text-center">{r.label}</th>)}</tr></thead>
              <tbody>{MATRIX.map(([label, ...v]) => <tr key={label}><td>{label}</td>{v.map((ok, i) => <td key={i} className="text-center">{ok ? <Check size={15} className="inline text-good" /> : <Minus size={15} className="inline text-ink-3/50" />}</td>)}</tr>)}</tbody></table>
            <div className="grid gap-2 border-t border-line p-4 text-[12px] text-ink-2 sm:grid-cols-3">{ROLES.map((r) => <div key={r.id}><b>{r.label}</b>：{r.desc}</div>)}</div>
          </section>
          <p className="px-1 text-xs text-ink-3">※ 本番では Supabase の Row Level Security（RLS）で同じ規則をデータベース側でも強制します（画面の制御だけに頼りません）。</p>
        </div>
      )}

      {tab === "stages" && (
        <section className="card overflow-x-auto">
          <table className="tbl min-w-[640px]"><thead><tr><th>ステージ</th><th>英語名</th><th className="text-right">標準確度</th><th>定義</th></tr></thead>
            <tbody>{STAGES.map((s) => <tr key={s.id}><td><StageChip stage={s.id} /></td><td className="text-ink-2">{s.en}</td><td className="num text-right">{s.kind === "open" ? `${s.probability}%` : s.kind === "won" ? "100%" : "—"}</td><td className="text-ink-2">{s.hint}</td></tr>)}</tbody></table>
          <div className="space-y-1 border-t border-line p-4 text-[12.5px] text-ink-2">
            <p><b>統合の判断：</b>仕様書の「Qualification」を「Hearing」に統合し、有効ステージを6段階にしました。見極めとヒアリングは同じ打合せで行われ、現場でステージを分けて更新する負担のほうが大きいためです。</p>
            <p><b>為替（デモ）：</b>{Object.entries(FX).filter(([c]) => c !== "JPY").map(([c, v]) => `1 ${c} = ¥${v}`).join(" ／ ")}（本番では設定画面または外部レートから更新）</p>
          </div>
        </section>
      )}

      {tab === "audit" && (
        perms.isManager ? (
          <section className="card overflow-x-auto">
            <div className="card-h"><h2 className="card-t">操作履歴<span className="ml-2 text-xs font-normal text-ink-3">直近{d.audit.length}件</span></h2><button className="btn btn-sm" onClick={() => downloadCsv("audit-log.csv", [["日時", "ユーザー", "操作", "対象", "内容"], ...d.audit.map((a) => [fmtDateTime(a.at), d.users.find((u) => u.id === a.userId)?.name, a.action, a.entity, a.label])])}><Download size={13} />CSV</button></div>
            <table className="tbl mt-2 min-w-[720px]"><thead><tr><th>日時</th><th>ユーザー</th><th>操作</th><th>対象</th><th>内容</th></tr></thead>
              <tbody>{d.audit.map((a) => <tr key={a.id}><td className="num whitespace-nowrap text-ink-2">{fmtDateTime(a.at)}</td><td className="whitespace-nowrap">{d.users.find((u) => u.id === a.userId)?.name}</td><td><span className="chip">{a.action}</span></td><td className="text-ink-2">{a.entity}</td><td className="max-w-[360px] truncate">{a.label}</td></tr>)}
                {d.audit.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-ink-3">まだ操作履歴がありません。データを編集するとここに記録されます。</td></tr>}</tbody></table>
          </section>
        ) : <section className="card p-8 text-center text-[13px] text-ink-2">監査ログは Manager 以上のロールで閲覧できます。（現在：{ROLE_LABEL[me.role]}）</section>
      )}

      {tab === "data" && (
        <section className="card space-y-4 p-5 text-[13px]">
          <p className="text-ink-2">このデモ版のデータはお使いのブラウザ内（localStorage）にだけ保存されます。他の端末や他のユーザーとは共有されません。本番では Supabase（PostgreSQL）に保存し、日次バックアップを取得します。</p>
          <button className="btn btn-danger" onClick={() => { if (confirm("デモデータを初期状態に戻します。入力した内容は失われます。よろしいですか？")) resetDemo(); }}><RotateCcw size={14} />デモデータを初期状態に戻す</button>
        </section>
      )}
    </div>
  );
}
