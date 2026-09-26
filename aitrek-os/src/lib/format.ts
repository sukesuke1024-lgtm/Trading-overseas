export const yen = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `¥${Math.round(v).toLocaleString("ja-JP")}`;

export const money = (v: number | null | undefined, currency = "JPY") => {
  if (v == null || !isFinite(v)) return "—";
  const digits = ["JPY", "KRW", "VND", "IDR"].includes(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(digits)}`;
  }
};

/** ダッシュボード用の短い円表記 (¥1.2M 等) */
export const yenShort = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e8) return `¥${(v / 1e8).toFixed(2)}億`;
  if (a >= 1e4) return `¥${(v / 1e4).toFixed(a >= 1e6 ? 0 : 1)}万`;
  return yen(v);
};

export const pct = (v: number, digits = 1) => (isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "—");

export const num = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("ja-JP"));

export const today = () => toDateInput(new Date());

export function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string | Date, days: number) {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

/** YYYY-MM-DD 同士の日数差 (b - a) */
export function daysBetween(a: string, b: string) {
  const da = new Date(a.slice(0, 10) + "T00:00:00").getTime();
  const db = new Date(b.slice(0, 10) + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

export const fmtDate = (v: string | null | undefined) => (v ? v.slice(0, 10).replaceAll("-", "/") : "—");

export const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return `${fmtDate(toDateInput(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const relative = (v: string) => {
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}日前`;
  return fmtDate(v);
};

export const monthKey = (v: string) => v.slice(0, 7);
