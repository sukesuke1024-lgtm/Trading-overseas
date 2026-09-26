"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Plus, Search, Download } from "lucide-react";
import { Button, Card, Empty, Input, PageHeader, Select, Table } from "./ui";

export interface Column<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
  sort?: (row: T) => string | number;
  csv?: (row: T) => string | number;
}

export interface Filter<T> {
  label: string;
  options: string[] | { value: string; label: string }[];
  test: (row: T, value: string) => boolean;
}

export function CrudList<T extends { id: string }>({
  title,
  subtitle,
  rows,
  columns,
  search,
  filters = [],
  href,
  onNew,
  newLabel = "新規登録",
  canCreate = true,
  csvName,
  empty,
}: {
  title: string;
  subtitle?: ReactNode;
  rows: T[];
  columns: Column<T>[];
  search: (row: T) => string;
  filters?: Filter<T>[];
  href: (row: T) => string;
  onNew?: () => void;
  newLabel?: string;
  canCreate?: boolean;
  csvName?: string;
  empty?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<string[]>(filters.map(() => ""));
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (!needle || search(r).toLowerCase().includes(needle)) && filters.every((f, i) => !fv[i] || f.test(r, fv[i])));
    if (sort && columns[sort.i].sort) {
      const key = columns[sort.i].sort!;
      out = [...out].sort((a, b) => (key(a) > key(b) ? sort.dir : key(a) < key(b) ? -sort.dir : 0));
    }
    return out;
  }, [rows, q, fv, filters, search, sort, columns]);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const cols = columns.filter((c) => c.csv);
    const lines = [cols.map((c) => esc(c.label)).join(","), ...shown.map((r) => cols.map((c) => esc(c.csv!(r))).join(","))];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${csvName ?? title}.csv`;
    a.click();
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {csvName && (
              <Button onClick={exportCsv}>
                <Download size={14} /> CSV
              </Button>
            )}
            {onNew && canCreate && (
              <Button variant="primary" onClick={onNew}>
                <Plus size={15} /> {newLabel}
              </Button>
            )}
          </>
        }
      />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-52 flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索…" className="pl-8" />
          </div>
          {filters.map((f, i) => (
            <Select key={f.label} value={fv[i]} onChange={(e) => setFv((s) => s.map((x, j) => (j === i ? e.target.value : x)))} className="w-auto min-w-36">
              <option value="">{f.label}：すべて</option>
              {f.options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                );
              })}
            </Select>
          ))}
          <span className="text-[12px] text-ink-3">{shown.length} 件</span>
        </div>
        {shown.length === 0 ? (
          <div className="p-4">{empty ?? <Empty>該当するデータがありません</Empty>}</div>
        ) : (
          <Table>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c.label}
                    className={c.sort ? "cursor-pointer select-none hover:text-ink" : ""}
                    onClick={() => c.sort && setSort((s) => (s?.i === i ? { i, dir: s.dir === 1 ? -1 : 1 } : { i, dir: 1 }))}
                  >
                    {c.label}
                    {sort?.i === i ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="cursor-pointer">
                  {columns.map((c, i) => (
                    <td key={c.label} className={c.className}>
                      {i === 0 ? (
                        <Link href={href(r)} className="block font-medium text-ink hover:text-accent-2">
                          {c.render(r)}
                        </Link>
                      ) : (
                        <Link href={href(r)} className="block">
                          {c.render(r)}
                        </Link>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
