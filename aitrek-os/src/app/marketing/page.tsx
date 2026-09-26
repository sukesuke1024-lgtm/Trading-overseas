"use client";

import Link from "next/link";
import { useState } from "react";
import { Printer } from "lucide-react";
import { AiPanel } from "@/components/ai-panel";
import { Badge, Button, Card, PageHeader, Select, Table, Tabs } from "@/components/ui";
import { countryLabel } from "@/lib/constants";
import { fmtDate, today } from "@/lib/format";
import { useStore } from "@/lib/store/store";

type Tab = "ai" | "outreach" | "catalog";

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("ai");
  return (
    <>
      <div className="no-print">
        <PageHeader title="Marketing" subtitle="AIによる営業支援・Buyer Outreach・多言語商品カタログ" />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "ai", label: "AI Workspace" },
            { key: "outreach", label: "Buyer Outreach" },
            { key: "catalog", label: "多言語Catalog" },
          ]}
        />
      </div>
      <div className="mt-4">{tab === "ai" ? <AiWorkspace /> : tab === "outreach" ? <Outreach /> : <Catalog />}</div>
    </>
  );
}

function AiWorkspace() {
  const { db } = useStore();
  const [dealId, setDealId] = useState(db.deals[0]?.id ?? "");
  const [buyerId, setBuyerId] = useState(db.buyers[0]?.id ?? "");
  const deal = db.deals.find((d) => d.id === dealId);
  const buyer = db.buyers.find((b) => b.id === buyerId);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-gold/30 bg-[#faf6ec] px-4 py-3 text-[12.5px] text-[#6b5424]">
        AI の出力はすべて下書きです。契約締結・金銭支払・値決めの最終承認・法務/税務判断・規制適合の最終判断は AI 単独で確定せず、必ず人間が承認します。
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AiPanel context={{ kind: "global" }} defaultTask="weekly_report" />
        <div className="flex flex-col gap-2">
          <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            {db.buyers.map((b) => (
              <option key={b.id} value={b.id}>
                Buyer：{b.company_name}
              </option>
            ))}
          </Select>
          {buyer && <AiPanel key={buyer.id} context={{ kind: "buyer", buyer }} />}
        </div>
        <div className="flex flex-col gap-2">
          <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
            {db.deals.map((d) => (
              <option key={d.id} value={d.id}>
                Deal：{d.code} {d.title}
              </option>
            ))}
          </Select>
          {deal && <AiPanel key={deal.id} context={{ kind: "deal", deal }} />}
        </div>
      </div>
    </div>
  );
}

function Outreach() {
  const { db } = useStore();
  const now = today();
  const rows = [...db.buyers].sort((a, b) => (a.next_contact_at || "9").localeCompare(b.next_contact_at || "9"));
  return (
    <Card pad={false} title="Contact 予定（次回Contact日順）">
      <Table>
        <thead>
          <tr>
            <th>Buyer</th>
            <th>国</th>
            <th>Status</th>
            <th>最終接触</th>
            <th>次回Contact</th>
            <th>希望商品</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>
                <Link href={`/buyers/${b.id}`} className="font-medium hover:text-accent-2">
                  {b.company_name}
                </Link>
              </td>
              <td>{countryLabel(b.country)}</td>
              <td>
                <Badge>{b.status}</Badge>
              </td>
              <td>{fmtDate(b.last_contact_at)}</td>
              <td className={b.next_contact_at && b.next_contact_at < now ? "font-semibold text-bad" : b.next_contact_at === now ? "font-semibold text-warn" : ""}>{fmtDate(b.next_contact_at)}</td>
              <td className="max-w-72 truncate">{b.desired_products}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Catalog() {
  const { db, settings } = useStore();
  const [lang, setLang] = useState<"en" | "zh" | "ko">("en");
  const products = db.products.filter((p) => ["販売中", "輸出可能"].includes(p.status));
  const desc = (p: (typeof products)[number]) => (lang === "en" ? p.description_en : lang === "zh" ? p.description_zh : p.description_ko) || p.description_en;
  return (
    <>
      <div className="no-print mb-3 flex gap-2">
        <Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="w-40">
          <option value="en">English</option>
          <option value="zh">简体中文</option>
          <option value="ko">한국어</option>
        </Select>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={14} /> PDF出力
        </Button>
      </div>
      <div className="print-area rounded-lg border border-line bg-white p-8">
        <div className="mb-6 border-b-2 border-[#1f3a5f] pb-3">
          <div className="text-[20px] font-bold text-[#1f3a5f]">{settings.company_name_en}</div>
          <div className="text-[12px] text-neutral-500">{lang === "en" ? "Hokkaido Product Catalog" : lang === "zh" ? "北海道商品目录" : "홋카이도 상품 카탈로그"}</div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="flex gap-3 break-inside-avoid rounded border border-neutral-200 p-3">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-24 w-24 shrink-0 rounded object-cover" />
              ) : (
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded bg-neutral-100 text-[11px] text-neutral-400">{p.category}</div>
              )}
              <div className="min-w-0 text-[11.5px]">
                <div className="text-[13px] font-semibold">{p.name_en || p.name}</div>
                <div className="text-neutral-500">{p.name}</div>
                <p className="mt-1 line-clamp-3">{desc(p)}</p>
                <div className="mt-1 text-neutral-500">
                  {p.net_content} ・ {p.storage} ・ {p.shelf_life} ・ MOQ {p.moq ?? "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
