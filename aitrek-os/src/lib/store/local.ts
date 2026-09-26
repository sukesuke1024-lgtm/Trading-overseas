import type { Adapter, Snapshot } from "./adapter";
import { emptyDb } from "./adapter";

const KEY = "aitrek-os:v1";
const MAX_INLINE_FILE = 700 * 1024;

/** Supabase 未設定時のデモ・単独利用向け。データはこのブラウザの localStorage に保存される。 */
export function createLocalAdapter(): Adapter {
  const save = (snap: Snapshot) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(snap));
    } catch (e) {
      console.error("localStorage への保存に失敗しました", e);
      throw new Error("ブラウザの保存容量を超えました。大きな添付ファイルを削除してください。");
    }
  };

  return {
    mode: "local",
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Snapshot;
        return { settings: parsed.settings, db: { ...emptyDb(), ...parsed.db } };
      } catch {
        return null;
      }
    },
    async apply(_ops, next) {
      save(next);
    },
    async saveSettings(_settings, next) {
      save(next);
    },
    async upload(file) {
      if (file.size > MAX_INLINE_FILE) {
        throw new Error("ローカルモードでは 700KB 以下のファイルのみ添付できます（Supabase 接続時は制限なし）。");
      }
      const url = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      return { name: file.name, url, size: file.size };
    },
    async reset() {
      localStorage.removeItem(KEY);
    },
  };
}
