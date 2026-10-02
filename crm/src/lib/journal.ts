// 売上と仕訳。「売上金額 ＝ 仕訳の売上高」を構造で保証し、ずれたら検出する（純関数。社内ポータルの勘定科目コードと合わせる）。
import type { Journal, JournalLine, Sale, SaleLine } from "./types.ts";

/** 社内ポータルの勘定科目コード（portal/src/lib/accounting.ts）に合わせる。4220 為替差損益 は CRM 用に追加（ポータル側にも追加が必要） */
export const ACCT = { 預金: "1120", 売掛金: "1310", 売上高: "4110", 為替差損益: "4220", 支払手数料: "6270" } as const;
export const ACCT_NAME: Record<string, string> = { "1120": "普通預金", "1310": "売掛金", "4110": "売上高", "4220": "為替差損益", "6270": "支払手数料" };

/** 外貨額（明細の合計）。小数誤差を避けるため通貨の最小単位（1/100）に丸める */
export const lineTotal = (l: Pick<SaleLine, "qty" | "unitPrice">) => Math.round(l.qty * l.unitPrice * 100) / 100;
export const linesTotal = (ls: Pick<SaleLine, "qty" | "unitPrice">[]) => Math.round(ls.reduce((a, l) => a + lineTotal(l), 0) * 100) / 100;
/** 円換算：外貨額 × レートの円未満四捨五入（売上・仕訳で同じ式を使う） */
export const toYen = (amount: number, rate: number) => Math.round(amount * rate);

export function saleAmounts(lines: SaleLine[], rate: number) {
  const amount = linesTotal(lines);
  return { amount, amountJPY: toYen(amount, rate) };
}

const nextNo = (n: number, date: string) => `INV-${date.slice(0, 4)}-${String(n).padStart(4, "0")}`;
export const nextSaleNo = (existing: Sale[], date: string) => nextSaleNoFrom(existing.length + 1, date);
const nextSaleNoFrom = nextNo;

/** 売上計上の仕訳：借）売掛金／貸）売上高。輸出売上は免税（消費税 0%）。金額は円換算額と必ず同じ */
export function salesJournal(sale: Sale, partner: string, id: string): Journal {
  const lines: JournalLine[] = [{ account: ACCT.売掛金, side: "D", amount: sale.amountJPY }, { account: ACCT.売上高, side: "C", amount: sale.amountJPY }];
  return { id, date: sale.date, memo: `売上計上 ${sale.no}（${sale.currency} ${sale.amount.toLocaleString("en-US")} @ ${sale.rate}）`, saleId: sale.id, kind: "売上", partner, lines };
}

/** 入金の仕訳：借）普通預金（実入金）＋支払手数料（銀行手数料）＋為替差損／貸）売掛金（計上額）＋為替差益。借方＝貸方になるよう差額を為替差損益に出す */
export function paymentJournal(sale: Sale, partner: string, id: string, date: string, receivedJPY: number, bankFeeJPY: number): Journal {
  const diff = sale.amountJPY - receivedJPY - bankFeeJPY; // 正＝為替差損、負＝為替差益
  const lines: JournalLine[] = [{ account: ACCT.預金, side: "D", amount: receivedJPY }];
  if (bankFeeJPY > 0) lines.push({ account: ACCT.支払手数料, side: "D", amount: bankFeeJPY });
  if (diff > 0) lines.push({ account: ACCT.為替差損益, side: "D", amount: diff });
  lines.push({ account: ACCT.売掛金, side: "C", amount: sale.amountJPY });
  if (diff < 0) lines.push({ account: ACCT.為替差損益, side: "C", amount: -diff });
  return { id, date, memo: `入金 ${sale.no}${diff ? (diff > 0 ? `（為替差損 ${diff}円）` : `（為替差益 ${-diff}円）`) : ""}`, saleId: sale.id, kind: "入金", partner, lines };
}

export const debitTotal = (j: Journal) => j.lines.filter((l) => l.side === "D").reduce((a, l) => a + l.amount, 0);
export const creditTotal = (j: Journal) => j.lines.filter((l) => l.side === "C").reduce((a, l) => a + l.amount, 0);
export const isBalanced = (j: Journal) => debitTotal(j) === creditTotal(j);

export interface Recon {
  saleId: string; no: string; saleJPY: number; journalSalesJPY: number; arDebit: number; ok: boolean; issues: string[];
}
/** 売上と仕訳の照合。①売上高の貸方合計＝売上の円換算額 ②売掛金の借方＝売上の円換算額 ③外貨額＝明細合計 ④円換算＝外貨額×レート ⑤各仕訳の貸借一致 ⑥入金済なら売掛金が全額消込 */
export function reconcile(sales: Sale[], journals: Journal[]): Recon[] {
  return sales.map((s) => {
    const js = journals.filter((j) => j.saleId === s.id);
    const sum = (code: string, side: "D" | "C", kind?: Journal["kind"]) => js.filter((j) => !kind || j.kind === kind).flatMap((j) => j.lines).filter((l) => l.account === code && l.side === side).reduce((a, l) => a + l.amount, 0);
    const journalSalesJPY = sum(ACCT.売上高, "C");
    const arDebit = sum(ACCT.売掛金, "D");
    const arCredit = sum(ACCT.売掛金, "C");
    const issues: string[] = [];
    if (js.filter((j) => j.kind === "売上").length === 0) issues.push("売上の仕訳がありません");
    if (journalSalesJPY !== s.amountJPY) issues.push(`売上高 ${journalSalesJPY.toLocaleString()}円 ≠ 売上 ${s.amountJPY.toLocaleString()}円`);
    if (arDebit !== s.amountJPY) issues.push(`売掛金（借方）${arDebit.toLocaleString()}円 ≠ 売上 ${s.amountJPY.toLocaleString()}円`);
    if (linesTotal(s.lines) !== s.amount) issues.push(`外貨額 ${s.amount} ≠ 明細合計 ${linesTotal(s.lines)}`);
    if (toYen(s.amount, s.rate) !== s.amountJPY) issues.push(`円換算が 外貨額×レート と一致しません`);
    if (js.some((j) => !isBalanced(j))) issues.push("貸借が一致しない仕訳があります");
    if (s.status === "入金済" && arCredit !== s.amountJPY) issues.push(`売掛金の消込 ${arCredit.toLocaleString()}円 ≠ ${s.amountJPY.toLocaleString()}円`);
    return { saleId: s.id, no: s.no, saleJPY: s.amountJPY, journalSalesJPY, arDebit, ok: issues.length === 0, issues };
  });
}

/** ポータルの仕訳取込に合わせた CSV（借方・貸方を1行ずつ） */
export function journalCsvRows(journals: Journal[]): (string | number)[][] {
  const rows: (string | number)[][] = [["仕訳番号", "日付", "借貸", "科目コード", "科目", "金額", "税区分", "取引先", "摘要", "売上番号"]];
  for (const j of journals) for (const l of j.lines) rows.push([j.id, j.date, l.side === "D" ? "借方" : "貸方", l.account, ACCT_NAME[l.account] ?? l.account, l.amount, l.account === ACCT.売上高 ? "対象外（輸出免税）" : "対象外", j.partner, j.memo, j.saleId]);
  return rows;
}

export const monthOf = (date: string) => date.slice(0, 7);
