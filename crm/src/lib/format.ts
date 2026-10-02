import type { Currency } from "./types";

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
/** 大きな金額を万円／億円で短縮表示 */
export function yenShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `¥${(n / 1e8).toFixed(1).replace(/\.0$/, "")}億`;
  if (a >= 1e4) return `¥${Math.round(n / 1e4).toLocaleString("ja-JP")}万`;
  return yen(n);
}
const SYM: Record<Currency, string> = { JPY: "¥", USD: "US$", SGD: "S$", HKD: "HK$", EUR: "€", AUD: "A$", THB: "฿" };
export const money = (n: number, c: Currency) => `${SYM[c]}${Math.round(n).toLocaleString("en-US")}`;
export const initials = (name: string) => name.replace(/\s+/g, "").slice(0, 1);
