"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { addForward, deleteForward, updateForward, useMe, useStore } from "@/lib/store";
import { DEFAULT_INTEREST, FALLBACK_RATES, FX_CURRENCIES, bankRates, fetchHistory, forwardEstimate, forwardMtm, type HistPoint, type RateSnapshot } from "@/lib/fx";
import { useLiveRates } from "@/lib/useLiveRates";
import { useNow } from "@/lib/useNow";
import type { Currency, Deal } from "@/lib/types";
import { isOpen } from "@/lib/constants";
import { diffFromToday, fmtDate, todayStr, addDays } from "@/lib/dates";
import { money, yen, yenShort } from "@/lib/format";
import { permsFor } from "@/lib/selectors";
import { Drawer, Field, PageHeader } from "@/components/ui";

const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

export default function Fx() {
  const d = useStore().data!;
  const perms = permsFor(useMe());
  const live = useLiveRates();
  const [cur, setCur] = useState<Currency>("USD");
  const [hist, setHist] = useState<HistPoint[]>([]);
  const [adding, setAdding] = useState(false);
  const snap: RateSnapshot = live.tick ? { rates: live.tick.rates, asOf: live.tick.asOf ?? "—", source: live.tick.source === "fallback" ? "fallback" : "live", fetchedAt: live.tick.fetchedAt } : { rates: FALLBACK_RATES, asOf: "—", source: "fallback", fetchedAt: 0 };
  useEffect(() => { let on = true; fetchHistory(cur, 60).then((h) => { if (on) setHist(h); }); return () => { on = false; }; }, [cur]);

  const spot = snap.rates[cur];
  const open = d.forwards.filter((f) => f.status === "open").sort((a, b) => a.settleDate.localeCompare(b.settleDate));
  const done = d.forwards.filter((f) => f.status === "settled");

  // 要予約：進行中の外貨建て案件のうち、予約でカバーされていない金額
  const cover = useMemo(() => d.deals.filter((x) => isOpen(x.stage) && x.currency !== "JPY").map((x) => {
    const covered = d.forwards.filter((f) => f.status === "open" && f.dealId === x.id && f.currency === x.currency).reduce((a, f) => a + f.amount, 0);
    return { x, covered, pct: Math.min(100, Math.round((covered / Math.max(x.amount, 1)) * 100)), gap: Math.max(x.amount - covered, 0) };
  }).sort((a, b) => b.gap * (b.x.probability) - a.gap * (a.x.probability)), [d]);

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="為替レートと為替予約" sub="現在のレート、銀行レートの目安、予約レートの試算、予約の登録と評価損益。レートは参考値です（実際の取引は取引銀行の提示に従います）。"
        actions={<button className="btn" onClick={() => live.pull()} disabled={live.loading}><RefreshCw size={14} className={live.loading ? "animate-spin" : ""} />今すぐ更新</button>} />

      <LiveBar live={live} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <section className="card overflow-x-auto">
          <div className="card-h"><h2 className="card-t">現在のレート（円／外貨）</h2></div>
          <table className="tbl mt-2 min-w-[480px]"><thead><tr><th>通貨</th><th className="text-right">TTM（仲値）</th><th className="text-right" title="直前の取得からの変化">変化</th><th className="text-right" title="円→外貨（銀行が外貨を売る）">TTS</th><th className="text-right" title="外貨→円（銀行が外貨を買う。輸出の入金）">TTB</th></tr></thead>
            <tbody>{FX_CURRENCIES.map((c) => { const b = bankRates(snap.rates[c], c); return (
              <tr key={c} className={`cursor-pointer ${c === cur ? "bg-accent-soft" : ""}`} onClick={() => setCur(c)}><td className="font-semibold">{c}</td><td className="num text-right font-semibold">{snap.rates[c].toFixed(2)}</td><td className={`num text-right text-[12px] ${live.change(c) > 0 ? "text-good" : live.change(c) < 0 ? "text-bad" : "text-ink-3"}`}>{live.change(c) === 0 ? "—" : `${live.change(c) > 0 ? "▲" : "▼"} ${Math.abs(live.change(c)).toFixed(3)}`}</td><td className="num text-right text-ink-2">{b.tts.toFixed(2)}</td><td className="num text-right text-ink-2">{b.ttb.toFixed(2)}</td></tr>); })}</tbody></table>
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-3">TTS／TTB は銀行が顧客に適用するレートの目安（TTM ± スプレッド）。輸出代金（外貨）を円に替えるときは TTB が適用され、仲値より少し不利になります。</p>
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="card-t">{cur}／JPY の推移（60日）</h2><select className="select !h-8 !w-auto" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>{FX_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <Spark pts={hist} />
          <ForwardEstimator key={cur} cur={cur} spot={spot} />
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="card overflow-x-auto">
          <div className="card-h"><h2 className="card-t">為替予約（フォワード）</h2>{perms.isManager && <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>予約を登録</button>}</div>
          <table className="tbl mt-2 min-w-[900px]"><thead><tr><th>通貨・金額</th><th className="text-right">予約レート</th><th>決済日</th><th>案件</th><th className="text-right" title="現在の仲値との比較。プラス＝予約が有利">評価損益</th><th>銀行</th><th /></tr></thead>
            <tbody>
              {open.map((f) => { const days = diffFromToday(f.settleDate); const mtm = forwardMtm(f.amount, f.rate, snap.rates[f.currency]); const deal = d.deals.find((x) => x.id === f.dealId); return (
                <tr key={f.id}>
                  <td className="num font-semibold">{money(f.amount, f.currency)}</td><td className="num text-right">{f.rate.toFixed(2)}</td>
                  <td className="whitespace-nowrap">{fmtDate(f.settleDate, true)} <span className={`chip ml-1 ${days <= 7 ? "chip-bad" : days <= 30 ? "chip-warn" : ""}`}>{days < 0 ? `${-days}日超過` : days === 0 ? "今日" : `あと${days}日`}</span></td>
                  <td className="max-w-[220px] truncate">{deal ? <Link className="link !font-medium" href={`/deals/view/?id=${deal.id}`}>{deal.name}</Link> : <span className="text-ink-3">—</span>}</td>
                  <td className={`num text-right font-semibold ${mtm >= 0 ? "text-good" : "text-bad"}`}>{mtm >= 0 ? "+" : ""}{yen(mtm)}</td><td className="whitespace-nowrap text-ink-2">{f.bank}</td>
                  <td className="whitespace-nowrap text-right">{perms.isManager && <><button className="btn btn-sm" onClick={() => updateForward(f.id, { status: "settled" })}>決済済みにする</button> <button className="btn btn-ghost btn-sm btn-danger" aria-label="削除" onClick={() => confirm("この予約を削除しますか？") && deleteForward(f.id)}><Trash2 size={13} /></button></>}</td>
                </tr>); })}
              {open.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ink-3">有効な為替予約はありません</td></tr>}
            </tbody></table>
          {done.length > 0 && <details className="border-t border-line px-4 py-2.5 text-[12px] text-ink-2"><summary className="cursor-pointer">決済済み {done.length}件</summary><ul className="mt-1.5 space-y-1">{done.map((f) => <li key={f.id} className="num">{money(f.amount, f.currency)} @ {f.rate.toFixed(2)}（{fmtDate(f.settleDate, true)}）{f.note}</li>)}</ul></details>}
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">評価損益は、現在の仲値で同額を円に替えた場合との差（参考）。予約は外貨を売って円を受け取る取引です。</p>
        </section>

        <section className="card p-4">
          <h2 className="card-t mb-1">予約のカバー状況（進行中の外貨建て案件）</h2>
          <p className="mb-3 text-[11.5px] text-ink-3">未予約の金額が大きく、確度の高い案件ほど上に表示します。</p>
          <ul className="space-y-3">
            {cover.map(({ x, pct, gap }: { x: Deal; pct: number; gap: number }) => (
              <li key={x.id}>
                <div className="flex items-start justify-between gap-2"><Link href={`/deals/view/?id=${x.id}`} className="link line-clamp-1 !text-[12.5px]">{x.name}</Link><span className="num text-[11.5px] text-ink-3">{x.currency} {x.amount.toLocaleString()}</span></div>
                <div className="mt-1 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-[var(--accent-2)]" style={{ width: `${pct}%` }} /></div><span className="num w-10 text-right text-[11.5px] font-semibold">{pct}%</span></div>
                {gap > 0 && x.probability >= 50 && <p className="mt-1 flex items-center gap-1 text-[11px] text-warn"><AlertTriangle size={11} />確度{x.probability}%・未予約 {money(gap, x.currency)}（≈{yenShort(gap * snap.rates[x.currency])}）— 予約を検討</p>}
              </li>
            ))}
            {cover.length === 0 && <li className="text-[12.5px] text-ink-3">進行中の外貨建て案件はありません。</li>}
          </ul>
        </section>
      </div>
      {adding && <ForwardDrawer d={d} snap={snap} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Spark({ pts }: { pts: HistPoint[] }) {
  if (pts.length < 2) return <div className="grid h-[120px] place-items-center rounded-xl bg-surface-2 text-xs text-ink-3">推移を取得できませんでした（オフラインの可能性）</div>;
  const w = 520, h = 120, pad = 8;
  const min = Math.min(...pts.map((p) => p.rate)), max = Math.max(...pts.map((p) => p.rate)), span = max - min || 1;
  const xy = pts.map((p, i) => [pad + (i / (pts.length - 1)) * (w - pad * 2), h - pad - ((p.rate - min) / span) * (h - pad * 2)]);
  const last = pts[pts.length - 1], first = pts[0];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full rounded-xl bg-surface-2" role="img" aria-label="為替レートの推移">
        <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="#c8102e" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="3.5" fill="#c8102e" />
      </svg>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-3 num"><span>{first.date} {first.rate.toFixed(2)}</span><span>最高 {max.toFixed(2)}／最低 {min.toFixed(2)}</span><span>{last.date} <b className="text-ink">{last.rate.toFixed(2)}</b></span></div>
    </div>
  );
}

function ForwardEstimator({ cur, spot }: { cur: Currency; spot: number }) {
  const [days, setDays] = useState("90");
  const [jpy, setJpy] = useState(String(DEFAULT_INTEREST.JPY));
  const [fx, setFx] = useState(String(DEFAULT_INTEREST[cur]));
  const r = forwardEstimate(spot, num(days), num(jpy), num(fx));
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
      <h3 className="mb-2 text-[12.5px] font-bold">為替予約レートの試算（目安）</h3>
      <div className="grid grid-cols-3 gap-2"><Field label="予約期間（日）"><input className="input num" value={days} onChange={(e) => setDays(e.target.value)} /></Field><Field label="円の金利（%）"><input className="input num" value={jpy} onChange={(e) => setJpy(e.target.value)} /></Field><Field label={`${cur}の金利（%）`}><input className="input num" value={fx} onChange={(e) => setFx(e.target.value)} /></Field></div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"><span className="text-[12px] text-ink-2">直物 <b className="num">{spot.toFixed(2)}</b></span><span className="text-[12px] text-ink-2">→ 予約レート（目安）</span><span className="num text-[24px] font-bold">{r.rate.toFixed(2)}</span><span className={`num text-[12px] ${r.points < 0 ? "text-bad" : "text-good"}`}>{r.points >= 0 ? "+" : ""}{r.points.toFixed(2)}円</span></div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">外貨の金利が円より高いと、先の予約レートは直物より円高（数字が小さい）になります。金利は目安の入力値で、実際の予約レートは取引銀行の提示に従ってください。</p>
    </div>
  );
}

function ForwardDrawer({ d, snap, onClose }: { d: ReturnType<typeof useStore>["data"] & object; snap: RateSnapshot; onClose: () => void }) {
  const [cur, setCur] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [settle, setSettle] = useState(addDays(todayStr(), 60));
  const [bank, setBank] = useState("取引銀行A");
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");
  const deals = d.deals.filter((x) => isOpen(x.stage) && x.currency === cur);
  const ok = num(amount) > 0 && num(rate) > 0;
  return (
    <Drawer open onClose={onClose} title="為替予約を登録" footer={<><button className="btn" onClick={onClose}>キャンセル</button><button className="btn btn-primary" disabled={!ok} onClick={() => { addForward({ bank, currency: cur, amount: num(amount), rate: num(rate), tradeDate: todayStr(), settleDate: settle, dealId: dealId || null, note }); onClose(); }}>登録する</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[100px_1fr] gap-3"><Field label="通貨"><select className="select" value={cur} onChange={(e) => { setCur(e.target.value as Currency); setDealId(""); }}>{FX_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="金額（外貨）"><input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field></div>
        <Field label="予約レート（円）" hint={`参考：現在の仲値 ${snap.rates[cur].toFixed(2)}`}><input className="input num" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="決済（受渡）日"><input type="date" className="input" value={settle} onChange={(e) => setSettle(e.target.value)} /></Field>
        <Field label="銀行"><input className="input" value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
        <Field label="対象の案件"><select className="select" value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">（紐づけない）</option>{deals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="メモ"><textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}


function LiveBar({ live }: { live: ReturnType<typeof useLiveRates> }) {
  const t = live.tick;
  const [open, setOpen] = useState(false);
  const now = useNow();
  const rt = !!t?.realtime;
  const bad = !t || t.source === "fallback";
  const asOfAgeH = t?.asOf ? (now - Date.parse(t.asOf.length === 10 ? t.asOf + "T00:00:00Z" : t.asOf)) / 3600000 : null;
  return (
    <section className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] ${bad ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 font-bold ${bad ? "" : rt ? "text-good" : "text-ink"}`}><i className={`h-2 w-2 rounded-full ${bad ? "bg-warn" : rt ? "animate-pulse bg-good" : "bg-ink-3"}`} />{bad ? "取得できません（参考値を表示）" : rt ? "LIVE（リアルタイム）" : "自動更新中（提供元は日次）"}</span>
        {t && <><span>提供元：<b>{t.sourceLabel}</b></span><span>提供元の更新：<b>{t.asOf ? (t.asOf.length === 10 ? t.asOf : new Date(t.asOf).toLocaleString("ja-JP")) : "—"}</b></span><span className="num">最終取得：{new Date(t.fetchedAt).toLocaleTimeString("ja-JP")}（{live.secondsAgo}秒前）</span></>}
        <button className="ml-auto text-accent-2 hover:underline" onClick={() => setOpen((v) => !v)}>{open ? "閉じる" : "リアルタイム提供元の設定"}</button>
      </div>
      {!rt && !bad && <p className="mt-1.5 text-[11.5px] leading-relaxed">無料で公開されている為替データは<b>1日1回</b>の更新です{asOfAgeH !== null && asOfAgeH > 36 ? "（最終更新から1日以上たっています）" : ""}。秒〜分単位のリアルタイムにするには、為替データ提供会社の API キーが必要です（下の設定）。サーバー側では毎時、最新のスナップショットも保存しています。</p>}
      {open && <LiveConfigForm live={live} />}
    </section>
  );
}
function LiveConfigForm({ live }: { live: ReturnType<typeof useLiveRates> }) {
  const [key, setKey] = useState(live.cfg.apiKey);
  const [provider, setProvider] = useState(live.cfg.provider);
  const [sec, setSec] = useState(String(live.cfg.intervalSec));
  return (
    <div className="mt-3 rounded-xl bg-surface p-3.5 text-ink">
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_120px_auto]">
        <Field label="提供元"><select className="select" value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}><option value="none">無料（日次更新）</option><option value="twelvedata">Twelve Data（リアルタイム・要APIキー）</option></select></Field>
        <Field label="API キー"><input className="input" type="password" autoComplete="off" disabled={provider === "none"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Twelve Data の API キー" /></Field>
        <Field label="更新間隔（秒）"><input className="input num" value={sec} onChange={(e) => setSec(e.target.value.replace(/\D/g, ""))} /></Field>
        <div className="flex items-end"><button className="btn btn-primary" onClick={() => live.setCfg({ provider, apiKey: key.trim(), intervalSec: Math.max(15, Number(sec) || 60) })}>保存して取得</button></div>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">API キーは<b>この端末のブラウザにだけ</b>保存されます（共有のパソコンでは入れないでください）。本番では、サーバー側で管理し、全員が同じリアルタイムのレートを見られるようにします。無料プランには回数の上限があるため、更新間隔は 60 秒以上をおすすめします。提供元と契約内容は、利用規約に従ってください。</p>
    </div>
  );
}
