"use client";

import { useState, type ReactNode } from "react";
import { COUNTRIES, countryLabel } from "@/lib/constants";
import { useStore } from "@/lib/store/store";
import { Button, Field, Input, KV, Select, Textarea, cx } from "./ui";

export type FieldType =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "multi"
  | "country"
  | "countries"
  | "ref"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  section: string;
  options?: string[] | { value: string; label: string }[];
  required?: boolean;
  span?: 1 | 2 | 3;
  hint?: string;
  placeholder?: string;
  suffix?: string;
}

type Values = Record<string, unknown>;

const opts = (o: FieldDef["options"]) => (o ?? []).map((x) => (typeof x === "string" ? { value: x, label: x } : x));

export function EntityForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "保存",
  extra,
}: {
  fields: FieldDef[];
  initial: Values;
  onSubmit: (v: Values) => void;
  onCancel?: () => void;
  submitLabel?: string;
  extra?: ReactNode;
}) {
  const [v, setV] = useState<Values>(initial);
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const sections = Array.from(new Set(fields.map((f) => f.section)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="flex flex-col gap-6"
    >
      {sections.map((sec) => (
        <fieldset key={sec}>
          <legend className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-ink-3">{sec}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields
              .filter((f) => f.section === sec)
              .map((f) => (
                <Field key={f.key} label={f.label + (f.required ? " *" : "")} hint={f.hint} className={cx(f.span === 2 && "sm:col-span-2", f.span === 3 && "sm:col-span-2 lg:col-span-3")}>
                  <Control f={f} value={v[f.key]} onChange={(val) => set(f.key, val)} />
                </Field>
              ))}
          </div>
        </fieldset>
      ))}
      {extra}
      <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button variant="primary" type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Control({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const { db, upload } = useStore();
  switch (f.type) {
    case "textarea":
      return <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
    case "number":
      return (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="any"
            value={value == null || value === "" ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            placeholder={f.placeholder}
            required={f.required}
          />
          {f.suffix && <span className="text-[12px] text-ink-3">{f.suffix}</span>}
        </div>
      );
    case "select":
      return (
        <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.required}>
          <option value="">—</option>
          {opts(f.options).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case "country":
      return (
        <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={f.required}>
          <option value="">{f.placeholder ?? "—"}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}（{c.code}）
            </option>
          ))}
        </Select>
      );
    case "ref":
      return (
        <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} required={f.required}>
          <option value="">—</option>
          {db.producers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.company_name}
              {p.brand_name ? `（${p.brand_name}）` : ""}
            </option>
          ))}
        </Select>
      );
    case "multi":
    case "countries": {
      const list = (value as string[]) ?? [];
      const choices = f.type === "countries" ? COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.code}` })) : opts(f.options);
      return (
        <div className="flex flex-wrap gap-1.5 rounded-md border border-line-strong p-1.5">
          {choices.map((o) => {
            const on = list.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                className={cx("rounded border px-1.5 py-0.5 text-[12px]", on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "file":
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="URL または ファイルを選択" />
            <label className="inline-flex h-8.5 cursor-pointer items-center rounded-md border border-line-strong px-2.5 text-[12.5px] hover:bg-surface-2">
              選択
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const a = await upload(file);
                  if (a) onChange(a.url);
                }}
              />
            </label>
          </div>
          {typeof value === "string" && value.startsWith("data:image") || (typeof value === "string" && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(value)} alt="" className="h-20 w-20 rounded border border-line object-cover" />
          ) : null}
        </div>
      );
    default:
      return <Input type={f.type} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} required={f.required} />;
  }
}

/** 詳細表示（フォームと同じ定義から描画） */
export function EntityView({ fields, values }: { fields: FieldDef[]; values: Values }) {
  const { db } = useStore();
  const sections = Array.from(new Set(fields.map((f) => f.section)));
  const render = (f: FieldDef): ReactNode => {
    const v = values[f.key];
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
    switch (f.type) {
      case "country":
        return countryLabel(String(v));
      case "countries":
        return (v as string[]).map((c) => countryLabel(c)).join("、");
      case "multi":
        return (v as string[]).join("、");
      case "ref":
        return db.producers.find((p) => p.id === v)?.company_name;
      case "url":
        return (
          <a href={String(v)} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
            {String(v).replace(/^https?:\/\//, "")}
          </a>
        );
      case "email":
        return (
          <a href={`mailto:${v}`} className="text-accent-2 hover:underline">
            {String(v)}
          </a>
        );
      case "file":
        return String(v).startsWith("data:image") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(v)) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={String(v)} alt="" className="h-24 w-24 rounded border border-line object-cover" />
        ) : (
          <a href={String(v)} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
            開く
          </a>
        );
      case "number":
        return `${Number(v).toLocaleString("ja-JP")}${f.suffix ? ` ${f.suffix}` : ""}`;
      case "textarea":
        return <span className="whitespace-pre-wrap">{String(v)}</span>;
      default:
        return String(v);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      {sections.map((sec) => (
        <div key={sec}>
          <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">{sec}</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields
              .filter((f) => f.section === sec)
              .map((f) => (
                <div key={f.key} className={cx(f.span === 3 && "sm:col-span-2 lg:col-span-3", f.span === 2 && "sm:col-span-2")}>
                  <KV label={f.label}>{render(f)}</KV>
                </div>
              ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
