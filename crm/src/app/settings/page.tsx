"use client";
import { useState } from "react";
import { Check, Download, Minus, RotateCcw } from "lucide-react";
import { applyRoster, loadSecurity, logout, resetDemo, saveSecurity, updateUser, useMe, useStore } from "@/lib/store";
import { PORTAL_DEMO_ROSTER, SALES_DEPT, diffRoster, parseRoster, roleFromPortal, toUser, type PortalEmployee } from "@/lib/roster";
import { PORTAL_URL } from "@/lib/asset";
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
  const [tab, setTab] = useState<"users" | "roster" | "security" | "stages" | "audit" | "data">("users");
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="設定・監査ログ" sub="ユーザーと権限、営業ステージの設計、操作履歴" actions={<Segmented value={tab} onChange={setTab} options={[{ id: "users", label: "ユーザーと権限" }, { id: "roster", label: "従業員名簿" }, { id: "security", label: "セキュリティ" }, { id: "stages", label: "営業ステージ" }, { id: "audit", label: "監査ログ" }, { id: "data", label: "データ" }]} />} />

      {tab === "users" && (
        <div className="space-y-5">
          <section className="card overflow-x-auto">
            <table className="tbl min-w-[720px]"><thead><tr><th>従業員番号</th><th>ユーザー</th><th>部署・職種</th><th>Email</th><th>ロール</th></tr></thead>
              <tbody>{d.users.map((u) => (
                <tr key={u.id}><td className="num text-ink-2">{u.employeeNo}</td><td><span className="inline-flex items-center gap-2 font-semibold"><Avatar user={u} size={24} />{u.name}</span></td><td className="text-ink-2">{[u.dept, u.title].filter(Boolean).join("・")}</td><td className="text-ink-2">{u.email}</td>
                  <td className="w-[160px]"><select aria-label="ロール" className="select !h-8" disabled={!perms.isAdmin || u.id === me.id || u.fromPortal} title={u.fromPortal ? "権限は社内ポータルの権限（管理者／役員／従業員）に従います" : undefined} value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td></tr>
              ))}</tbody></table>
            <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">従業員番号・氏名・部署・ロールは社内ポータルの従業員名簿に合わせています（ポータル：管理者→Admin／役員→Manager／従業員→Sales）。変更は「従業員名簿」タブで名簿を取り込んで反映します。</p>
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

      {tab === "roster" && <RosterTab />}
      {tab === "security" && <SecurityTab />}

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

/** 従業員名簿：社内ポータルの従業員マスタと一致させる。ポータルの「従業員・権限」→「CRM用に書き出し」で作った hlink-roster.json（または CSV）を取り込む */
function RosterTab() {
  const d = useStore().data!;
  const perms = permsFor(useMe());
  const [text, setText] = useState("");
  const [incoming, setIncoming] = useState<PortalEmployee[] | null>(null);
  const [err, setErr] = useState("");
  const [removeMissing, setRemoveMissing] = useState(false);
  const [done, setDone] = useState("");
  const preview = incoming ? diffRoster(d.users, incoming) : null;
  const read = (t: string) => { setDone(""); const r = parseRoster(t); if (!r) { setIncoming(null); setErr("名簿として読み取れませんでした。ポータルの「CRM用に書き出し」で作成した JSON か、ヘッダー行（従業員番号・氏名・部署・職種・権限）つきの CSV を指定してください。"); return; } setErr(""); setIncoming(r); };
  const onFile = async (f?: File) => { if (!f) return; const t = await f.text(); setText(t); read(t); };
  const demoDiff = diffRoster(d.users, PORTAL_DEMO_ROSTER);
  const inSync = demoDiff.added.length === 0 && demoDiff.changed.length === 0 && demoDiff.missing.length === 0;
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-3"><h2 className="card-t">社内ポータルとの名簿の一致</h2>{inSync ? <span className="chip chip-good">ポータルのデモ名簿と一致</span> : <span className="chip chip-warn">取込済みの名簿に差し替え済み</span>}</div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">CRM のユーザーは、<a className="text-accent-2 hover:underline" href={PORTAL_URL}>H-LINK 社内ポータル</a>の従業員名簿（従業員番号・氏名・部署・権限）と同じです。入社・異動・退職があったら、ポータルで名簿を書き出して、ここで取り込みます。営業部のお知らせは、名簿の部署が「{SALES_DEPT}」の人と Manager 以上に表示されます。</p>
        <table className="tbl mt-3"><thead><tr><th>番号</th><th>氏名</th><th>部署</th><th>職種</th><th>CRMのロール</th></tr></thead><tbody>{d.users.map((u) => <tr key={u.id}><td className="num">{u.employeeNo}</td><td className="font-semibold">{u.name}</td><td>{u.dept}{u.dept === SALES_DEPT && <span className="chip chip-accent ml-1.5">営業部</span>}</td><td className="text-ink-2">{u.title}</td><td><span className="chip">{ROLE_LABEL[u.role]}</span></td></tr>)}</tbody></table>
      </section>
      {perms.isAdmin ? (
        <section className="card space-y-3 p-5">
          <h2 className="card-t">ポータルの名簿を取り込む</h2>
          <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-ink-2"><li>社内ポータル →「従業員・権限」→「CRM用に書き出し」で hlink-roster.json を保存</li><li>下のボタンでファイルを選ぶ（または内容を貼り付け）</li><li>差分を確認して「反映する」</li></ol>
          <div className="flex flex-wrap items-center gap-2"><input type="file" accept=".json,.csv,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} className="text-[12.5px]" /></div>
          <textarea className="textarea font-mono text-[12px]" rows={4} placeholder="またはここに hlink-roster.json の内容を貼り付け" value={text} onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) read(e.target.value); else setIncoming(null); }} />
          {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{err}</p>}
          {preview && incoming && (
            <div className="rounded-xl bg-surface-2 p-4 text-[12.5px]">
              <div className="mb-2 flex flex-wrap gap-2"><span className="chip chip-good">追加 {preview.added.length}名</span><span className="chip chip-accent">変更 {preview.changed.length}名</span><span className="chip chip-warn">名簿にいない {preview.missing.length}名</span></div>
              <ul className="space-y-0.5">{preview.added.map((e) => <li key={e.id}>＋ {e.id} {e.name}（{e.dept || "部署未設定"}／{ROLE_LABEL[roleFromPortal(e.role)]}）</li>)}{preview.changed.map((e) => <li key={e.id}>～ {e.id} {e.name}（{e.dept || "部署未設定"}／{ROLE_LABEL[roleFromPortal(e.role)]}）</li>)}{preview.missing.map((u) => <li key={u.id} className="text-warn">－ {u.id} {u.name}（名簿にありません）</li>)}</ul>
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={removeMissing} onChange={(e) => setRemoveMissing(e.target.checked)} />名簿にいない人をCRMから外す（その人の担当は「未割当」になります）</label>
              <button className="btn btn-primary mt-3" disabled={!preview.added.length && !preview.changed.length && !(removeMissing && preview.missing.length)} onClick={() => { applyRoster(incoming.map((e) => toUser(e)), removeMissing); setIncoming(null); setText(""); setDone("名簿を反映しました。"); }}>反映する</button>
            </div>
          )}
          {done && <p className="rounded-lg bg-good-soft px-3 py-2 text-xs text-good">{done}</p>}
        </section>
      ) : <section className="card p-5 text-[12.5px] text-ink-2">名簿の取込は Admin が行います。</section>}
    </div>
  );
}

