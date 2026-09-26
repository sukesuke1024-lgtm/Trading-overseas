"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { updateFinance } from "@/lib/automation";
import { CURRENCIES, PAYMENT_STATUS, paymentStatusLabel } from "@/lib/constants";
import { daysBetween, fmtDate, money, pct, today, yen } from "@/lib/format";
import { financeOverdue, outstanding } from "@/lib/insights";
import { useLookup, useStore } from "@/lib/store/store";
import type { FinanceRecord, PaymentStatus } from "@/lib/types";

export default function FinancePage() {
  const { db } = useStore();
  const lk = useLookup();
  const [status, setStatus] = useState("");
  const [edit, setEdit] = useState<FinanceRecord | null>(null);
  const now = today();

  const rows = useMemo(
    () => db.finance.filter((f) => !status || (status === "overdue" ? financeOverdue(f, now) : f.status === status)).sort((a, b) => (a.payment_due || "9").localeCompare(b.payment_due || "9")),
    [db.finance, status, now],
  );

  const totals = db.finance.reduce(
    (s, f) => ({
      revenue: s.revenue + f.revenue,
      profit: s.profit + (f.revenue - f.cost),
      outstanding: s.outstanding + outstanding(f),
      overdue: s.overdue + (financeOverdue(f, now) ? outstanding(f) : 0),
      aitrek: s.aitrek + (f.revenue - f.producer_payment - f.logistics_payment),
    }),
    { revenue: 0, profit: 0, outstanding: 0, overdue: 0, aitrek: 0 },
  );
  const overdueList = db.finance.filter((f) => financeOverdue(f, now));

  return (
    <>
      <PageHeader title="Finance" subtitle="案件単位の売上・原価・請求・入金管理" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="売上（受注案件）" value={yen(totals.revenue)} />
        <Stat label="粗利益" value={yen(totals.profit)} sub={`粗利率 ${pct(totals.revenue ? totals.profit / totals.revenue : 0)}`} />
        <Stat label="AITREK Revenue" value={yen(totals.aitrek)} sub="売上 − Producer支払 − Logistics支払" />
        <Stat label="未入金額" value={yen(totals.outstanding)} tone={totals.outstanding > 0 ? "warn" : undefined} />
        <Stat label="入金期限超過" value={yen(totals.overdue)} sub={`${overdueList.length} 件`} tone={overdueList.length ? "bad" : undefined} />
      </div>

      {overdueList.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] text-bad">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Payment Alert：</b>
            {overdueList.map((f) => `${f.invoice_no}（${lk.deal.get(f.deal_id)?.code}・${daysBetween(f.payment_due, now)}日超過）`).join("、")}
          </div>
        </div>
      )}

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">入金Status：すべて</option>
            <option value="overdue">期限超過</option>
            {PAYMENT_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <span className="text-[12px] text-ink-3">{rows.length} 件</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>Finance レコードはありません。Deal を Contract / Order に進めると自動作成されます。</Empty>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Deal</th>
                <th className="text-right">売上</th>
                <th className="text-right">原価</th>
                <th className="text-right">粗利益</th>
                <th className="text-right">粗利率</th>
                <th className="text-right">請求金額</th>
                <th>請求日</th>
                <th>Payment Due</th>
                <th>入金日</th>
                <th>Status</th>
                <th className="text-right">Producer支払</th>
                <th className="text-right">Logistics支払</th>
                <th className="text-right">AITREK Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const deal = lk.deal.get(f.deal_id);
                const od = financeOverdue(f, now);
                const profit = f.revenue - f.cost;
                return (
                  <tr key={f.id} onClick={() => setEdit(f)} className="cursor-pointer">
                    <td className="font-medium">{f.invoice_no}</td>
                    <td>
                      <Link href={`/deals/${f.deal_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent-2">
                        {deal?.code}
                      </Link>
                      <div className="max-w-44 truncate text-[11.5px] text-ink-3">{lk.buyer.get(deal?.buyer_id ?? "")?.company_name}</div>
                    </td>
                    <td className="tabular text-right">{yen(f.revenue)}</td>
                    <td className="tabular text-right">{yen(f.cost)}</td>
                    <td className="tabular text-right">{yen(profit)}</td>
                    <td className="tabular text-right">{pct(f.revenue ? profit / f.revenue : 0)}</td>
                    <td className="tabular text-right">
                      {money(f.invoice_amount, f.currency)}
                      <div className="text-[11px] text-ink-3">@{f.exchange_rate}</div>
                    </td>
                    <td>{fmtDate(f.invoice_date)}</td>
                    <td className={od ? "font-semibold text-bad" : ""}>{fmtDate(f.payment_due)}</td>
                    <td>{fmtDate(f.paid_date)}</td>
                    <td>
                      <Badge tone={f.status === "paid" ? "green" : od ? "red" : f.status === "billed" || f.status === "partial" ? "blue" : "gray"}>{od ? "期限超過" : paymentStatusLabel(f.status)}</Badge>
                    </td>
                    <td className="tabular text-right">{yen(f.producer_payment)}</td>
                    <td className="tabular text-right">{yen(f.logistics_payment)}</td>
                    <td className="tabular text-right font-medium">{yen(f.revenue - f.producer_payment - f.logistics_payment)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {edit && <FinanceModal f={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function FinanceModal({ f, onClose }: { f: FinanceRecord; onClose: () => void }) {
  const { run, can } = useStore();
  const [v, setV] = useState(f);
  const set = <K extends keyof FinanceRecord>(k: K, val: FinanceRecord[K]) => setV((s) => ({ ...s, [k]: val }));
  const n = (x: string) => (x === "" ? 0 : Number(x));

  function save() {
    // 入金確定（一部入金・入金済）・入金額の変更は Payment 権限（Owner/Admin）
    const paymentChange = (v.status !== f.status && (v.status === "paid" || v.status === "partial")) || v.paid_amount !== f.paid_amount || v.paid_date !== f.paid_date;
    const moneyChange = v.producer_payment !== f.producer_payment || v.logistics_payment !== f.logistics_payment;
    const need = paymentChange || moneyChange ? "payment" : "finance.edit";
    const patch = { ...v };
    if (v.status === "paid" && !v.paid_date) patch.paid_date = today();
    if (v.status === "paid" && !v.paid_amount) patch.paid_amount = v.invoice_amount;
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = patch;
    void _i; void _c; void _u;
    const ok = run((tx) => (updateFinance(tx, f, rest), true), { need, ok: "保存しました" });
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Finance：${f.invoice_no}`}
      footer={
        <>
          <span className="mr-auto self-center text-[11.5px] text-ink-3">入金確定・支払額の変更は Owner / Admin のみ</span>
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={save} disabled={!can("finance.edit") && !can("payment")}>
            保存
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice No.">
          <Input value={v.invoice_no} onChange={(e) => set("invoice_no", e.target.value)} />
        </Field>
        <Field label="入金Status">
          <Select value={v.status} onChange={(e) => set("status", e.target.value as PaymentStatus)}>
            {PAYMENT_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select value={v.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Exchange Rate（円）">
          <Input type="number" step="any" value={v.exchange_rate} onChange={(e) => set("exchange_rate", n(e.target.value))} />
        </Field>
        <Field label="請求金額">
          <Input type="number" step="any" value={v.invoice_amount} onChange={(e) => set("invoice_amount", n(e.target.value))} />
        </Field>
        <Field label="請求日">
          <Input type="date" value={v.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} />
        </Field>
        <Field label="Payment Due">
          <Input type="date" value={v.payment_due} onChange={(e) => set("payment_due", e.target.value)} />
        </Field>
        <Field label="入金日">
          <Input type="date" value={v.paid_date} onChange={(e) => set("paid_date", e.target.value)} />
        </Field>
        <Field label="入金額">
          <Input type="number" step="any" value={v.paid_amount} onChange={(e) => set("paid_amount", n(e.target.value))} />
        </Field>
        <Field label="Producer支払額（円）">
          <Input type="number" value={v.producer_payment} onChange={(e) => set("producer_payment", n(e.target.value))} />
        </Field>
        <Field label="Logistics支払額（円）">
          <Input type="number" value={v.logistics_payment} onChange={(e) => set("logistics_payment", n(e.target.value))} />
        </Field>
        <Field label="AITREK Revenue">
          <div className="tabular flex h-8.5 items-center font-semibold">{yen(v.revenue - v.producer_payment - v.logistics_payment)}</div>
        </Field>
        <Field label="メモ" className="col-span-2">
          <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
