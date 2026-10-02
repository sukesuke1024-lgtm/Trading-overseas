"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, Mail, Send } from "lucide-react";
import { logMailSend, useMe, useStore } from "@/lib/store";
import { COMPANY, emailFlyerBlock, esc, flyerHtml, priceLabel } from "@/lib/flyer";
import { loadFlyerSel, downloadText } from "@/lib/flyerSel";
import { downloadCsv } from "@/lib/csv";
import { COUNTRIES, SEGMENTS, flag, isOpen } from "@/lib/constants";
import { addDays, fmtDateTime, todayStr } from "@/lib/dates";
import type { Contact, Lang } from "@/lib/types";
import { Field, PageHeader, Segmented } from "@/components/ui";

const WEBHOOK_KEY = "hlink-crm.mailWebhook";
const TEMPLATES: Record<Lang, { subject: string; body: string }> = {
  ja: { subject: "【H-LINK】日本産食品のご案内（新商品・おすすめ）", body: "{{氏名}} 様\n\nいつもお世話になっております。H-LINK の{{担当}}です。\n\nこのたび、日本の生産者が自信をもってお届けする商品の中から、{{会社名}} 様にご紹介したい商品をまとめました。下記の電子チラシをご覧ください。\n\nサンプルのご依頼・お見積りは、このメールへのご返信で承ります。" },
  en: { subject: "[H-LINK] Selected Japanese food products for {{会社名}}", body: "Dear {{氏名}},\n\nThis is {{担当}} from H-LINK. Thank you for your continued interest.\n\nWe have put together a selection of Japanese products we would like to introduce to {{会社名}}. Please see the flyer below.\n\nSamples and quotations are available on request — simply reply to this email." },
};
const footer = (lang: Lang, name: string, email: string) => lang === "en"
  ? `You are receiving this email because you shared your contact details with H-LINK (e.g. at an exhibition or via an inquiry). If you do not wish to receive further announcements, please reply with "Unsubscribe" and we will stop immediately.\nSender: ${name} / H-LINK / ${email}`
  : `本メールは、名刺交換・お問い合わせ等でご連絡先をいただいた方にお送りしています。今後のご案内が不要な場合は、このメールに「配信停止」とご返信ください。すぐに停止いたします。\n発信者：H-LINK ${name}／${email}`;