/** セキュリティ：無操作の自動ログアウト・二段階認証（デモ）・全画面からのログアウト（この端末のブラウザの設定） */
function SecurityTab() {
  const [cfg, setCfg] = useState(loadSecurity);
  const [msg, setMsg] = useState("");
  const save = (c: typeof cfg) => { setCfg(c); saveSecurity(c); setMsg("保存しました"); };
  return (
    <div className="space-y-5">
      <section className="card space-y-5 p-5">
        <div><h2 className="card-t mb-1">ログアウトの2つの方法</h2>
          <p className="text-[12.5px] leading-relaxed text-ink-2"><b>① 手動：</b>画面右上のドア印、または左下のユーザーメニューから、いつでもログアウトできます。<br /><b>② 自動：</b>しばらく操作がないと、終了の1分前に予告を出し、自動でログアウトします。どちらも、同じブラウザで開いている<b>ほかのタブ・画面にも反映</b>されます。</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">無操作で自動ログアウトするまでの時間</label><select className="select" value={cfg.idleMinutes} onChange={(e) => save({ ...cfg, idleMinutes: Number(e.target.value) })}>{[5, 10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m}分</option>)}</select><p className="mt-1 text-[11.5px] text-ink-3">金額・信用情報を扱うため、共有パソコンや外出先では短め（5〜15分）をおすすめします。</p></div>
          <div><label className="label">二段階認証（デモ）</label><label className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]"><input type="checkbox" checked={cfg.twoFactor} onChange={(e) => save({ ...cfg, twoFactor: e.target.checked })} />ログイン時に確認コード（6桁）を求める</label><p className="mt-1 text-[11.5px] text-ink-3">デモでは確認コードを画面に表示して流れを確認します。本番では認証アプリ（Authenticator）のコードを使い、Supabase Auth の多要素認証に切り替えます。</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4"><button className="btn" onClick={() => { if (confirm("ログアウトしますか？（ほかのタブも、ログアウトされます）")) logout(); }}>今すぐログアウト（すべてのタブ）</button>{msg && <span role="status" className="text-xs text-good">{msg}</span>}</div>
      </section>
      <p className="px-1 text-[11.5px] text-ink-3">この設定は、お使いのブラウザごとに保存されます。本番では、管理者が全員に同じ基準（自動ログアウトの時間・二段階認証の必須化）を設定します。</p>
    </div>
  );
}
