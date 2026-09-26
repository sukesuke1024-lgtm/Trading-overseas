"use client";

import { useState } from "react";
import { Download, Upload, UserPlus } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Textarea } from "@/components/ui";
import { log } from "@/lib/automation";
import { CURRENCIES, ROLES, roleLabel } from "@/lib/constants";
import { ACTION_LABELS, ALL_ACTIONS, can as canRole } from "@/lib/permissions";
import { useStore } from "@/lib/store/store";
import type { CompanySettings, Role } from "@/lib/types";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="会社情報・為替レート・ユーザーと権限・データ管理" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CompanyCard />
        <FxCard />
        <div className="xl:col-span-2" id="users">
          <UsersCard />
        </div>
        <PermissionMatrix />
        <DataCard />
      </div>
    </>
  );
}

function CompanyCard() {
  const { settings, saveSettings, can } = useStore();
  const [v, setV] = useState<CompanySettings>(settings);
  const set = (k: keyof CompanySettings, val: string | number) => setV({ ...v, [k]: val });
  const ro = !can("settings.edit");
  return (
    <Card title="会社情報（書類に印字）" action={<Button size="sm" variant="primary" disabled={ro} onClick={() => saveSettings(v)}>保存</Button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="会社名">
          <Input disabled={ro} value={v.company_name} onChange={(e) => set("company_name", e.target.value)} />
        </Field>
        <Field label="会社名（英語）">
          <Input disabled={ro} value={v.company_name_en} onChange={(e) => set("company_name_en", e.target.value)} />
        </Field>
        <Field label="住所（英語）" className="sm:col-span-2">
          <Input disabled={ro} value={v.address_en} onChange={(e) => set("address_en", e.target.value)} />
        </Field>
        <Field label="電話">
          <Input disabled={ro} value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input disabled={ro} value={v.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Webサイト">
          <Input disabled={ro} value={v.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="標準 AITREK 手数料（%）">
          <Input disabled={ro} type="number" value={v.default_commission} onChange={(e) => set("default_commission", Number(e.target.value))} />
        </Field>
        <Field label="振込先（Invoice に印字）" className="sm:col-span-2">
          <Textarea disabled={ro} value={v.bank_info} onChange={(e) => set("bank_info", e.target.value)} placeholder={"Bank: \nBranch: \nSWIFT: \nAccount No.: \nAccount Name: "} />
        </Field>
      </div>
    </Card>
  );
}

function FxCard() {
  const { settings, saveSettings, can } = useStore();
  const [fx, setFx] = useState(settings.fx_rates);
  const ro = !can("settings.edit");
  return (
    <Card title="為替レート（1通貨 = 円）" action={<Button size="sm" variant="primary" disabled={ro} onClick={() => saveSettings({ ...settings, fx_rates: fx })}>保存</Button>}>
      <p className="mb-3 text-[12px] text-ink-3">新規 Deal・原価計算の初期値に使用します。既存 Deal の為替は各 Deal の原価計算で個別に更新してください。</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {CURRENCIES.filter((c) => c !== "JPY").map((c) => (
          <Field key={c} label={c}>
            <Input disabled={ro} type="number" step="any" value={fx[c] ?? ""} onChange={(e) => setFx({ ...fx, [c]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function UsersCard() {
  const { db, run, me, setMe, mode, can } = useStore();
  const [v, setV] = useState({ name: "", email: "", role: "sales" as Role });
  return (
    <Card title="ユーザー・Role">
      {mode === "local" && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px]">
          <span className="text-ink-2">ローカルモード：操作するユーザーを切替（権限の確認用）</span>
          <Select value={me?.id ?? ""} onChange={(e) => setMe(e.target.value)} className="w-56">
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{roleLabel(m.role)}）
              </option>
            ))}
          </Select>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <th>名前</th>
            <th>Email</th>
            <th>Role</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {db.members.map((m) => (
            <tr key={m.id}>
              <td className="font-medium">
                {m.name} {m.id === me?.id && <Badge tone="blue">you</Badge>}
              </td>
              <td>{m.email}</td>
              <td>
                <Select
                  value={m.role}
                  disabled={!can("user.manage")}
                  onChange={(e) =>
                    run(
                      (tx) => {
                        tx.update("members", m.id, { role: e.target.value as Role });
                        log(tx, "system", `Role変更：${m.name} → ${roleLabel(e.target.value as Role)}`);
                      },
                      { need: "user.manage", ok: "Role を変更しました" },
                    )
                  }
                  className="w-44"
                >
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </td>
              <td>
                <button
                  disabled={!can("user.manage") || m.id === me?.id}
                  onClick={() => run((tx) => tx.update("members", m.id, { active: !m.active }), { need: "user.manage" })}
                  className="disabled:opacity-50"
                >
                  <Badge tone={m.active ? "green" : "gray"}>{m.active ? "有効" : "無効"}</Badge>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.name || !v.email) return;
          run(
            (tx) => {
              tx.insert("members", { ...v, active: true });
              log(tx, "system", `User追加：${v.name}（${roleLabel(v.role)}）`);
            },
            { need: "user.manage", ok: "ユーザーを追加しました" },
          );
          setV({ name: "", email: "", role: "sales" });
        }}
      >
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="名前" className="w-44" />
        <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Email" className="w-56" />
        <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })} className="w-44">
          {ROLES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={!can("user.manage")}>
          <UserPlus size={14} /> User追加
        </Button>
      </form>
      {mode === "supabase" && <p className="mt-2 text-[11.5px] text-ink-3">追加したメールアドレスで Supabase Auth にログインすると、この Role が適用されます。</p>}
    </Card>
  );
}

function PermissionMatrix() {
  return (
    <Card title="権限マトリクス" pad={false}>
      <Table>
        <thead>
          <tr>
            <th>操作</th>
            {ROLES.map((r) => (
              <th key={r.key} className="text-center">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_ACTIONS.map((a) => (
            <tr key={a}>
              <td className="whitespace-nowrap">{ACTION_LABELS[a]}</td>
              {ROLES.map((r) => (
                <td key={r.key} className="text-center">
                  {canRole(r.key, a) ? <span className="text-good">●</span> : <span className="text-ink-3">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function DataCard() {
  const { db, settings, mode, resetDemo, importSnapshot, can } = useStore();
  const admin = can("settings.edit");
  return (
    <Card title="データ管理">
      <dl className="mb-4 grid grid-cols-2 gap-2 text-[12.5px]">
        <dt className="text-ink-3">保存先</dt>
        <dd>{mode === "supabase" ? "Supabase（PostgreSQL）" : "このブラウザ（ローカルモード）"}</dd>
        <dt className="text-ink-3">レコード数</dt>
        <dd>
          Producer {db.producers.length} / Buyer {db.buyers.length} / 商品 {db.products.length} / Deal {db.deals.length} / Task {db.tasks.length}
        </dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const blob = new Blob([JSON.stringify({ db, settings }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `aitrek-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
        >
          <Download size={14} /> バックアップ（JSON）
        </Button>
        {mode === "local" && (
          <>
            <label className={`inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-[13px] font-medium hover:bg-surface-2 ${!admin ? "pointer-events-none opacity-45" : ""}`}>
              <Upload size={14} /> 復元
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !confirm("現在のデータを置き換えます。よろしいですか？")) return;
                  await importSnapshot(JSON.parse(await f.text()));
                }}
              />
            </label>
            <Button disabled={!admin} onClick={() => confirm("サンプルデータで置き換えますか？") && resetDemo(true)}>
              サンプルデータ再投入
            </Button>
            <Button variant="danger" disabled={!admin} onClick={() => confirm("すべての業務データを削除しますか？（ユーザーは残ります）") && resetDemo(false)}>
              データ初期化
            </Button>
          </>
        )}
      </div>
      {mode === "local" && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
          本番運用では Supabase を接続してください（README 参照）。環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定すると、データベース・ログイン・ファイル保存が Supabase に切り替わります。
        </p>
      )}
    </Card>
  );
}
