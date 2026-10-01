"use client";

import { NumInput } from "@/components/NumInput";
import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { STMT_PERIODS_REQUIRED, creditStatementIssue, isFiscalPeriod, statementPeriods, CHECK_KINDS, CHECK_RESULTS, EXT_KINDS, deptOf, isClientCode, isHttps, latestCheck, type Client, type CreditCheck, type ExtLink } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { FileDownload, UploadButton } from "@/components/Files";
import { Fold, Badge, Empty, PageHeader } from "@/components/ui";

type Tab = "clients" | "checks" | "links";
const tone = (r?: string) => (!r ? "gray" : r === "問題なし" ? "good" : r === "確認中" ? "warn" : "bad") as "gray" | "good" | "warn" | "bad";
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

export default function ClientsPage() {
  const { s, role, me } = useStore();
  const [tab, setTab] = useState<Tab>("clients");
  const [edit, setEdit] = useState<Client | "new" | null>(null);
  const [check, setCheck] = useState<Client | null>(null);
  const manage = can.manageClients(role);
  const dept = deptOf(me);
  const clients = role === "employee" ? s.clients.filter((c) => c.dept === dept) : s.clients; // 事業部ごと（従業員は自事業部のみ）
  const depts = useMemo(() => [...new Set(s.employees.map((e) => deptOf(e)))].sort(), [s.employees]);

  return (
    <div>
      <PageHeader title="関与先・与信/反社の確認" sub="関与先（取引先）の台帳と、与信判断・反社確認の記録。外部の調査サービス・公的サイトへのリンクを事業部ごとのIDつきで管理します。"
        actions={manage && tab === "clients" ? <button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />関与先を登録</button> : undefined} />
      <div className="mb-3 flex gap-1 border-b border-line" role="tablist">
        {([["clients", `関与先（${clients.length}）`], ["checks", "確認の記録"], ["links", "外部リンク"]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${tab === k ? "border-brand text-brand" : "border-transparent text-ink-3"}`}>{l}</button>)}
      </div>

      {tab === "clients" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]"><thead><tr><th className="th">コード</th><th className="th">関与先名</th><th className="th">事業部</th><th className="th">与信</th><th className="th">反社</th><th className="th"><span className="sr-only">操作</span></th></tr></thead>
            <tbody>{clients.map((c) => { const cr = latestCheck(s.checks, c.code, "与信"), an = latestCheck(s.checks, c.code, "反社"); return (
              <tr key={c.code} className={c.active ? "" : "opacity-50"}>
                <td className="td tabular font-medium">{c.code}</td>
                <td className="td"><div className="font-medium">{c.name}{!c.active && <span className="ml-2 text-[11px] text-ink-3">（停止中）</span>}</div><div className="text-[11.5px] text-ink-3">{c.corpNo ? `法人番号 ${c.corpNo}` : ""}{c.contact ? `　${c.contact}` : ""}</div></td>
                <td className="td">{c.dept}</td>
                <td className="td"><Badge tone={tone(cr?.result)}>{cr ? cr.result : "未確認"}</Badge>{cr && <div className="tabular text-[11px] text-ink-3">{cr.at.slice(0, 10)}</div>}</td>
                <td className="td"><Badge tone={tone(an?.result)}>{an ? an.result : "未確認"}</Badge>{an && <div className="tabular text-[11px] text-ink-3">{an.at.slice(0, 10)}</div>}</td>
                <td className="td"><div className="flex gap-1 whitespace-nowrap"><button className="btn !h-8" onClick={() => setCheck(c)}><ShieldCheck size={13} />確認する</button>{manage && <><button className="btn !h-8 !w-8 !p-0" aria-label={`${c.name}を編集`} onClick={() => setEdit(c)}><Pencil size={13} /></button><DelClient c={c} /></>}</div></td>
              </tr>); })}</tbody></table>
          {clients.length === 0 && <Empty>{manage ? "関与先がまだありません。「関与先を登録」から追加してください（日報の関与先コードに使われます）。" : "あなたの事業部の関与先はまだ登録されていません。"}</Empty>}
        </div>
      )}
      {tab === "checks" && <Checks clients={clients} />}
      {tab === "links" && <Links depts={depts} />}
      {edit && <ClientForm key={edit === "new" ? "new" : edit.code} init={edit === "new" ? null : edit} depts={depts} onClose={() => setEdit(null)} />}
      {check && <CheckForm client={check} onClose={() => setCheck(null)} />}
    </div>
  );
}

function DelClient({ c }: { c: Client }) {
  const { d, meId } = useStore();
  return <button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${c.name}を削除`} onClick={() => confirm(`「${c.name}」を削除しますか？（確認の記録は残ります）`) && d({ t: "client-del", code: c.code, by: meId })}><Trash2 size={13} /></button>;
}

function Checks({ clients }: { clients: Client[] }) {
  const { s, nameOf } = useStore();
  const codes = new Set(clients.map((c) => c.code));
  const list = s.checks.filter((c) => codes.has(c.clientCode));
  const cn = (code: string) => s.clients.find((c) => c.code === code)?.name ?? code;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]"><thead><tr><th className="th">日時</th><th className="th">関与先</th><th className="th">種別</th><th className="th">結果</th><th className="th">確認に使った情報源</th><th className="th">確認者</th><th className="th">メモ</th></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><td className="td tabular whitespace-nowrap">{when(c.at)}</td><td className="td"><span className="tabular text-ink-3">{c.clientCode}</span> {cn(c.clientCode)}</td><td className="td">{c.kind}</td><td className="td"><Badge tone={tone(c.result)}>{c.result}</Badge></td><td className="td">{c.source}</td><td className="td">{nameOf(c.checkedBy)}</td><td className="td">{c.note}{c.limit != null ? `（与信限度 ${c.limit.toLocaleString("ja-JP")}円）` : ""}</td></tr>)}</tbody></table>
      {list.length === 0 && <Empty>確認の記録はまだありません。「関与先」から「確認する」で記録します。</Empty>}
      <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">確認の記録は追記のみで、後から書き換えられません。結果は法令・社内規程に沿って、担当者の判断で記録してください。</p>
    </div>
  );
}

function linksFor(links: ExtLink[], dept: string) {
  return links.filter((l) => !l.dept || l.dept === dept);
}

function Links({ depts }: { depts: string[] }) {
  const { s, d, meId, role, me } = useStore();
  const [edit, setEdit] = useState<ExtLink | "new" | null>(null);
  const manage = can.manageExtLinks(role);
  const mine = deptOf(me);
  const list = manage ? s.extLinks : linksFor(s.extLinks, mine);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-[12.5px] text-ink-2">リンクは新しいタブで開きます。事業部ごとの外部サービスのIDは、<b>自事業部の分だけ</b>表示されます。パスワードは登録しないでください。</p>{manage && <div className="flex shrink-0 gap-2"><button className="btn" onClick={() => d({ t: "ext-defaults", by: meId })} title="帝国データバンク・G-Search・TSR・国税庁等の標準リンクのうち、未登録のものを追加します">標準リンクを補完</button><button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={15} />リンクを追加</button></div>}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((l) => (
          <section key={l.id} className="card p-4" aria-label={l.name}>
            <div className="mb-1 flex items-start gap-2"><div className="min-w-0 flex-1"><h2 className="font-bold">{l.name}</h2><div className="mt-0.5 flex flex-wrap items-center gap-1.5"><Badge tone={l.kind === "反社" ? "bad" : l.kind === "与信" ? "warn" : "gray"}>{l.kind}</Badge><Badge>{l.dept || "全社共通"}</Badge></div></div>
              {manage && <div className="flex gap-1"><button className="btn !h-8 !w-8 !p-0" aria-label={`${l.name}を編集`} onClick={() => setEdit(l)}><Pencil size={13} /></button><button className="btn btn-danger !h-8 !w-8 !p-0" aria-label={`${l.name}を削除`} onClick={() => confirm(`「${l.name}」を削除しますか？`) && d({ t: "ext-del", id: l.id, by: meId })}><Trash2 size={13} /></button></div>}</div>
            {l.note && <p className="mb-2 text-[12.5px] text-ink-2">{l.note}</p>}
            {l.accountId && <p className="mb-2 rounded bg-surface-2 px-2 py-1 text-[12.5px]">事業部ID：<b className="tabular">{l.accountId}</b></p>}
            <a className="btn btn-primary w-full" href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />開く</a>
          </section>
        ))}
        {list.length === 0 && <div className="card md:col-span-2"><Empty>表示できるリンクがありません。</Empty></div>}
      </div>
      {edit && <LinkForm key={edit === "new" ? "new" : edit.id} init={edit === "new" ? null : edit} depts={depts} onClose={() => setEdit(null)} />}
    </div>
  );
}

