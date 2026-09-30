// 同時反映用の通知バス（Server-Sent Events）。データ本体は流さず「変更があった」ことだけを全接続端末へ知らせる。
type Sub = { uid: string; send: (msg: string) => void };
const g = globalThis as unknown as { __miraiBus?: Set<Sub> };
const subs = (g.__miraiBus ??= new Set<Sub>());

export function subscribe(uid: string, send: (msg: string) => void) {
  const s = { uid, send }; subs.add(s);
  return () => { subs.delete(s); };
}
export function notify() { for (const s of subs) { try { s.send("changed"); } catch { subs.delete(s); } } }
