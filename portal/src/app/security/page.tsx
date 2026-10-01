"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Check, Laptop, Network, Pencil, ShieldAlert, ShieldCheck, Trash2, Usb, X } from "lucide-react";
import { BASE, STATIC } from "@/lib/auth";
import { isValidNet } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";

type Dev = { id: string; empId: string; label: string; status: "approved" | "pending" | "revoked"; createdAt: string; lastSeen: string; lastIp: string; approvedBy?: string };
type Alert = { id: string; at: string; type: string; level: "high" | "mid" | "low"; empId: string; ip: string; detail: string; ack?: boolean; ackBy?: string };
type Sec = { mode: "enforce" | "monitor" | "off"; nets: string[] };
type Data = { devices: Dev[]; alerts?: Alert[]; sec?: Sec; envOverride?: boolean; mailConfigured?: boolean };

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
const LEVEL = { high: ["bad", "重大"], mid: ["warn", "注意"], low: ["gray", "情報"] } as const;
const MODE_LABEL = { enforce: "遮断する（登録済みの端末・許可ネットワークのみ）", monitor: "監視のみ（検知してアラートを出すが、遮断はしない）", off: "制限なし" } as const;

// デモ版は静的な画面のため、実際の端末登録・検知はできない。仕組みを見せるためのサンプル（架空）を表示する
const DEMO: Data = {
  devices: [
    { id: "d1", empId: "902", label: "Windows（Chrome）", status: "approved", createdAt: "2026-09-01T09:00:00Z", lastSeen: "2026-10-01T08:50:00Z", lastIp: "192.168.1.20", approvedBy: "初回登録" },
    { id: "d2", empId: "902", label: "iOS（Safari）", status: "pending", createdAt: "2026-10-01T07:12:00Z", lastSeen: "2026-10-01T07:12:00Z", lastIp: "203.0.113.45" },
  ],
  alerts: [
    { id: "a1", at: "2026-10-01T07:12:00Z", type: "未登録の端末からのログイン", level: "high", empId: "902", ip: "203.0.113.45", detail: "iOS（Safari）から認証に成功しましたが、未登録の端末です。管理者の承認までログインを保留しました。" },
    { id: "a2", at: "2026-09-30T22:03:00Z", type: "退職者・無効なIDでのログイン試行", level: "high", empId: "050", ip: "198.51.100.7", detail: "退職者または無効なアカウントでログインが試みられました。" },
  ],
  sec: { mode: "enforce", nets: ["192.168.1.0/24"] },
};