function LinkForm({ init, depts, onClose }: { init: ExtLink | null; depts: string[]; onClose: () => void }) {
  const { d, meId } = useStore();
  const [newId] = useState(() => `x${Date.now()}`);
  const [f, setF] = useState({ name: init?.name ?? "", url: init?.url ?? "https://", kind: init?.kind ?? "与信", dept: init?.dept ?? "", accountId: init?.accountId ?? "", note: init?.note ?? "" });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="外部リンク" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!isHttps(f.url)) return; d({ t: "ext-save", by: meId, link: { id: init?.id ?? newId, name: f.name.trim(), url: f.url.trim(), kind: f.kind as ExtLink["kind"], dept: f.dept, ...(f.accountId.trim() ? { accountId: f.accountId.trim() } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) } }); onClose(); }}>
        <h2 className="text-lg font-bold">{init ? "外部リンクを編集" : "外部リンクを追加"}</h2>
        <div><label className="label" htmlFor="ln">名称</label><input id="ln" required maxLength={80} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="lu">URL（https://）</label><input id="lu" required className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />{!isHttps(f.url) && <p className="mt-1 text-[12px] text-bad">https:// で始まるURLを入力してください</p>}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="lk">種別</label><select id="lk" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ExtLink["kind"] })}>{EXT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><label className="label" htmlFor="ld">対象の事業部</label><select id="ld" className="input" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}><option value="">全社共通</option>{depts.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="la">事業部ID（外部サービス上のID）</label><input id="la" maxLength={80} className="input tabular" placeholder="事業部ごとに付与したID（パスワードは入れない）" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })} /></div>
        <div><label className="label" htmlFor="lo">メモ</label><input id="lo" maxLength={300} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.name.trim() || !isHttps(f.url)}>保存</button></div>
      </form>
    </div>
  );
}