/** メール一斉配信：宛先を絞り込み、電子チラシ（商品カタログから）を本文に挿入して、バイヤーに宣伝する */
export default function MailPage() {
  const d = useStore().data!;
  const me = useMe()!;
  const [country, setCountry] = useState(""); const [segment, setSegment] = useState(""); const [state, setState] = useState("all");
  const [mineOnly, setMineOnly] = useState(me.role === "sales"); const [dmOnly, setDmOnly] = useState(false); const [langF, setLangF] = useState<"" | Lang>("");
  const [lang, setLang] = useState<Lang>("en");
  const [subject, setSubject] = useState(TEMPLATES.en.subject); const [body, setBody] = useState(TEMPLATES.en.body);
  const sel0 = useMemo(() => loadFlyerSel(), []);
  const [products, setProducts] = useState<string[]>(() => sel0?.ids ?? d.products.filter((p) => p.active).slice(0, 3).map((p) => p.id));
  const [useFlyer, setUseFlyer] = useState(true); const [showPrice, setShowPrice] = useState(true);
  const [title, setTitle] = useState(sel0?.title ?? "H-LINK 新商品・おすすめ商品のご案内"); const [subtitle, setSubtitle] = useState(sel0?.subtitle ?? "日本産食品をお届けします");
  const [unchecked, setUnchecked] = useState<string[]>([]);
  const [webhook, setWebhook] = useState(() => { try { return localStorage.getItem(WEBHOOK_KEY) ?? ""; } catch { return ""; } });
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pendingVia, setPendingVia] = useState("");


  const orgOf = (id: string) => d.organizations.find((o) => o.id === id);
  const candidates = useMemo(() => d.contacts.filter((c) => {
    const o = orgOf(c.orgId); if (!o) return false;
    if (country && o.country !== country) return false;
    if (segment && o.segment !== segment) return false;
    if (mineOnly && o.ownerId !== me.id) return false;
    if (dmOnly && !c.isDecisionMaker) return false;
    if (langF && c.lang !== langF) return false;
    const deals = d.deals.filter((x) => x.orgId === o.id);
    const open = deals.some((x) => isOpen(x.stage)), won = deals.some((x) => x.stage === "won");
    if (state === "open" && !open) return false;
    if (state === "new" && (open || won)) return false;
    if (state === "won" && !won) return false;
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [d, country, segment, state, mineOnly, dmOnly, langF, me.id]);
  const optOut = candidates.filter((c) => c.optOut), noMail = candidates.filter((c) => !c.optOut && !/^\S+@\S+\.\S+$/.test(c.email));
  const eligible = candidates.filter((c) => !c.optOut && /^\S+@\S+\.\S+$/.test(c.email));
  const targets = eligible.filter((c) => !unchecked.includes(c.id));
  const picked = products.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean);
  const mismatch = targets.filter((c) => c.lang !== lang).length;

  const setLangT = (l: Lang) => { setLang(l); setSubject(TEMPLATES[l].subject); setBody(TEMPLATES[l].body); };
  const fill = (text: string, c?: Contact) => { const o = c ? orgOf(c.orgId) : null; return text.replaceAll("{{氏名}}", c?.name ?? (lang === "en" ? "Sir/Madam" : "ご担当者")).replaceAll("{{会社名}}", o?.name ?? "").replaceAll("{{担当}}", me.name); };
  const flyerOpts = { title, subtitle, validUntil: addDays(todayStr(), 60), contactName: me.name, contactEmail: me.email, lang, showPrice, note: "" };
  const htmlFor = (c?: Contact) => `<div style="font-family:'Hiragino Sans','Noto Sans JP',Meiryo,Arial,sans-serif;font-size:14px;line-height:1.7;color:#17171a;max-width:640px;margin:0 auto">${esc(fill(body, c)).replace(/\n/g, "<br>")}</div>${useFlyer && picked.length ? emailFlyerBlock(picked, flyerOpts) : ""}<div style="font-size:11px;color:#8a8c95;max-width:640px;margin:12px auto;line-height:1.6">${esc(footer(lang, me.name, me.email)).replace(/\n/g, "<br>")}</div>`;
  const textFor = (c?: Contact) => `${fill(body, c)}\n\n${useFlyer ? picked.map((p) => `■ ${lang === "en" ? p.nameEn : p.name}\n  ${lang === "en" ? p.specEn : p.spec}\n  ${showPrice ? priceLabel(p, lang) + " ／ " : ""}MOQ ${p.moq}${p.unit}`).join("\n") + "\n\n" : ""}${footer(lang, me.name, me.email)}`;
  const preview = htmlFor(targets[0]);
  const record = (via: string) => { logMailSend({ subject: fill(subject), count: targets.length, filter: [country, SEGMENTS.find((s) => s.id === segment)?.label, state !== "all" ? state : ""].filter(Boolean).join("・") || "全体", via, flyer: useFlyer && picked.length > 0 }, targets.map((c) => c.id), `宛先 ${targets.length}件に配信（${via}）。チラシ：${picked.map((p) => p.name).join("、") || "なし"}`); setPendingVia(""); setMsg({ tone: "ok", text: `${targets.length}件の配信を記録しました。各顧客の活動履歴（Email）にも自動で残りました。` }); };

  const openMailer = () => {
    const chunks: Contact[][] = []; for (let i = 0; i < targets.length; i += 30) chunks.push(targets.slice(i, i + 30));
    chunks.forEach((ch, i) => setTimeout(() => { window.location.href = `mailto:${encodeURIComponent(me.email)}?bcc=${ch.map((c) => c.email).join(",")}&subject=${encodeURIComponent(fill(subject))}&body=${encodeURIComponent(textFor())}`; }, i * 1200));
    setPendingVia("メールソフト（BCC）"); setMsg({ tone: "warn", text: `メールソフトを開きます（${chunks.length}通・30件ずつBCC）。HTMLのチラシはメールソフトから送れないため、本文には文章版を入れています。見栄えのよいチラシ入りで送る場合は「HTMLをコピー」を使ってください。送信が終わったら「送信した記録を残す」を押してください。` });
  };
  const copyHtml = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([htmlFor()], { type: "text/html" }), "text/plain": new Blob([textFor()], { type: "text/plain" }) })]); setMsg({ tone: "ok", text: "チラシ入りの本文をコピーしました。メールの本文欄に貼り付けてください（Gmail／Outlook）。宛先は「宛先をコピー」から。" }); }
    catch { await navigator.clipboard.writeText(htmlFor()).catch(() => undefined); setMsg({ tone: "warn", text: "HTML のソースをコピーしました（リッチ形式のコピーに未対応のブラウザです）。" }); }
    setPendingVia("HTMLコピー");
  };
  const sendWebhook = async () => {
    if (!webhook) return;
    try {
      const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: me.email, messages: targets.map((c) => ({ to: c.email, name: c.name, subject: fill(subject, c), html: htmlFor(c), text: textFor(c) })) }) });
      if (!res.ok) throw new Error(String(res.status));
      record("配信サービス（Webhook）");
    } catch (e) { setMsg({ tone: "warn", text: `送信に失敗しました（${e instanceof Error ? e.message : "通信エラー"}）。Webhook の URL と配信サービスの設定を確認してください。` }); }
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader title="メール配信・電子チラシ" sub="バイヤーに商品を宣伝します。宛先を絞り込み、商品カタログから選んだ電子チラシを本文に挿入して一斉に送れます。配信停止（オプトアウト）の相手は自動で除外されます。" />
      {msg && <div role="status" className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[12.5px] ${msg.tone === "ok" ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{msg.tone === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}<span>{msg.text}</span></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className="card p-4">
            <h2 className="card-t mb-3">1. 宛先を絞り込む</h2>
            <div className="grid grid-cols-2 gap-2">
              <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">国：すべて</option>{COUNTRIES.filter((c) => c !== "日本").map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}</select>
              <select className="select" value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">区分：すべて</option>{SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              <select className="select" value={state} onChange={(e) => setState(e.target.value)}><option value="all">取引状況：すべて</option><option value="open">進行中の案件あり</option><option value="new">新規開拓（案件なし）</option><option value="won">受注実績あり</option></select>
              <select className="select" value={langF} onChange={(e) => setLangF(e.target.value as "" | Lang)}><option value="">言語：すべて</option><option value="ja">日本語</option><option value="en">英語</option></select>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-ink-2"><label className="flex items-center gap-1.5"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />自分の担当顧客のみ</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={dmOnly} onChange={(e) => setDmOnly(e.target.checked)} />意思決定者のみ</label></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="chip chip-accent">配信対象 {targets.length}件</span>{optOut.length > 0 && <span className="chip chip-warn">配信停止で除外 {optOut.length}件</span>}{noMail.length > 0 && <span className="chip chip-bad">メール不備で除外 {noMail.length}件</span>}</div>
            <ul className="mt-3 max-h-[230px] divide-y divide-line overflow-y-auto rounded-xl ring-1 ring-line">
              {eligible.map((c) => { const o = orgOf(c.orgId); return (
                <li key={c.id}><label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface-2"><input type="checkbox" checked={!unchecked.includes(c.id)} onChange={(e) => setUnchecked((u) => (e.target.checked ? u.filter((x) => x !== c.id) : [...u, c.id]))} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{c.name}<span className="ml-2 text-[11px] font-normal text-ink-3">{c.title}</span></span><span className="block truncate text-[11.5px] text-ink-3">{flag(o?.country ?? "")} {o?.name}・{c.email}</span></span><span className="chip">{c.lang === "en" ? "EN" : "JA"}</span></label></li>); })}
              {eligible.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-3">条件に合う宛先がありません</li>}
            </ul>
            <p className="mt-2 text-[11.5px] text-ink-3">配信停止の管理は「担当者」画面で行います。宛先の許諾（名刺交換・問い合わせ等）が確認できる相手にだけ送ってください。</p>
          </section>

          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between"><h2 className="card-t">2. 本文</h2><Segmented value={lang} onChange={setLangT} options={[{ id: "ja", label: "日本語" }, { id: "en", label: "English" }]} /></div>
            <Field label="件名"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="本文" hint="差し込み：{{氏名}}　{{会社名}}　{{担当}}（送信先ごとに自動で置き換わります）"><textarea className="textarea" rows={9} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            {mismatch > 0 && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">宛先のうち {mismatch}件は、本文と別の言語の担当者です。言語で絞り込んで、別々に送ることをおすすめします。</p>}
          </section>

          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between"><h2 className="card-t">3. 電子チラシ（商品カタログから）</h2><label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={useFlyer} onChange={(e) => setUseFlyer(e.target.checked)} />本文に挿入する</label></div>
            {useFlyer && (<>
              <div className="grid max-h-[180px] grid-cols-2 gap-1.5 overflow-y-auto">{d.products.filter((p) => p.active).map((p) => { const on = products.includes(p.id); return <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ring-1 ${on ? "bg-accent-soft ring-accent-2" : "ring-line hover:bg-surface-2"}`}><input type="checkbox" checked={on} onChange={() => setProducts((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length >= 6 ? s : [...s, p.id]))} /><span className="truncate">{lang === "en" ? p.nameEn : p.name}</span></label>; })}</div>
              <div className="grid grid-cols-2 gap-2"><Field label="チラシのタイトル"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="サブタイトル"><input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field></div>
              <div className="flex flex-wrap items-center gap-3 text-[12.5px]"><label className="flex items-center gap-1.5"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />価格（FOB）を載せる</label><span className="text-ink-3">最大6商品／現在 {picked.length}商品</span><Link href="/catalog/" className="ml-auto text-accent-2 hover:underline">カタログで選ぶ →</Link></div>
            </>)}
          </section>
        </div>

        <div className="min-w-0 space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="card-t">プレビュー</h2><span className="text-[11.5px] text-ink-3">{targets[0] ? `宛先例：${targets[0].name}` : "宛先なし"}</span></div>
            <div className="border-b border-line bg-surface-2 px-4 py-2 text-[12px]"><b>件名：</b>{fill(subject, targets[0])}</div>
            <iframe title="メールのプレビュー" srcDoc={`<body style="margin:0;padding:14px;background:#fff">${preview}</body>`} className="h-[520px] w-full bg-white" />
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="card-t">4. 送る</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn btn-primary !h-10" disabled={targets.length === 0} onClick={openMailer}><Mail size={15} />メールソフトで開く（BCC）</button>
              <button className="btn !h-10" disabled={targets.length === 0} onClick={copyHtml}><ClipboardCopy size={15} />チラシ入り本文をコピー</button>
              <button className="btn" disabled={targets.length === 0} onClick={() => { navigator.clipboard.writeText(targets.map((c) => c.email).join(", ")).then(() => setMsg({ tone: "ok", text: `${targets.length}件の宛先をコピーしました。` })); }}>宛先をコピー</button>
              <button className="btn" disabled={targets.length === 0} onClick={() => downloadCsv("mail-merge.csv", [["email", "name", "company", "language", "subject", "body"], ...targets.map((c) => [c.email, c.name, orgOf(c.orgId)?.name, c.lang, fill(subject, c), textFor(c)])])}><Download size={14} />差し込みCSV</button>
              <button className="btn" disabled={picked.length === 0} onClick={() => downloadText("H-LINK-flyer.html", flyerHtml(picked, flyerOpts))}><Download size={14} />電子チラシ（HTML）</button>
            </div>
            <div className="rounded-xl bg-surface-2 p-3 text-[12px]">
              <div className="mb-1.5 flex items-center gap-1.5 font-bold"><Send size={13} />配信サービスで自動送信（任意）</div>
              <div className="flex gap-2"><input className="input !h-8" placeholder="Webhook の URL（https://…）" value={webhook} onChange={(e) => { setWebhook(e.target.value); try { localStorage.setItem(WEBHOOK_KEY, e.target.value); } catch { /* noop */ } }} /><button className="btn btn-sm" disabled={!/^https:\/\//.test(webhook) || targets.length === 0} onClick={sendWebhook}>送信</button></div>
              <p className="mt-1.5 leading-relaxed text-ink-3">配信サービス（社内のメール送信API等）の URL を設定すると、宛先ごとに差し込み済みの HTML メールを自動送信し、結果を記録します。未設定でも上のボタンで送れます。</p>
            </div>
            {pendingVia && <button className="btn btn-primary w-full" onClick={() => record(pendingVia)}><CheckCircle2 size={15} />送信した記録を残す（{targets.length}件）</button>}
            <p className="text-[11.5px] leading-relaxed text-ink-3">記録すると、配信した相手ごとの「活動履歴（Email）」に自動で残り、Customer 360° のタイムラインで確認できます。</p>
          </section>

          <section className="card overflow-x-auto">
            <div className="card-h"><h2 className="card-t">配信の記録</h2></div>
            <table className="tbl mt-2 min-w-[520px]"><thead><tr><th>日時</th><th>件名</th><th className="text-right">件数</th><th>方法</th><th>送信者</th></tr></thead>
              <tbody>{d.mailLogs.slice(0, 8).map((m) => <tr key={m.id}><td className="num whitespace-nowrap text-ink-2">{fmtDateTime(m.at)}</td><td className="max-w-[220px] truncate">{m.subject}</td><td className="num text-right">{m.count}</td><td className="text-ink-2">{m.via}{m.flyer && <span className="chip chip-accent ml-1">チラシ</span>}</td><td>{d.users.find((u) => u.id === m.userId)?.name}</td></tr>)}
                {d.mailLogs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-xs text-ink-3">まだ配信の記録はありません</td></tr>}</tbody></table>
          </section>
          <p className="px-1 text-[11px] leading-relaxed text-ink-3">{COMPANY.name} の営業メールは、相手の同意・取引関係に基づいて送ってください（特定電子メール法、海外宛ては各国の法令・GDPR 等に注意）。配信停止の依頼には速やかに応じ、「担当者」画面で配信停止にしてください。</p>
        </div>
      </div>
    </div>
  );
}
