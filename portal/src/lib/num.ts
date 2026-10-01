/** 数字を3桁ごとにカンマで区切る（小数点以下はそのまま）。"1234567.5" → "1,234,567.5"。数字以外は除く */
export function fmtNum(raw: string | number | undefined | null): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).replace(/[^0-9.\-]/g, "");
  const neg = s.startsWith("-") ? "-" : "";
  const [i, ...rest] = s.replace(/-/g, "").split(".");
  const dec = rest.length ? `.${rest.join("")}` : "";
  return `${neg}${(i || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec}`;
}
/** カンマ付きの文字列から、計算に使える数値を取り出す（空欄は null） */
export function parseNum(s: string): number | null {
  const t = s.replace(/[,\s円¥]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
/** 入力途中の文字列を「数字と小数点だけ」にそろえる（先頭の余分な0も除く） */
export function cleanNum(raw: string, decimals: boolean): string {
  let r = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9.]/g, "");
  if (!decimals) r = r.replace(/\./g, "");
  else { const i = r.indexOf("."); if (i >= 0) r = r.slice(0, i + 1) + r.slice(i + 1).replace(/\./g, ""); }
  return r.replace(/^0+(?=\d)/, "");
}
