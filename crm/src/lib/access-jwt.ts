// Cloudflare Access が付与する JWT（Cf-Access-Jwt-Assertion）の検証。RS256 / 発行者・対象(aud)・期限を確認する。
// ヘッダのメール（Cf-Access-Authenticated-User-Email）は信用せず、署名つき JWT の email だけを使う。
import crypto from "node:crypto";

export type AccessCfg = { team: string; aud: string }; // team 例: example.cloudflareaccess.com
export type Jwk = { kid: string; kty: string; n: string; e: string };

export const accessCfg = (env: Record<string, string | undefined> = process.env): AccessCfg | null => {
  const team = env.ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""), aud = env.ACCESS_AUD?.trim();
  return team && aud ? { team, aud } : null;
};

/** 検証に成功したときはメール（小文字）、失敗は null */
export function verifyAccessJwt(token: string | undefined | null, cfg: AccessCfg, keys: Jwk[], nowSec = Math.floor(Date.now() / 1000)): string | null {
  try {
    const [h, p, s] = (token ?? "").split(".");
    if (!h || !p || !s) return null;
    const head = JSON.parse(Buffer.from(h, "base64url").toString()) as { alg?: string; kid?: string };
    if (head.alg !== "RS256") return null;
    const jwk = keys.find((k) => k.kid === head.kid && k.kty === "RSA");
    if (!jwk) return null;
    const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
    if (!ok) return null;
    const c = JSON.parse(Buffer.from(p, "base64url").toString()) as { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };
    if (c.iss !== `https://${cfg.team}`) return null;
    if (!(Array.isArray(c.aud) ? c.aud : [c.aud]).includes(cfg.aud)) return null;
    if (!c.exp || c.exp <= nowSec || (c.nbf && c.nbf > nowSec + 60)) return null;
    return typeof c.email === "string" && c.email.includes("@") ? c.email.trim().toLowerCase() : null;
  } catch { return null; }
}

let cache: { at: number; keys: Jwk[] } | null = null;
/** 公開鍵（JWKS）。10分キャッシュ。取得に失敗したら古いキャッシュを使い、無ければ空 */
export async function fetchAccessKeys(cfg: AccessCfg): Promise<Jwk[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.keys;
  try {
    const r = await fetch(`https://${cfg.team}/cdn-cgi/access/certs`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const d = (await r.json()) as { keys?: Jwk[] };
    if (d.keys?.length) { cache = { at: Date.now(), keys: d.keys }; return d.keys; }
  } catch { /* 取得失敗 */ }
  return cache?.keys ?? [];
}
