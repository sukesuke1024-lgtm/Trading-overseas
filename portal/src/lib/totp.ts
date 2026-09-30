// RFC 6238 TOTP（SHA-1 / 6桁 / 30秒）。Google Authenticator・Microsoft Authenticator 等と互換。
// Web Crypto を使うためブラウザ（https）でも Node でも動作する。

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function newSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function hotp(secret: string, counter: number) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(counter));
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const o = h[19] & 15;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export const totp = (secret: string, t = Date.now()) => hotp(secret, Math.floor(t / 30000));

/** 前後1ステップ（±30秒）の時計ずれを許容 */
export async function verifyTotp(secret: string, code: string, t = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const c = Math.floor(t / 30000);
  let ok = false;
  for (const d of [-1, 0, 1]) if ((await hotp(secret, c + d)) === code) ok = true; // 定数回実行
  return ok;
}

export const otpauthUri = (account: string, secret: string, issuer = "Mirai Portal") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
