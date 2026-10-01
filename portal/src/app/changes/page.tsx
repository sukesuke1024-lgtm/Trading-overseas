"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Paperclip } from "lucide-react";
import { uploadFile, type Uploaded } from "@/lib/files";
import { deptOf, fmtBytes } from "@/lib/ops";
import { useStore, ymd } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";
import type { Workflow } from "@/lib/data";

/** 異動・変更届の種類と、届出に必要な項目・添付書類の目安 */
const KINDS: { id: string; label: string; fields: { key: string; label: string; ph?: string }[]; docs: string }[] = [
  { id: "住所変更", label: "住所の変更", fields: [{ key: "new", label: "新しい住所", ph: "郵便番号・住所" }, { key: "tel", label: "電話番号（変更があれば）" }], docs: "住民票の写し（または新住所の確認書類）" },
  { id: "氏名変更", label: "氏名の変更（婚姻・離婚など）", fields: [{ key: "new", label: "新しい氏名（フリガナ）" }, { key: "old", label: "変更前の氏名" }], docs: "戸籍謄本・抄本、または住民票（新旧氏名の確認できるもの）" },
  { id: "家族の異動", label: "家族・扶養の異動（結婚・出産・死亡など）", fields: [{ key: "new", label: "異動の内容（対象者・続柄・生年月日）" }], docs: "戸籍謄本、住民票、出生・死亡等の確認書類" },
  { id: "通勤経路変更", label: "通勤経路の変更", fields: [{ key: "new", label: "新しい経路・最寄り駅・定期代" }, { key: "old", label: "変更前の経路" }], docs: "経路図・定期代の見積り" },
  { id: "振込口座変更", label: "給与振込口座の変更", fields: [{ key: "new", label: "新しい口座（銀行・支店・種別。口座番号は添付書類で）" }], docs: "通帳の写し（口座名義・番号のページ）" },
  { id: "緊急連絡先変更", label: "緊急連絡先の変更", fields: [{ key: "new", label: "新しい緊急連絡先（氏名・続柄・電話）" }], docs: "—" },
  { id: "その他", label: "その他の変更", fields: [{ key: "new", label: "変更の内容" }], docs: "必要に応じて" },
];
const TONE = { 承認待ち: "warn", 承認済: "good", 差戻し: "bad", 却下: "bad", 取下げ: "gray" } as const;

export default function ChangesPage() {
  const { s, meId, role, nameOf } = useStore();
  const router = useRouter();
  const [form, setForm] = useState(false);
  const list = s.workflows.filter((w) => w.type === "異動変更届" && (w.applicantId === meId || role !== "employee" || w.steps.some((x) => x.approverId === meId)));
  return (
    <div>
      <PageHeader title="異動・変更届" sub="住所・氏名（戸籍）・家族・通勤経路・振込口座などに変更があったときの届出です。人事（管理部）が確認・承認します。" actions={<button className="btn btn-primary" onClick={() => setForm(true)}><FilePlus2 size={15} />変更届を出す</button>} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]"><thead><tr><th className="th">届出番号</th><th className="th">内容</th><th className="th">届出者</th><th className="th">変更日</th><th className="th">状態</th></tr></thead>
          <tbody>{list.map((w) => <tr key={w.id} className="cursor-pointer hover:bg-bg" onClick={() => router.push(`/workflow?id=${w.id}`)}><td className="td tabular text-ink-3">{w.id}</td><td className="td font-medium">{w.title}</td><td className="td">{nameOf(w.applicantId)}</td><td className="td tabular">{w.from ?? "—"}</td><td className="td"><Badge tone={TONE[w.status]}>{w.status}</Badge></td></tr>)}</tbody></table>
        {list.length === 0 && <Empty>変更届はまだありません。</Empty>}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">届出の内容と添付書類（住民票・戸籍など）は、届出者・承認者（人事）・管理者だけが閲覧できます。承認後の反映（給与・社会保険・マスタ）は人事が行います。</p>
      {form && <NewChange onClose={() => setForm(false)} />}
    </div>
  );
}

function NewChange({ onClose }: { onClose: () => void }) {
  const { d, me, meId, nextWfId, approvalRoute } = useStore();
  const router = useRouter();
  const [wfId] = useState(() => nextWfId());
  const [kind, setKind] = useState(KINDS[0].id);
  const k = KINDS.find((x) => x.id === kind) ?? KINDS[0];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [eff, setEff] = useState(ymd(new Date()));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Uploaded[]>([]);
  const [err, setErr] = useState("");
  const route = approvalRoute("異動変更届", undefined, meId);
  const ok = !!vals.new?.trim() && !!reason.trim();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="変更届" onClick={onClose}>
      <form className="card max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault(); if (!ok) return;
        const detail = [`【${k.label}】`, ...k.fields.map((f) => `${f.label}：${vals[f.key] ?? ""}`), `変更日：${eff}`, `理由：${reason}`].join("\n");
        const w: Workflow = { id: wfId, type: "異動変更届", title: `${k.id}届（${me.name}）`, applicantId: meId, from: eff, detail, createdAt: ymd(new Date()), status: "承認待ち", steps: route };
        d({ t: "wf-new", w });
        for (const u of pending) d({ t: "file-add", rec: { id: u.id, name: u.name, size: u.size, mime: u.mime, kind: "申請添付", scope: "申請", wfId: w.id, dept: deptOf(me), uploadedBy: meId, at: new Date().toISOString() } });
        router.push(`/workflow?id=${w.id}`);
      }}>
        <h2 className="text-lg font-bold">異動・変更届</h2>
        <div><label className="label" htmlFor="ck">変更の種類</label><select id="ck" className="input" value={kind} onChange={(e) => { setKind(e.target.value); setVals({}); }}>{KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
        {k.fields.map((f, i) => <div key={f.key}><label className="label" htmlFor={`cf-${f.key}`}>{f.label}{i === 0 ? "（必須）" : ""}</label><input id={`cf-${f.key}`} required={i === 0} maxLength={300} placeholder={f.ph} className="input" value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} /></div>)}
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="ce">変更日（効力発生日）</label><input id="ce" type="date" required className="input" value={eff} onChange={(e) => setEff(e.target.value)} /></div></div>
        <div><label className="label" htmlFor="cr">理由・経緯（必須）</label><textarea id="cr" required rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div><label className="label" htmlFor="ca">添付書類</label><p className="mb-1 text-[12px] text-ink-3">必要書類の目安：{k.docs}</p>
          <input id="ca" type="file" multiple className="block text-[13px]" onChange={async (e) => { setErr(""); for (const file of Array.from(e.target.files ?? [])) { const r = await uploadFile(file); if ("error" in r) setErr(r.error); else setPending((p) => [...p, r]); } e.target.value = ""; }} />
          {err && <p role="alert" className="mt-1 text-[12px] text-bad">{err}</p>}
          <ul className="mt-1 space-y-0.5 text-[12.5px]">{pending.map((u) => <li key={u.id} className="flex items-center gap-2"><Paperclip size={12} aria-hidden />{u.name}（{fmtBytes(u.size)}）<button type="button" className="text-ink-3 underline" onClick={() => setPending((p) => p.filter((x) => x.id !== u.id))}>外す</button></li>)}</ul></div>
        <p className="text-[12px] text-ink-3">承認ルート：{route.map((r) => r.label).join(" → ")}。個人情報を含むため、届出者・人事・管理者以外には表示されません。</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok}>届け出る</button></div>
      </form>
    </div>
  );
}