function ClientForm({ init, depts, onClose }: { init: Client | null; depts: string[]; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [f, setF] = useState({ code: init?.code ?? "", name: init?.name ?? "", dept: init?.dept ?? depts[0] ?? "", corpNo: init?.corpNo ?? "", contact: init?.contact ?? "", note: init?.note ?? "", active: init?.active ?? true });
  const dup = !init && s.clients.some((c) => c.code.toLowerCase() === f.code.toLowerCase());
  const corpBad = !!f.corpNo && !/^\d{13}$/.test(f.corpNo);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="関与先の登録" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (dup || corpBad || !isClientCode(f.code)) return; d({ t: "client-save", by: meId, client: { code: f.code.toUpperCase(), name: f.name.trim(), dept: f.dept, ...(f.corpNo ? { corpNo: f.corpNo } : {}), ...(f.contact.trim() ? { contact: f.contact.trim() } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}), active: f.active } }); onClose(); }}>
        <h2 className="text-lg font-bold">{init ? "関与先を編集" : "関与先を登録"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cc">関与先コード（英数字・ハイフン）</label><input id="cc" required disabled={!!init} className="input tabular" placeholder="例：C001" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />{dup && <p className="mt-1 text-[12px] text-bad">このコードは使われています</p>}{f.code && !isClientCode(f.code) && <p className="mt-1 text-[12px] text-bad">2〜16文字の英数字・ハイフン</p>}</div>
          <div><label className="label" htmlFor="cd">事業部</label><select id="cd" className="input" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>{[...new Set([f.dept, ...depts])].map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="cn">関与先名</label><input id="cn" required maxLength={100} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="co">法人番号（13桁）</label><input id="co" inputMode="numeric" maxLength={13} className="input tabular" value={f.corpNo} onChange={(e) => setF({ ...f, corpNo: e.target.value.replace(/\D/g, "") })} />{corpBad && <p className="mt-1 text-[12px] text-bad">13桁の数字です</p>}</div>
          <div><label className="label" htmlFor="ct">連絡先</label><input id="ct" maxLength={200} className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="cm">メモ</label><input id="cm" maxLength={300} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />取引中（日報の関与先コードに使える）</label>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={dup || corpBad || !f.name.trim() || !isClientCode(f.code)}>保存</button></div>
      </form>
    </div>
  );
}

