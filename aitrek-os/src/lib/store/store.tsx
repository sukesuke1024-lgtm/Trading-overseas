"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Adapter, Snapshot } from "./adapter";
import { emptyDb } from "./adapter";
import { createLocalAdapter } from "./local";
import { createSupabaseAdapter, getSupabase, supabaseConfigured } from "./supabase";
import { Tx } from "./tx";
import { buildSeed, defaultSettings } from "../seed";
import { can, denyMessage, type Action } from "../permissions";
import type { Attachment, CompanySettings, Database, Member } from "../types";

interface Toast {
  id: number;
  kind: "ok" | "error";
  text: string;
}

interface StoreValue {
  ready: boolean;
  mode: Adapter["mode"];
  db: Database;
  settings: CompanySettings;
  me: Member | null;
  session: Session | null;
  /** 1 トランザクションで変更を適用する。戻り値は fn の戻り値 */
  run: <R>(fn: (tx: Tx) => R, opts?: { need?: Action; ok?: string }) => R | undefined;
  saveSettings: (s: CompanySettings) => void;
  upload: (file: File) => Promise<Attachment | null>;
  can: (a: Action) => boolean;
  setMe: (id: string) => void;
  resetDemo: (withSeed: boolean) => Promise<void>;
  importSnapshot: (snap: Snapshot) => Promise<void>;
  toast: (text: string, kind?: Toast["kind"]) => void;
  toasts: Toast[];
  signOut: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);
const ME_KEY = "aitrek-os:me";

