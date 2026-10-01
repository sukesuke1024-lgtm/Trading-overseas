"use client";

import { Printer } from "lucide-react";
import { COMPANY } from "@/lib/data";
import { useStore } from "@/lib/store";

export type Unit = 1 | 1000 | 1_000_000;
export const UNIT_LABEL: Record<Unit, string> = { 1: "円", 1000: "千円", 1_000_000: "百万円" };
export const amt = (n: number, unit: Unit = 1) => {
  const v = unit === 1 ? n : Math.round(n / unit);
  return v < 0 ? `△${Math.abs(v).toLocaleString("ja-JP")}` : v.toLocaleString("ja-JP");
};

export function UnitSelect({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">単位
      <select className="input !h-8 !w-auto" value={unit} onChange={(e) => onChange(Number(e.target.value) as Unit)}>{([1, 1000, 1_000_000] as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
    </label>
  );
}

/** 印刷・PDF保存ボタン（ブラウザの印刷ダイアログ →「PDFとして保存」でPDF化）。出力操作は監査ログに残す */
export function PrintButton({ what }: { what: string }) {
  const { d, meId } = useStore();
  return (
    <button className="btn no-print print:hidden" onClick={() => { d({ t: "export-log", by: meId, what: `印刷/PDF: ${what}` }); setTimeout(() => window.print(), 50); }}>
      <Printer size={15} />印刷 / PDF保存
    </button>
  );
}

/** 印刷時のみ表示する帳票ヘッダー（会社名・帳票名・期間・出力日時・出力者・機密区分） */
export function PrintHeader({ title, period }: { title: string; period?: string }) {
  const { meId, nameOf } = useStore();
  return (
    <div className="mb-4 hidden border-b border-black pb-2 print:block">
      <div className="flex items-end justify-between"><div><div className="text-[11px]">{COMPANY.name}</div><div className="text-[20px] font-bold">{title}</div></div><div className="text-right text-[10px]">{period && <div>{period}</div>}<div>出力日時：{new Date().toLocaleString("ja-JP")}</div><div>出力者：{nameOf(meId)}（{meId}）</div><div className="font-bold">社外秘（Confidential）</div></div></div>
    </div>
  );
}
