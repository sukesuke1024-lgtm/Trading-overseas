// 為替レートの取得と、為替予約（フォワード）レートの目安計算。
// 現在レートは欧州中央銀行（ECB）の参考レートを frankfurter.app から取得（営業日1回の更新）。取得できない場合は参考値で表示する。
// 銀行が実際に適用する TTS/TTB/TTM（電信売相場／買相場／仲値）は銀行ごとに異なる。ここでは TTM ± スプレッドの目安。
import type { Currency } from "./types.ts";

export const FX_CURRENCIES: Currency[] = ["USD", "SGD", "HKD", "EUR", "AUD", "THB"];
/** 取得できないときの参考値（円／外貨 1） */
export const FALLBACK_RATES: Record<Currency, number> = { JPY: 1, USD: 152, SGD: 113, HKD: 19.5, EUR: 165, AUD: 99, THB: 4.3 };
/** 銀行の TTS/TTB と TTM の差（円）。通貨ごとの目安 */
export const SPREAD_YEN: Record<Currency, number> = { JPY: 0, USD: 1, SGD: 0.5, HKD: 0.15, EUR: 1.5, AUD: 1, THB: 0.05 };
/** 政策金利などの目安（年率%）。為替予約レートの試算にだけ使う。実際の予約レートは取引銀行の提示に従う */
export const DEFAULT_INTEREST: Record<Currency, number> = { JPY: 0.5, USD: 4.0, SGD: 3.0, HKD: 4.0, EUR: 2.0, AUD: 3.8, THB: 2.0 };

export interface RateSnapshot { rates: Record<Currency, number>; asOf: string; source: "live" | "cache" | "fallback"; fetchedAt: number }

const KEY = "hlink-crm.fx.v1";
const TTL = 60 * 60 * 1000;

function readCache(): RateSnapshot | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as RateSnapshot) : null; } catch { return null; }
}
export function cachedSnapshot(): RateSnapshot {
  const c = typeof localStorage === "undefined" ? null : readCache();
  return c ?? { rates: FALLBACK_RATES, asOf: "—", source: "fallback", fetchedAt: 0 };
}
/** 同期的に取れる現在レート（キャッシュ→参考値の順）。売上計上など、待てない処理で使う */
export const rateNow = (c: Currency) => cachedSnapshot().rates[c] ?? FALLBACK_RATES[c];

export async function fetchRates(force = false): Promise<RateSnapshot> {
  const c = typeof localStorage === "undefined" ? null : readCache();
  if (!force && c && Date.now() - c.fetchedAt < TTL && c.source === "live") return { ...c, source: "cache" };
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=JPY&to=${FX_CURRENCIES.join(",")}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { date: string; rates: Record<string, number> };
    const rates = { ...FALLBACK_RATES };
    for (const cur of FX_CURRENCIES) if (j.rates[cur]) rates[cur] = Math.round((1 / j.rates[cur]) * 1000) / 1000;
    const snap: RateSnapshot = { rates, asOf: j.date, source: "live", fetchedAt: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* 保存不可でも表示は続ける */ }
    return snap;
  } catch {
    return c ?? { rates: FALLBACK_RATES, asOf: "—", source: "fallback", fetchedAt: 0 };
  }
}

export interface HistPoint { date: string; rate: number }
export async function fetchHistory(cur: Currency, days = 60): Promise<HistPoint[]> {
  if (cur === "JPY") return [];
  const end = new Date(), start = new Date(Date.now() - days * 86400000);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const res = await fetch(`https://api.frankfurter.app/${f(start)}..${f(end)}?from=JPY&to=${cur}`);
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { rates: Record<string, Record<string, number>> };
    return Object.entries(j.rates).map(([date, v]) => ({ date, rate: Math.round((1 / v[cur]) * 1000) / 1000 })).sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}

/** 銀行の対顧客レートの目安：TTM（仲値）、TTS（円→外貨を売るとき＝輸入側）、TTB（外貨→円に買い取るとき＝輸出の入金側） */
export const bankRates = (ttm: number, c: Currency) => ({ ttm, tts: ttm + SPREAD_YEN[c], ttb: Math.max(ttm - SPREAD_YEN[c], 0) });

/** 為替予約（外貨を売って円を買う）のレート目安 = 直物 × (1 + 円金利×t) ÷ (1 + 外貨金利×t)。金利が外貨のほうが高いと、先物は円高方向（予約レートが低い）になる */
export function forwardEstimate(spot: number, days: number, jpyRate: number, fxRate: number) {
  const t = days / 365;
  const fwd = (spot * (1 + (jpyRate / 100) * t)) / (1 + (fxRate / 100) * t);
  return { rate: Math.round(fwd * 1000) / 1000, points: Math.round((fwd - spot) * 1000) / 1000 };
}

/** 予約の評価損益（円）：外貨を売る予約なので、現在レート（TTM）が予約レートより円安なら予約が有利＝評価益（反対取引で比較） */
export const forwardMtm = (amount: number, contractRate: number, spotNow: number) => Math.round((contractRate - spotNow) * amount);
