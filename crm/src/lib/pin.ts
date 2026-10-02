// PIN（4〜8桁の数字）の規則。クライアント（入力時）とサーバー（保存時）の両方で使う。
const COMMON = new Set(["0000", "1234", "4321", "1111", "2222", "3333", "5555", "6666", "7777", "8888", "9999", "0123", "1212", "2580", "1004", "2000", "000000", "123456", "654321", "111111", "121212", "123123", "112233", "159753", "12345678", "87654321", "00000000", "11111111"]);

export const PIN_HINT = "4〜8桁の数字（同じ数字の連続・連番・よくある数字は使えません）";

/** 問題があれば理由を返す。問題なければ null */
export function validatePin(pin: unknown): string | null {
  if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) return "PINは4〜8桁の数字で入力してください。";
  if (COMMON.has(pin) || /^(\d)\1+$/.test(pin)) return "推測されやすいPINです。別の数字にしてください。";
  const d = [...pin].map(Number);
  if (d.every((x, i) => i === 0 || x === d[i - 1] + 1) || d.every((x, i) => i === 0 || x === d[i - 1] - 1)) return "連番のPINは使えません。別の数字にしてください。";
  return null;
}
export const isPinShape = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4,8}$/.test(pin);
