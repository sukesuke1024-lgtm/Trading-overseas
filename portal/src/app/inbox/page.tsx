"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox as InboxIcon, Mail as MailIcon, PenSquare, Send, Users, UserRound } from "lucide-react";
import { MAIL_CATEGORIES, MAIL_STATUS, deptOf, isMailUnread, mailReadKey, type Mail } from "@/lib/ops";
import { can } from "@/lib/perm";
import { useStore } from "@/lib/store";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { MailCompose } from "@/components/MailCompose";

type Box = "personal" | "dept" | "desk" | "sent";
const NONE: string[] = [];
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
const STATUS_TONE = { 未対応: "warn", 対応中: "brand", 完了: "good" } as const;

export default function InboxPage() {
  const { s, d, me, meId, role, nameOf, mails } = useStore();
  const sp = useSearchParams();
  const [box, setBox] = useState<Box>(() => { const b = sp.get("box"); return b === "desk" && can.manageMail(role) ? "desk" : b === "sent" || b === "dept" ? b : "personal"; });
  const [cat, setCat] = useState<"すべて" | (typeof MAIL_CATEGORIES)[number]>("すべて");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const read = s.read[meId] ?? NONE;
  const dept = deptOf(me);
  const lead = role !== "employee";

  const inBox = (m: Mail) => box === "personal" ? m.toType === "個人" && m.toId === meId : box === "dept" ? m.toType === "事業部" && (lead || m.toId === dept) : box === "desk" ? m.toType === "窓口" && m.from !== meId : m.from === meId;
  const base = useMemo(() => mails.filter(inBox).sort((a, b) => (b.thread.at(-1)?.at ?? b.at).localeCompare(a.thread.at(-1)?.at ?? a.at)), [mails, box, meId, dept, lead]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = base.filter((m) => (cat === "すべて" || m.category === cat) && (!onlyOpen || m.status !== "完了"));
  const counts = (b: Box) => mails.filter((m) => (b === "personal" ? m.toType === "個人" && m.toId === meId : b === "dept" ? m.toType === "事業部" && (lead || m.toId === dept) : b === "desk" ? m.toType === "窓口" && m.from !== meId : m.from === meId) && isMailUnread(m, read, meId)).length;
  const cur = mails.find((m) => m.id === sel);
  const open = (m: Mail) => { setSel(m.id); if (!read.includes(mailReadKey(m))) d({ t: "read", emp: meId, id: mailReadKey(m) }); };

  const boxes: { id: Box; label: string; icon: typeof InboxIcon; show: boolean }[] = [
    { id: "personal", label: "個人宛て", icon: UserRound, show: true },
    { id: "dept", label: lead ? "事業部宛て（全事業部）" : `事業部宛て（${dept}）`, icon: Users, show: true },
    { id: "desk", label: "窓口宛て（管理部）", icon: MailIcon, show: can.manageMail(role) },
    { id: "sent", label: "送信済み", icon: Send, show: true },
  ];

  return (
    <div>
      <PageHeader title="問い合わせBox" sub="個人・事業部・窓口（管理部）ごとに、内容の分類で仕分けられます。" actions={<button className="btn btn-primary" onClick={() => setCompose(true)}><PenSquare size={15} />新規メッセージ</button>} />
      <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
        <aside className="space-y-1" aria-label="ボックス">
          {boxes.filter((b) => b.show).map(({ id, label, icon: I }) => { const n = counts(id); return (
            <button key={id} aria-pressed={box === id} onClick={() => { setBox(id); setSel(null); setCat("すべて"); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] ${box === id ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}><I size={15} aria-hidden /><span className="flex-1">{label}</span>{n > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white tabular">{n}</span>}</button>); })}
          <div className="pt-3"><div className="mb-1 px-1 text-[11px] font-semibold text-ink-3">内容で絞り込み</div>
            <div className="flex flex-wrap gap-1">{(["すべて", ...MAIL_CATEGORIES] as const).map((c) => { const n = base.filter((m) => c === "すべて" || m.category === c).length; return <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full border px-2.5 py-0.5 text-[12px] ${cat === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}>{c}{n > 0 ? ` ${n}` : ""}</button>; })}</div>
            <label className="mt-2 flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />未完了のみ</label></div>
        </aside>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,340px)_1fr]">
          <section className="card self-start overflow-hidden" aria-label="メッセージ一覧">
            {list.length === 0 && <Empty>該当するメッセージはありません</Empty>}
            <ul>{list.map((m) => { const un = isMailUnread(m, read, meId); return (
              <li key={m.id} className="border-b border-line last:border-0"><button className={`w-full px-3 py-2.5 text-left hover:bg-bg ${sel === m.id ? "bg-surface-2" : ""}`} onClick={() => open(m)}>
                <div className="mb-0.5 flex items-center gap-1.5">{un && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-2" aria-label="未読" />}<Badge>{m.category}</Badge><Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>{m.anon && <Badge tone="warn">匿名</Badge>}</div>
                <div className={`truncate text-[13.5px] ${un ? "font-bold" : ""}`}>{m.subject}</div>
                <div className="truncate text-[11.5px] text-ink-3">{m.anon && m.from !== meId ? "匿名" : nameOf(m.from)} → {m.toType === "個人" ? nameOf(m.toId) : m.toType === "事業部" ? `${m.toId}（事業部）` : `${m.toId}窓口`}・{when(m.thread.at(-1)?.at ?? m.at)}</div></button></li>); })}</ul>
          </section>
          <section className="card min-w-0 p-4" aria-label="メッセージの内容">
            {cur ? <Thread mail={cur} /> : <p className="py-10 text-center text-ink-3">左の一覧からメッセージを選んでください。</p>}
          </section>
        </div>
      </div>
      {compose && <MailCompose onClose={() => setCompose(false)} onSent={(id) => { setBox("sent"); setSel(id); }} />}
    </div>
  );
}

function Thread({ mail }: { mail: Mail }) {
  const { d, me, meId, role, nameOf } = useStore();
  const [body, setBody] = useState("");
  const dept = deptOf(me);
  const recipient = mail.toType === "個人" ? mail.toId === meId : mail.toType === "事業部" ? role !== "employee" || mail.toId === dept : role === "admin";
  const mineMsg = mail.from === meId;
  const label = (id: string) => (id === "匿名" ? "匿名" : nameOf(id));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2"><Badge>{mail.category}</Badge><Badge tone={STATUS_TONE[mail.status]}>{mail.status}</Badge>{mail.anon && <Badge tone="warn">匿名</Badge>}<span className="tabular text-[12px] text-ink-3">{when(mail.at)}</span></div>
      <h2 className="mb-1 text-lg font-bold">{mail.subject}</h2>
      <p className="mb-3 text-[12.5px] text-ink-3">送信者：{label(mail.from)} → {mail.toType === "個人" ? nameOf(mail.toId) : mail.toType === "事業部" ? `${mail.toId}（事業部）` : `${mail.toId}窓口`}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-bg p-3 leading-7">{mail.body}</p>
      {mail.thread.length > 0 && <ol className="mt-4 space-y-3 border-l-2 border-line pl-3">{mail.thread.map((t, i) => <li key={i}><div className="text-[12px] text-ink-3"><b className="text-ink">{label(t.by)}</b>・{when(t.at)}</div><p className="whitespace-pre-wrap text-[13.5px] leading-6">{t.body}</p></li>)}</ol>}
      <form className="mt-4 space-y-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; d({ t: "mail-reply", id: mail.id, by: meId, body: body.trim() }); setBody(""); }}>
        <label className="label" htmlFor="rb">返信</label>
        <textarea id="rb" rows={3} maxLength={8000} className="input" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2"><button className="btn btn-primary" disabled={!body.trim()}><Send size={14} />返信する</button>
          {(recipient || mineMsg) && <span className="ml-auto flex items-center gap-1 text-[12.5px]">状態：{MAIL_STATUS.map((st) => <button type="button" key={st} aria-pressed={mail.status === st} className={`rounded-full border px-2.5 py-0.5 ${mail.status === st ? "border-brand bg-brand text-white" : "border-line-strong"}`} onClick={() => mail.status !== st && d({ t: "mail-status", id: mail.id, status: st, by: meId })}>{st}</button>)}</span>}</div>
      </form>
    </div>
  );
}