export function StoreProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo<Adapter>(() => (supabaseConfigured ? createSupabaseAdapter() : createLocalAdapter()), []);
  const [snap, setSnap] = useState<Snapshot>({ db: emptyDb(), settings: defaultSettings() });
  const snapRef = useRef(snap);
  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const commit = useCallback((next: Snapshot) => {
    snapRef.current = next;
    setSnap(next);
  }, []);

  // 初期ロード
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (adapter.mode === "supabase") {
        const sb = getSupabase()!;
        const { data } = await sb.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        sb.auth.onAuthStateChange((_e, s) => setSession(s));
        if (!data.session) {
          setReady(true);
          return;
        }
      }
      try {
        let loaded = await adapter.load();
        if (!loaded && adapter.mode === "local") {
          loaded = buildSeed();
          await adapter.apply([], loaded);
        }
        if (cancelled || !loaded) return;
        commit({ db: loaded.db, settings: { ...defaultSettings(), ...(loaded.settings ?? {}) } });
        if (adapter.mode === "local") {
          const stored = localStorage.getItem(ME_KEY);
          setMeId(stored && loaded.db.members.some((m) => m.id === stored) ? stored : loaded.db.members.find((m) => m.role === "owner")?.id ?? null);
        }
      } catch (e) {
        toast(`データの読み込みに失敗しました：${(e as Error).message}`, "error");
      }
      setReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [adapter, commit, toast]);

  // Supabase：ログイン後の再ロードとメンバー解決（最初のユーザーは Owner として登録）
  useEffect(() => {
    if (adapter.mode !== "supabase" || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await adapter.load();
        if (cancelled || !loaded) return;
        let db = loaded.db;
        const email = session.user.email ?? "";
        let member = db.members.find((m) => m.email.toLowerCase() === email.toLowerCase());
        if (!member) {
          const tx = new Tx(db, email);
          member = tx.insert("members", {
            name: email.split("@")[0],
            email,
            role: db.members.length === 0 ? "owner" : "viewer",
            active: true,
          });
          await adapter.apply(tx.ops, { db: tx.db, settings: loaded.settings });
          // メンバー登録後は RLS により閲覧できる範囲が変わるので読み直す
          db = (await adapter.load())?.db ?? tx.db;
        }
        commit({ db, settings: { ...defaultSettings(), ...(loaded.settings ?? {}) } });
        setMeId(member.id);
        setReady(true);
      } catch (e) {
        toast(`データの読み込みに失敗しました：${(e as Error).message}`, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, session, commit, toast]);

  const me = snap.db.members.find((m) => m.id === meId) ?? null;
  const allowed = useCallback((a: Action) => can(me?.role, a), [me]);

  const run = useCallback(
    <R,>(fn: (tx: Tx) => R, opts: { need?: Action; ok?: string } = {}) => {
      const role = me?.role;
      if (!can(role, opts.need ?? "record.edit")) {
        toast(denyMessage(opts.need ?? "record.edit"), "error");
        return undefined;
      }
      const prev = snapRef.current;
      const tx = new Tx(prev.db, me?.name ?? "System");
      let result: R;
      try {
        result = fn(tx);
      } catch (e) {
        toast((e as Error).message, "error");
        return undefined;
      }
      if (tx.ops.length === 0) return result;
      const next = { ...prev, db: tx.db };
      commit(next);
      adapter.apply(tx.ops, next).catch((e) => {
        toast(`保存に失敗しました：${(e as Error).message}`, "error");
        commit(prev);
      });
      if (opts.ok) toast(opts.ok);
      return result;
    },
    [adapter, commit, toast, me],
  );

  const saveSettings = useCallback(
    (s: CompanySettings) => {
      if (!can(me?.role, "settings.edit")) {
        toast(denyMessage("settings.edit"), "error");
        return;
      }
      const next = { ...snapRef.current, settings: s };
      commit(next);
      adapter.saveSettings(s, next).then(
        () => toast("設定を保存しました"),
        (e) => toast(`保存に失敗しました：${(e as Error).message}`, "error"),
      );
    },
    [adapter, commit, toast, me],
  );

  const upload = useCallback(
    async (file: File) => {
      try {
        return await adapter.upload(file);
      } catch (e) {
        toast((e as Error).message, "error");
        return null;
      }
    },
    [adapter, toast],
  );

  const setMe = useCallback((id: string) => {
    setMeId(id);
    try {
      localStorage.setItem(ME_KEY, id);
    } catch {}
  }, []);

  const resetDemo = useCallback(
    async (withSeed: boolean) => {
      if (adapter.mode !== "local") return;
      await adapter.reset?.();
      const next = withSeed ? buildSeed() : { db: { ...emptyDb(), members: snapRef.current.db.members }, settings: snapRef.current.settings };
      await adapter.apply([], next);
      commit(next);
      setMeId(next.db.members.find((m) => m.role === "owner")?.id ?? null);
      toast(withSeed ? "サンプルデータを再投入しました" : "データを初期化しました");
    },
    [adapter, commit, toast],
  );

  const importSnapshot = useCallback(
    async (s: Snapshot) => {
      if (adapter.mode !== "local") return;
      const next = { db: { ...emptyDb(), ...s.db }, settings: { ...defaultSettings(), ...s.settings } };
      await adapter.apply([], next);
      commit(next);
      toast("データを読み込みました");
    },
    [adapter, commit, toast],
  );

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setMeId(null);
  }, []);

  const value: StoreValue = {
    ready,
    mode: adapter.mode,
    db: snap.db,
    settings: snap.settings,
    me,
    session,
    run,
    saveSettings,
    upload,
    can: allowed,
    setMe,
    resetDemo,
    importSnapshot,
    toast,
    toasts,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore は StoreProvider の内側で使ってください");
  return v;
}

/** id → レコードの参照用 Map */
export function useLookup() {
  const { db } = useStore();
  return useMemo(
    () => ({
      producer: new Map(db.producers.map((x) => [x.id, x])),
      buyer: new Map(db.buyers.map((x) => [x.id, x])),
      product: new Map(db.products.map((x) => [x.id, x])),
      deal: new Map(db.deals.map((x) => [x.id, x])),
      member: new Map(db.members.map((x) => [x.id, x])),
    }),
    [db],
  );
}