export default function SecurityPage() {
  const { s, role, nameOf } = useStore();
  const admin = can.manageSecurity(role);
  const [data, setData] = useState<Data | null>(STATIC ? DEMO : null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (STATIC) return;
    try {
      const r = await fetch(`${BASE}/api/security${admin ? "" : "?mine=1"}`, { credentials: "same-origin", cache: "no-store" });
      if (r.ok) setData(await r.json()); else setErr("読み込めませんでした。");
    } catch { setErr("サーバーに接続できません。"); }
  }, [admin]);
  useEffect(() => { const t0 = setTimeout(() => void load(), 0); const t = setInterval(() => void load(), 30_000); return () => { clearTimeout(t0); clearInterval(t); }; }, [load]);

  const post = async (body: object) => {
    if (STATIC) { setErr("デモ版では操作できません（サーバー版で有効です）。"); return; }
    setErr("");
    const r = await fetch(`${BASE}/api/security`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) setErr(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "操作できませんでした。");
    await load();
  };

  if (!data) return <div className="card p-8 text-center text-ink-3">{err || "読み込み中…"}</div>;
  const alerts = data.alerts ?? [];
  const openAlerts = alerts.filter((a) => !a.ack);
  const pending = data.devices.filter((d) => d.status === "pending");

  return (
    <div>
      <PageHeader title="セキュリティ" sub={admin ? "登録された端末・許可ネットワークだけを受け付け、退職者や外部からの不正なアクセスをアラートで検知します。" : "あなたの登録済みの端末です。"} />
      {STATIC && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">デモ版のため、下の内容は<b>サンプル（架空）</b>です。端末の登録・検知・遮断は、社内サーバーで動かす版で有効になります。</p>}
      {err && <p role="alert" className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}

      {admin && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[["未確認のアラート", openAlerts.length, openAlerts.some((a) => a.level === "high") ? "bad" : "good"], ["承認待ちの端末", pending.length, pending.length ? "warn" : "good"], ["登録端末（承認済み）", data.devices.filter((d) => d.status === "approved").length, "gray"]].map(([l, n, t]) => (
            <div key={l as string} className="card p-4"><div className="text-[12px] text-ink-3">{l}</div><div className={`tabular text-2xl font-bold ${t === "bad" ? "text-bad" : t === "warn" ? "text-warn" : ""}`}>{n}</div></div>
          ))}
        </div>
      )}

      {admin && (
        <section className="card mb-4" aria-label="アラート">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><h2 className="flex items-center gap-2 font-bold"><BellRing size={15} aria-hidden />アラート</h2>{openAlerts.length > 0 && <button className="btn !h-8" onClick={() => post({ action: "ack", id: "all" })}><Check size={13} />すべて確認済みにする</button>}</div>
          {data.mailConfigured === false && !STATIC && <p className="border-b border-line bg-warn-soft px-4 py-2 text-[12px] text-warn">メール送信が未設定のため、重大アラートはメールでは届きません（PORTAL_MAIL_WEBHOOK）。この画面とホームで確認してください。</p>}
          <ul className="divide-y divide-line">{alerts.slice(0, 60).map((a) => (
            <li key={a.id} className={`flex flex-wrap items-start gap-3 px-4 py-2.5 text-[13px] ${a.ack ? "opacity-60" : ""}`}>
              <Badge tone={LEVEL[a.level][0]}>{LEVEL[a.level][1]}</Badge>
              <div className="min-w-0 flex-1"><div className="font-semibold">{a.type}</div><div className="text-ink-2">{a.detail}</div><div className="tabular text-[11.5px] text-ink-3">{when(a.at)}・対象 {a.empId === "-" ? "—" : `${nameOf(a.empId)}（${a.empId}）`}・IP {a.ip}</div></div>
              {!a.ack ? <button className="btn !h-8" onClick={() => post({ action: "ack", id: a.id })}><Check size={13} />確認済み</button> : <span className="text-[11.5px] text-ink-3">確認済み</span>}
            </li>))}</ul>
          {alerts.length === 0 && <Empty>アラートはありません。</Empty>}
        </section>
      )}

      <section className="card mb-4" aria-label="登録端末">
        <div className="border-b border-line px-4 py-2.5"><h2 className="flex items-center gap-2 font-bold"><Laptop size={15} aria-hidden />登録されている端末（PC・スマホ）</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-[13px]"><thead><tr><th className="th">使用者</th><th className="th">端末</th><th className="th">状態</th><th className="th">最終利用</th><th className="th">IP</th>{admin && <th className="th"><span className="sr-only">操作</span></th>}</tr></thead>
          <tbody>{data.devices.map((dv) => (
            <tr key={dv.id}><td className="td">{nameOf(dv.empId)}<span className="ml-1 text-[11.5px] text-ink-3">{dv.empId}</span></td><td className="td font-medium">{dv.label}</td>
              <td className="td"><Badge tone={dv.status === "approved" ? "good" : dv.status === "pending" ? "warn" : "bad"}>{dv.status === "approved" ? "承認済み" : dv.status === "pending" ? "承認待ち" : "無効"}</Badge>{dv.approvedBy && <span className="ml-1 text-[11px] text-ink-3">{dv.approvedBy === "初回登録" ? "初回登録" : `承認：${nameOf(dv.approvedBy)}`}</span>}</td>
              <td className="td tabular">{when(dv.lastSeen)}</td><td className="td tabular">{dv.lastIp}</td>
              {admin && <td className="td"><div className="flex gap-1 whitespace-nowrap">
                {dv.status !== "approved" && <button className="btn btn-primary !h-8" onClick={() => post({ action: "approve", id: dv.id })}><ShieldCheck size={13} />承認</button>}
                {dv.status === "approved" && <button className="btn !h-8" onClick={() => confirm("この端末を無効にしますか？（次回からログインできなくなります）") && post({ action: "revoke", id: dv.id })}><X size={13} />無効にする</button>}
                <button className="btn !h-8 !w-8 !p-0" aria-label="名前を変更" onClick={() => { const l = prompt("端末の名前（例：営業 PC-01）", dv.label); if (l) post({ action: "rename", id: dv.id, label: l }); }}><Pencil size={13} /></button>
                <button className="btn btn-danger !h-8 !w-8 !p-0" aria-label="登録を削除" onClick={() => confirm("この端末の登録を削除しますか？") && post({ action: "delete", id: dv.id })}><Trash2 size={13} /></button></div></td>}</tr>))}</tbody></table>
          {data.devices.length === 0 && <Empty>登録された端末はありません。</Empty>}</div>
        <p className="border-t border-line px-4 py-2 text-[11.5px] leading-5 text-ink-3">各自の最初の端末は初回ログイン時に自動で登録され、2台目以降は管理者の承認が済むまでログインできません。ブラウザのデータを消去すると別の端末として扱われます。</p>
      </section>

      {admin && data.sec && <Settings sec={data.sec} env={!!data.envOverride} onSave={(sec) => post({ action: "setting", ...sec })} />}

      {admin && (
        <section className="card p-4 text-[13px] leading-7" aria-label="USB等の管理">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><Usb size={15} aria-hidden />USB・外部媒体と、退職者の扱い</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            <li><b>USBメモリ等</b>：ブラウザ（ウェブ）からは、接続されたUSB機器を検知・遮断できません。<Link href="/assets" className="underline">固定資産台帳</Link>の区分「USB・記憶媒体」にシリアル番号・使用者を登録して持ち出し管理し、PC側の制御（USBポートの制限）はWindowsのグループポリシーやMDM／エンドポイント対策ソフトで行ってください。</li>
            <li><b>退職者</b>：従業員マスタに退職日を入れると、そのIDはログインできなくなり、ログイン中のセッションと登録端末も直ちに無効になります。退職者のIDでのログイン試行は「重大」アラートになります。</li>
            <li><b>外部からのアクセス</b>：許可ネットワークを設定すると、社内LAN・VPN以外からのログインを検知・遮断します。鍵（PIN＋認証アプリ）が正しくても、未登録の端末は管理者の承認まで入れません。</li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3"><ShieldAlert size={13} aria-hidden />締め出されたとき：サーバーの環境変数 PORTAL_SECURITY_MODE=off で一時的に制限を外せます。</p>
          <p className="mt-1 text-[12px] text-ink-3">従業員数：{s.employees.length}名・退職者：{s.employees.filter((e) => e.left).length}名</p>
        </section>
      )}
    </div>
  );
}

