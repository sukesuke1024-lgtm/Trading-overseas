import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { accessCfg, verifyAccessJwt, type Jwk } from "../src/lib/access-jwt.ts";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: "jwk" }) as { kty: string; n: string; e: string }), kid: "k1" } as Jwk;
const cfg = { team: "acme.cloudflareaccess.com", aud: "AUD123" };
const NOW = 1_800_000_000;
const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function mint(claims: object, header: object = { alg: "RS256", kid: "k1" }, key = privateKey) {
  const body = `${b(header)}.${b(claims)}`;
  return `${body}.${crypto.sign("RSA-SHA256", Buffer.from(body), key).toString("base64url")}`;
}
const good = { iss: `https://${cfg.team}`, aud: ["AUD123"], exp: NOW + 600, email: "Taro@Example.co.jp" };

test("正しい JWT はメール（小文字）を返す", () => assert.equal(verifyAccessJwt(mint(good), cfg, [jwk], NOW), "taro@example.co.jp"));
test("期限切れ・aud違い・iss違いは拒否", () => {
  assert.equal(verifyAccessJwt(mint({ ...good, exp: NOW - 1 }), cfg, [jwk], NOW), null);
  assert.equal(verifyAccessJwt(mint({ ...good, aud: ["OTHER"] }), cfg, [jwk], NOW), null);
  assert.equal(verifyAccessJwt(mint({ ...good, iss: "https://evil.example" }), cfg, [jwk], NOW), null);
});
test("別の鍵の署名・alg=none・改ざんは拒否", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(verifyAccessJwt(mint(good, undefined, other), cfg, [jwk], NOW), null);
  assert.equal(verifyAccessJwt(`${b({ alg: "none", kid: "k1" })}.${b(good)}.`, cfg, [jwk], NOW), null);
  const t = mint(good).split("."); t[1] = b({ ...good, email: "boss@example.co.jp" });
  assert.equal(verifyAccessJwt(t.join("."), cfg, [jwk], NOW), null);
  assert.equal(verifyAccessJwt("", cfg, [jwk], NOW), null);
});
test("設定は ACCESS_TEAM_DOMAIN と ACCESS_AUD の両方があるときだけ有効", () => {
  assert.equal(accessCfg({ ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com" }), null);
  assert.deepEqual(accessCfg({ ACCESS_TEAM_DOMAIN: "https://x.cloudflareaccess.com/", ACCESS_AUD: "a" }), { team: "x.cloudflareaccess.com", aud: "a" });
});
