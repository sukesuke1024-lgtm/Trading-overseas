// 制裁リスト等の名前照会。OFAC の SDN リスト（米国財務省が公開）を、毎時の自動更新で取り込んだデータと照合する。
// 「該当なし」は『このデータに載っていない』という意味にすぎない。EU・UN・日本（外為法の資産凍結等）など他のリストは公式サイトで別途確認する。
export interface SdnEntry { n: string; t: string; p: string; id: string } // 名称・種別・プログラム・番号
export interface SdnData { updatedAt: string | null; source: string; count: number; entries: SdnEntry[]; status: "ok" | "empty" | "error"; error?: string }
export interface Match { entry: SdnEntry; score: number; kind: "完全一致" | "ほぼ一致" | "類似" }

const SUFFIX = /\b(co|company|corp|corporation|inc|incorporated|ltd|limited|llc|llp|lp|plc|gmbh|ag|sa|sas|srl|bv|nv|pte|pty|sdn|bhd|pt|tbk|jsc|ooo|oao|zao|fze|fzco|fzc|trading|group|holdings?|international|intl|the)\b/g;
export function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase()
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）/g, " ")
    .replace(/[.,'"’`´()（）\[\]{}\-_/\\&+:;!?]/g, " ")
    .replace(SUFFIX, " ")
    .replace(/\s+/g, " ").trim();
}
const tokens = (s: string) => new Set(normalize(s).split(" ").filter((t) => t.length > 1));

export function lev(a: string, b: string): number {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export const similarity = (a: string, b: string) => { const m = Math.max(a.length, b.length); return m ? 1 - lev(a, b) / m : 1; };

/** 名称の照合。完全一致／トークン一致（語順違い・社名の省略）／文字の類似（綴り違い）を検出 */
export function screen(name: string, entries: SdnEntry[], limit = 12): Match[] {
  const q = normalize(name);
  if (q.length < 3) return [];
  const qt = tokens(name);
  const out: Match[] = [];
  for (const e of entries) {
    const n = normalize(e.n);
    if (!n) continue;
    let score = 0; let kind: Match["kind"] | null = null;
    if (n === q) { score = 100; kind = "完全一致"; }
    else {
      const et = tokens(e.n);
      let inter = 0; qt.forEach((t) => { if (et.has(t)) inter++; });
      const jac = qt.size && et.size ? inter / (qt.size + et.size - inter) : 0;
      const contain = qt.size >= 2 && inter === qt.size; // 入力の全トークンを含む
      const sim = Math.abs(n.length - q.length) <= 6 ? similarity(n, q) : 0;
      if (jac >= 0.75 || (contain && et.size <= qt.size + 1)) { score = Math.round(Math.max(jac, 0.8) * 100); kind = "ほぼ一致"; }
      else if (sim >= 0.86) { score = Math.round(sim * 100); kind = "類似"; }
    }
    if (kind) out.push({ entry: e, score, kind });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
