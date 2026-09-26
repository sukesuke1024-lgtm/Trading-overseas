"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, Pencil, Trash2, ShieldCheck, FileText, FileSpreadsheet, Calculator, RefreshCw } from "lucide-react";
import { AiPanel } from "@/components/ai-panel";
import { Checklist } from "@/components/checklist";
import { ActivityFeed, StageBadge } from "@/components/common";
import { CostSimulator } from "@/components/cost-simulator";
import { Badge, Button, Card, Empty, Field, Input, KV, Modal, Select, Textarea, cx } from "@/components/ui";
import { applyCost, generateChecklist, log } from "@/lib/automation";
import { DOC_TYPES, INCOTERMS, LOST_STAGE, PAYMENT_TERMS, STAGES, countryLabel, docTypeLabel, paymentStatusLabel, stageIndex, COUNTRIES } from "@/lib/constants";
import { calcCost } from "@/lib/cost";
import { moveDeal } from "@/lib/deal-actions";
import { fmtDate, money, pct, today, yen } from "@/lib/format";
import { financeOverdue } from "@/lib/insights";
import { useLookup, useStore } from "@/lib/store/store";
import type { CostInputs, Deal } from "@/lib/types";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { db, run, can } = useStore();
  const lk = useLookup();
  const router = useRouter();
  const deal = db.deals.find((d) => d.id === id);
  const [costOpen, setCostOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "call" | "email" | "meeting">("note");

  if (!deal) return <Empty action={<Link href="/deals" className="text-accent-2">Pipeline へ戻る</Link>}>Deal が見つかりません</Empty>;

  const buyer = lk.buyer.get(deal.buyer_id ?? "");
  const producer = lk.producer.get(deal.producer_id ?? "");
  const product = lk.product.get(deal.product_id ?? "");
  const r = calcCost(deal.cost);
  const quotations = db.quotations.filter((q) => q.deal_id === id);
  const docs = db.documents.filter((d) => d.deal_id === id);
  const fin = db.finance.find((f) => f.deal_id === id);
  const acts = db.activities.filter((a) => a.deal_id === id);
  const followups = db.tasks.filter((t) => t.deal_id === id && t.kind !== "checklist" && t.status !== "done" && t.status !== "na");
  const hasChecklist = db.tasks.some((t) => t.deal_id === id && t.kind === "checklist");
  const idx = stageIndex(deal.stage);

  return (
    <>
      <Link href="/deals" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> Deal Pipeline
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
            <span>{deal.code}</span>
            <StageBadge stage={deal.stage} />
            <Badge tone={deal.price_approved ? "green" : "amber"}>{deal.price_approved ? "価格承認済" : "価格未承認"}</Badge>
            {deal.contract_approved && <Badge tone="gold">契約承認済</Badge>}
          </div>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight">{deal.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={deal.stage} onChange={(e) => moveDeal(run, deal, e.target.value as Deal["stage"])} className="w-44" aria-label="Status">
            {[...STAGES, LOST_STAGE].map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button onClick={() => setEditOpen(true)} disabled={!can("record.edit")}>
            <Pencil size={14} /> 編集
          </Button>
          <Button
            variant="danger"
            disabled={!can("record.delete")}
            onClick={() => {
              if (!confirm(`${deal.code} を削除しますか？関連Taskも削除されます。`)) return;
              const ok = run(
                (tx) => {
                  tx.all("tasks").filter((t) => t.deal_id === id).forEach((t) => tx.remove("tasks", t.id));
                  tx.remove("deals", id);
                  log(tx, "system", `Deal削除：${deal.code} ${deal.title}`);
                  return true;
                },
                { need: "record.delete", ok: "削除しました" },
              );
              if (ok) router.push("/deals");
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* ステージ進捗 */}
      <div className="mb-5 overflow-x-auto">
        <ol className="flex min-w-[900px] items-center gap-1">
          {STAGES.map((s, i) => (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
              <button
                onClick={() => moveDeal(run, deal, s.key)}
                className={cx(
                  "h-1.5 w-full rounded-full transition-colors",
                  deal.stage === "lost" ? "bg-bad/25" : i <= idx ? "bg-accent" : "bg-line-strong/60 hover:bg-line-strong",
                )}
                aria-label={s.label}
                title={s.label}
              />
              <span className={cx("text-[10.5px]", i === idx ? "font-semibold text-ink" : "text-ink-3")}>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 仕様書 5：Buyer → Country → Producer → Product → Quantity → Incoterms */}
          <Card title="案件フロー">
            <div className="flex flex-wrap items-stretch gap-1.5">
              <FlowItem label="Buyer" href={buyer && `/buyers/${buyer.id}`}>
                {buyer?.company_name}
              </FlowItem>
              <FlowItem label="Country">{countryLabel(deal.country)}</FlowItem>
              <FlowItem label="Producer" href={producer && `/producers/${producer.id}`}>
                {producer?.company_name}
              </FlowItem>
              <FlowItem label="Product" href={product && `/products/${product.id}`}>
                {product?.name}
              </FlowItem>
              <FlowItem label="Quantity">{deal.quantity.toLocaleString()} {deal.unit}</FlowItem>
              <FlowItem label="Incoterms" last>
                {deal.incoterm}
              </FlowItem>
            </div>
          </Card>

          {/* Product Cost → Logistics → Fee → Selling Price → Revenue → Profit → Margin */}
          <Card
            title="原価・利益"
            action={
              <div className="flex gap-2">
                {!deal.price_approved && (
                  <Button
                    size="sm"
                    disabled={!can("price.change")}
                    title={!can("price.change") ? "Owner / Admin のみ" : undefined}
                    onClick={() =>
                      run(
                        (tx) => {
                          tx.update("deals", id, { price_approved: true });
                          log(tx, "approval", `価格承認：売価 ${yen(r.revenue)}（${money(r.unitPriceFx, deal.currency)}/個）粗利率 ${pct(r.margin)}`, { deal_id: id });
                        },
                        { need: "price.change", ok: "価格を承認しました" },
                      )
                    }
                  >
                    <ShieldCheck size={13} /> 価格承認
                  </Button>
                )}
                <Button size="sm" onClick={() => setCostOpen(true)}>
                  <Calculator size={13} /> 原価計算
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <KV label="Product Cost">{yen(r.producerPayment)}</KV>
              <KV label="Logistics Cost">{yen(r.logisticsPayment)}</KV>
              <KV label="AITREK Fee">{yen(r.fee)}</KV>
              <KV label="Selling Price（1個）">
                <span className="tabular">{money(r.unitPriceFx, deal.currency)}</span>
                <span className="ml-1 text-[11.5px] text-ink-3">{yen(r.unitPrice)}</span>
              </KV>
              <KV label="Revenue">
                <span className="tabular font-semibold">{yen(r.revenue)}</span>
                <span className="block text-[11.5px] text-ink-3">{money(r.revenueFx, deal.currency)}</span>
              </KV>
              <KV label="Gross Profit">
                <span className="tabular font-semibold text-good">{yen(r.profit)}</span>
              </KV>
              <KV label="Margin">
                <span className={cx("tabular font-semibold", r.margin < 0.1 ? "text-warn" : "text-ink")}>{pct(r.margin)}</span>
              </KV>
              <KV label="確度 / 期待粗利">
                {deal.probability}% / {yen(r.profit * (deal.probability / 100))}
              </KV>
            </div>
          </Card>

          <Card
            title="Export Checklist"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run((tx) => generateChecklist(tx, tx.find("deals", id)!, tx.find("products", deal.product_id)), { ok: "Checklist を更新しました" })}
                disabled={!deal.country}
                title="国・商品に応じた不足項目を追加"
              >
                <RefreshCw size={13} /> {hasChecklist ? "不足項目を補完" : "生成"}
              </Button>
            }
          >
            {hasChecklist ? <Checklist dealId={id} /> : <Empty>輸出国を設定すると Checklist を生成できます</Empty>}
          </Card>

          <Card
            title="Documents"
            action={
              <div className="flex gap-2">
                <Link href={`/quotations?new=1&deal=${id}`} className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[12.5px] font-medium hover:bg-surface-2">
                  <FileSpreadsheet size={13} /> Quotation
                </Link>
                <Link href={`/documents?new=proforma_invoice&deal=${id}`} className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[12.5px] font-medium hover:bg-surface-2">
                  <FileText size={13} /> 書類作成
                </Link>
              </div>
            }
          >
            {quotations.length + docs.length === 0 ? (
              <p className="text-[12.5px] text-ink-3">書類はまだありません。Quotation / Invoice / Packing List などを登録データから自動生成できます。</p>
            ) : (
              <ul className="divide-y divide-line">
                {quotations.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-1.5">
                    <Link href={`/quotations/${q.id}`} className="text-[13px] hover:text-accent-2">
                      {q.code}・Quotation
                    </Link>
                    <span className="flex items-center gap-2 text-[12px] text-ink-3">
                      {fmtDate(q.issue_date)} <Badge tone={q.status === "accepted" ? "green" : q.status === "sent" ? "blue" : "gray"}>{q.status}</Badge>
                    </span>
                  </li>
                ))}
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-1.5">
                    <Link href={`/documents/${d.id}`} className="text-[13px] hover:text-accent-2">
                      {d.code}・{docTypeLabel(d.type)}
                    </Link>
                    <span className="flex items-center gap-2 text-[12px] text-ink-3">
                      {fmtDate(d.issue_date)} <Badge>{d.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {DOC_TYPES.filter((t) => t.key !== "quotation").map((t) => (
                <Link key={t.key} href={`/documents?new=${t.key}&deal=${id}`} className="rounded border border-line px-1.5 py-0.5 text-[11.5px] text-ink-2 hover:bg-surface-2">
                  + {t.short}
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Payment" action={<Link href="/finance" className="text-[12.5px] text-accent-2 hover:underline">Finance</Link>}>
            {fin ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KV label="Invoice">{fin.invoice_no}</KV>
                <KV label="請求額">{money(fin.invoice_amount, fin.currency)}</KV>
                <KV label="Payment Due">
                  <span className={financeOverdue(fin) ? "font-semibold text-bad" : ""}>{fmtDate(fin.payment_due)}</span>
                </KV>
                <KV label="入金Status">
                  <Badge tone={fin.status === "paid" ? "green" : financeOverdue(fin) ? "red" : fin.status === "billed" ? "blue" : "gray"}>{paymentStatusLabel(fin.status)}</Badge>
                </KV>
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-3">Contract / Order に進むと Finance レコードが自動作成されます。</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Next Action">
            <NextActionEditor deal={deal} />
            {followups.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
                {followups.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="truncate">・{t.title}</span>
                    <span className={cx("shrink-0 text-[11.5px]", t.due_date < today() ? "text-bad" : "text-ink-3")}>{fmtDate(t.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AiPanel context={{ kind: "deal", deal }} compact />
          <Card title="Activity History">
            <form
              className="mb-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                run((tx) => log(tx, noteType, note.trim(), { deal_id: id }), { ok: "記録しました" });
                setNote("");
              }}
            >
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="商談メモ・電話・Emailの記録" className="min-h-14" />
              <div className="flex gap-2">
                <Select value={noteType} onChange={(e) => setNoteType(e.target.value as typeof noteType)}>
                  <option value="note">メモ</option>
                  <option value="call">電話</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                </Select>
                <Button type="submit">記録</Button>
              </div>
            </form>
            <ActivityFeed items={acts} />
          </Card>
        </div>
      </div>

      {costOpen && <CostModal deal={deal} onClose={() => setCostOpen(false)} />}
      {editOpen && <EditDealModal deal={deal} onClose={() => setEditOpen(false)} />}
    </>
  );
}

function FlowItem({ label, children, href, last }: { label: string; children: ReactNode; href?: string; last?: boolean }) {
  const inner = (
    <div className="flex h-full min-w-28 flex-col rounded-md border border-line bg-surface-2/50 px-3 py-2">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-3">{label}</span>
      <span className={cx("mt-0.5 text-[13px] font-medium", href && "text-accent-2")}>{children || "—"}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5">
      {href ? <Link href={href}>{inner}</Link> : inner}
      {!last && <ChevronRight size={14} className="shrink-0 text-ink-3" />}
    </div>
  );
}

function NextActionEditor({ deal }: { deal: Deal }) {
  const { run } = useStore();
  const [v, setV] = useState({ next_action: deal.next_action, deadline: deal.deadline });
  const dirty = v.next_action !== deal.next_action || v.deadline !== deal.deadline;
  return (
    <div className="flex flex-col gap-2">
      <Input value={v.next_action} onChange={(e) => setV({ ...v, next_action: e.target.value })} placeholder="次にやること" />
      <div className="flex gap-2">
        <Input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} className={cx(v.deadline && v.deadline < today() && "border-bad text-bad")} />
        <Button
          disabled={!dirty}
          onClick={() =>
            run(
              (tx) => {
                tx.update("deals", deal.id, v);
                log(tx, "note", `Next Action 更新：${v.next_action}（期限 ${v.deadline}）`, { deal_id: deal.id });
              },
              { ok: "更新しました" },
            )
          }
        >
          保存
        </Button>
      </div>
    </div>
  );
}

function CostModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const { run, can } = useStore();
  const [cost, setCost] = useState<CostInputs>(deal.cost);
  return (
    <Modal
      open
      onClose={onClose}
      title={`輸出原価計算：${deal.code}`}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-[12px] text-ink-3">保存すると価格は「未承認」に戻り、Owner/Admin の承認が必要です。</span>
          <Button onClick={onClose}>キャンセル</Button>
          <Button
            variant="primary"
            disabled={!can("record.edit")}
            onClick={() => {
              if (run((tx) => (applyCost(tx, deal.id, cost), true), { ok: "原価計算を保存しました" })) onClose();
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <CostSimulator value={cost} onChange={setCost} />
    </Modal>
  );
}

function EditDealModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const { db, run } = useStore();
  const [v, setV] = useState({
    title: deal.title,
    buyer_id: deal.buyer_id ?? "",
    product_id: deal.product_id ?? "",
    country: deal.country,
    incoterm: deal.incoterm,
    payment_terms: deal.payment_terms,
    probability: deal.probability,
    owner_id: deal.owner_id ?? "",
    notes: deal.notes,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Deal 編集"
      footer={
        <>
          <Button onClick={onClose}>キャンセル</Button>
          <Button
            variant="primary"
            onClick={() => {
              const ok = run(
                (tx) => {
                  const product = tx.find("products", v.product_id);
                  tx.update("deals", deal.id, {
                    ...v,
                    buyer_id: v.buyer_id || null,
                    product_id: v.product_id || null,
                    producer_id: product?.producer_id ?? deal.producer_id,
                    owner_id: v.owner_id || null,
                    probability: Number(v.probability),
                    cost: { ...deal.cost, incoterm: v.incoterm },
                  });
                  if (v.incoterm !== deal.incoterm) applyCost(tx, deal.id, { ...deal.cost, incoterm: v.incoterm });
                  log(tx, "note", "Deal情報を更新", { deal_id: deal.id });
                  return true;
                },
                { ok: "保存しました" },
              );
              if (ok) onClose();
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="案件名" className="sm:col-span-2">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Buyer">
          <Select value={v.buyer_id} onChange={(e) => setV({ ...v, buyer_id: e.target.value })}>
            <option value="">—</option>
            {db.buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.company_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product（Producer 自動紐付け）">
          <Select value={v.product_id} onChange={(e) => setV({ ...v, product_id: e.target.value })}>
            <option value="">—</option>
            {db.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country">
          <Select value={v.country} onChange={(e) => setV({ ...v, country: e.target.value })}>
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Incoterms">
          <Select value={v.incoterm} onChange={(e) => setV({ ...v, incoterm: e.target.value as Deal["incoterm"] })}>
            {INCOTERMS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment Terms">
          <Input list="payment-terms" value={v.payment_terms} onChange={(e) => setV({ ...v, payment_terms: e.target.value })} />
          <datalist id="payment-terms">
            {PAYMENT_TERMS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Probability（%）">
          <Input type="number" min={0} max={100} value={v.probability} onChange={(e) => setV({ ...v, probability: Number(e.target.value) })} />
        </Field>
        <Field label="担当">
          <Select value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })}>
            <option value="">—</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="メモ" className="sm:col-span-2">
          <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