function Settings({ sec, env, onSave }: { sec: Sec; env: boolean; onSave: (s: Sec) => void }) {
  const [mode, setMode] = useState(sec.mode);
  const [nets, setNets] = useState(sec.nets.join("\n"));
  const list = nets.split(/[\s,]+/).filter(Boolean);
  const bad = list.filter((n) => !isValidNet(n));
  return (
    <section className="card mb-4 p-4" aria-label="設定">
      <h2 className="mb-2 flex items-center gap-2 font-bold"><Network size={15} aria-hidden />アクセス制限の設定</h2>
      {env && <p className="mb-2 rounded bg-warn-soft px-2 py-1 text-[12px] text-warn">環境変数 PORTAL_SECURITY_MODE が設定されているため、動作モードはそちらが優先されます。</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset><legend className="label">動作モード</legend>
          {(Object.keys(MODE_LABEL) as Sec["mode"][]).map((m) => <label key={m} className="mb-1.5 flex items-start gap-2 text-[13px]"><input type="radio" name="mode" className="mt-1" checked={mode === m} onChange={() => setMode(m)} />{MODE_LABEL[m]}</label>)}</fieldset>
        <div><label className="label" htmlFor="nets">許可するネットワーク（社内LAN・VPNのIP範囲。1行に1つ）</label><textarea id="nets" rows={4} className="input tabular" placeholder={"192.168.1.0/24\n203.0.113.5"} value={nets} onChange={(e) => setNets(e.target.value)} />
          {bad.length > 0 && <p role="alert" className="mt-1 text-[12px] text-bad">形式が正しくありません：{bad.join("、")}</p>}
          <p className="mt-1 text-[11.5px] text-ink-3">空欄なら場所の制限はしません。設定後は、必ず自分の接続元が含まれていることを確認してください（含まれないと自分も入れなくなります）。</p></div>
      </div>
      <button className="btn btn-primary mt-3" disabled={bad.length > 0} onClick={() => onSave({ mode, nets: list })}>設定を保存</button>
    </section>
  );
}
