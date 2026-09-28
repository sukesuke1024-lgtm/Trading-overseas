"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { HistoryList } from "@/components/history";
import { Badge, Button, Card, Input, PageHeader, Select, Tabs } from "@/components/ui";
import { ACTION_LABELS, TABLE_LABELS, fieldLabel, formatValue } from "@/lib/audit";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store/store";
import type { AuditEntry, TableName } from "@/lib/types";

type Tab = "data" | "system";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("data");
  return (
    <>
      <PageHeader title="History" subtitle="データの訂正履歴（誰が・いつ・何を・どう変えたか）とシステム更新履歴" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "data", label: "訂正履歴" },
          { key: "system", label: `システム更新履歴（v${APP_VERSION}）` },
        ]}
      />
      <div className="mt-4">{tab === "data" ? <DataHistory /> : <SystemHistory />}</div>
    </>
  );
}

function DataHistory() {
  const { db } = useStore();
  const [table, setTable] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const actors = useMemo(() => Array.from(new Set(db.audit_log.map((e) => e.actor))), [db.audit_log]);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return db.audit_log.filter(
      (e) =>
        (!table || e.table_name === table) &&
        (!action || e.action === action) &&
        (!actor || e.actor === actor) &&
        (!from || e.created_at.slice(0, 10) >= from) &&
        (!to || e.created_at.slice(0, 10) <= to) &&
        (!n || `${e.record_label} ${JSON.stringify(e.changes)}`.toLowerCase().includes(n)),
    );
  }, [db.audit_log, table, action, actor, from, to, q]);

  function exportCsv(list: AuditEntry[]) {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [["日時", "操作者", "対象", "レコード", "操作", "項目", "変更前", "変更後"].map(esc).join(",")];
    for (const e of list) {
      const fields = Object.entries(e.changes);
      if (fields.length === 0) lines.push([fmtDateTime(e.created_at), e.actor, TABLE_LABELS[e.table_name], e.record_label, ACTION_LABELS[e.action], "", "", ""].map(esc).join(","));
      for (const [k, c] of fields) lines.push([fmtDateTime(e.created_at), e.actor, TABLE_LABELS[e.table_name], e.record_label, ACTION_LABELS[e.action], fieldLabel(k), formatValue(c.from), formatValue(c.to)].map(esc).join(","));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
    a.download = `aitrek-os-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="レコード名・値で検索" className="w-56" />
        <Select value={table} onChange={(e) => setTable(e.target.value)} className="w-auto">
          <option value="">対象：すべて</option>
          {(Object.keys(TABLE_LABELS) as TableName[])
            .filter((t) => t !== "audit_log" && t !== "activities")
            .map((t) => (
              <option key={t} value={t}>
                {TABLE_LABELS[t]}
              </option>
            ))}
        </Select>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-auto">
          <option value="">操作：すべて</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={actor} onChange={(e) => setActor(e.target.value)} className="w-auto">
          <option value="">操作者：すべて</option>
          {actors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-38" aria-label="開始日" />
        <span className="text-ink-3">〜</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-38" aria-label="終了日" />
        <span className="text-[12px] text-ink-3">{rows.length} 件</span>
        <Button size="sm" className="ml-auto" onClick={() => exportCsv(rows)}>
          <Download size={13} /> CSV
        </Button>
      </div>
      <div className="px-4 py-2">
        <HistoryList entries={rows} showRecord limit={100} />
      </div>
    </Card>
  );
}

function SystemHistory() {
  return (
    <div className="flex flex-col gap-3">
      {CHANGELOG.map((r) => (
        <Card key={r.version}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">v{r.version}</span>
            <Badge tone={r.kind === "fix" ? "amber" : r.kind === "security" ? "red" : "blue"}>{r.kind === "fix" ? "不具合修正" : r.kind === "security" ? "セキュリティ" : "機能追加"}</Badge>
            <span className="text-[12.5px] text-ink-3">{r.date}</span>
            {r.pr && (
              <a href={`https://github.com/sukesuke1024-lgtm/Trading-overseas/pull/${r.pr}`} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent-2 hover:underline">
                PR #{r.pr}
              </a>
            )}
          </div>
          <ul className="list-disc pl-5 text-[13px] leading-relaxed text-ink-2">
            {r.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
