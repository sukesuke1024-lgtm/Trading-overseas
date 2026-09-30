// 改ざん検知つき追記型ログ（ハッシュチェーン）。各行が直前行のハッシュを含むため、
// 過去の行を書き換える・削除する・順序を入れ替えると検証で必ず不一致になる。
import { sha256 } from "./sha256.ts";

export const GENESIS = "0".repeat(64);
export type Chained = { seq: number; prev: string; hash: string };

export function hashOf(prev: string, payload: unknown) {
  return sha256(prev + JSON.stringify(payload));
}

/** 追記（古い順の配列に対して）。payload は seq/prev/hash を除く本体 */
export function append<T extends object>(list: (T & Chained)[], payload: T): (T & Chained)[] {
  const last = list[list.length - 1];
  const seq = last ? last.seq + 1 : 1;
  const prev = last ? last.hash : GENESIS;
  return [...list, { ...payload, seq, prev, hash: hashOf(prev, { ...payload, seq }) }];
}

export type Verify = { ok: boolean; count: number; brokenAt?: number; reason?: string };

export function verifyChain<T extends object>(list: (T & Chained)[]): Verify {
  let prev = GENESIS;
  for (let i = 0; i < list.length; i++) {
    const { prev: p, hash, ...rest } = list[i] as T & Chained;
    if (p !== prev) return { ok: false, count: list.length, brokenAt: i + 1, reason: "前後の連鎖が一致しません（行の削除・挿入の疑い）" };
    if (rest.seq !== i + 1) return { ok: false, count: list.length, brokenAt: i + 1, reason: "連番が不連続です" };
    if (hashOf(p, rest) !== hash) return { ok: false, count: list.length, brokenAt: i + 1, reason: "内容とハッシュが一致しません（改ざんの疑い）" };
    prev = hash;
  }
  return { ok: true, count: list.length };
}