function CheckForm({ client, onClose }: { client: Client; onClose: () => void }) {
  const { s, d, meId } = useStore();
  const [newId] = useState(() => `k${Date.now()}`);
  const [f, setF] = useState({ kind: "与信" as CreditCheck["kind"], result: "確認中" as CreditCheck["result"], source: "", note: "", limit: "", reason: "", period: "" });
  const links = linksFor(s.extLinks, client.dept).filter((l) => l.kind === f.kind || l.kind === "公的情報");
  const stmts = s.files.filter((x) => x.kind === "決算書" && x.clientCode === client.code).sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
  const periods = statementPeriods(s.files, client.code);
  const issue = creditStatementIssue(f.kind, f.result, periods, f.reason);
  const hist = s.checks.filter((c) => c.clientCode === client.code).slice(0, 5);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="確認の記録" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); d({ t: "check-add", check: { id: newId, clientCode: client.code, kind: f.kind, result: f.result, source: f.source || "その他", ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(f.kind === "与信" && f.reason.trim() ? { stmtReason: f.reason.trim() } : {}), ...(f.kind === "与信" && f.limit !== "" && Number.isFinite(Number(f.limit)) ? { limit: Number(f.limit) } : {}), checkedBy: meId, at: new Date().toISOString() } }); onClose(); }}>
        <h2 className="text-lg font-bold">{client.name}（{client.code}）の確認</h2>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-[13px]">{CHECK_KINDS.map((k) => <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k, source: "" })} className={`rounded-md py-1.5 ${f.kind === k ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>{k === "与信" ? "与信判断" : "反社確認"}</button>)}</div>
        <div><div className="label">① 外部の調査先を開いて確認（新しいタブ）</div>
          <div className="flex flex-wrap gap-2">{links.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="btn !h-8" onClick={() => setF((x) => ({ ...x, source: x.source || l.name }))}><ExternalLink size={13} />{l.name}{l.accountId ? `（ID ${l.accountId}）` : ""}</a>)}{links.length === 0 && <span className="text-[12.5px] text-ink-3">リンクが登録されていません（管理者が「外部リンク」で追加できます）</span>}</div></div>
        {f.kind === "与信" && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 flex items-center justify-between gap-2"><div className="label !mb-0">② 決算書（直近{STMT_PERIODS_REQUIRED}期分）をいただく</div><Badge tone={periods.length >= STMT_PERIODS_REQUIRED ? "good" : "warn"}>{periods.length}／{STMT_PERIODS_REQUIRED}期</Badge></div>
            <p className="mb-2 text-[12px] text-ink-3">帝国データバンク・G-Search等の調査報告書だけでなく、取引先から<b>直近3期分の決算書（貸借対照表・損益計算書）</b>を受け取り、決算期ごとに添付します。</p>
            {stmts.length > 0 && <ul className="mb-2 space-y-1 text-[12.5px]">{stmts.map((x) => <li key={x.id} className="flex items-center gap-2"><Badge tone="good">{x.period?.replace("-", "年")}月期</Badge><FileDownload rec={x}>{x.name}</FileDownload></li>)}</ul>}
            <div className="grid items-end gap-2 sm:grid-cols-[10rem_1fr]">
              <div><label className="label" htmlFor="kp">決算期（期末の年月）</label><input id="kp" type="month" className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></div>
              <div>{isFiscalPeriod(f.period) ? <UploadButton compact label={`${f.period.replace("-", "年")}月期の決算書をドラッグ＆ドロップ`} meta={{ kind: "決算書", scope: "事業部", dept: client.dept, clientCode: client.code, period: f.period }} onDone={() => setF((x) => ({ ...x, period: "" }))} /> : <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-[12.5px] text-ink-3">先に「決算期」を選ぶと、添付の枠が出ます</p>}</div>
            </div>
            {periods.length < STMT_PERIODS_REQUIRED && <div className="mt-2"><label className="label" htmlFor="kq">3期分そろわない理由（新設法人・個人事業主・開示拒否など）</label><input id="kq" maxLength={200} className="input" placeholder="例：設立2期目のため、第1期のみ受領" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>}
            {issue && <p role="status" className="mt-2 text-[12.5px] text-warn">{issue}</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="kr">③ 結果</label><select id="kr" className="input" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value as CreditCheck["result"] })}>{CHECK_RESULTS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label" htmlFor="ks">確認に使った情報源</label><input id="ks" required maxLength={80} className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} list="srcs" /><datalist id="srcs">{links.map((l) => <option key={l.id} value={l.name} />)}</datalist></div>
        </div>
        {f.kind === "与信" && <div className="max-w-xs"><label className="label" htmlFor="kl">与信限度額（円・任意）</label><NumInput id="kl" className="input" value={f.limit} onChange={(v) => setF({ ...f, limit: v })} /></div>}
        <div><label className="label" htmlFor="kn">メモ（根拠・判断の理由）</label><textarea id="kn" rows={3} maxLength={500} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {hist.length > 0 && <Fold title={`これまでの記録（${hist.length}件）`}><ul className="space-y-0.5">{hist.map((c) => <li key={c.id}>{c.at.slice(0, 10)} {c.kind}：{c.result}（{c.source}）{c.periods ? `・決算書${c.periods.length}期` : ""}</li>)}</ul></Fold>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!f.source.trim() || !!issue}>記録する</button></div>
      </form>
    </div>
  );
}
