// 会計ロジック（純粋関数）。日本基準の簡易版：仕訳→試算表→損益計算書・貸借対照表・販管費・消費税。
// 実運用（有価証券報告書・決算短信・法人税申告）では、監査法人・税理士の確認と勘定科目の細分化が必要。
import { append, type Chained } from "./chain.ts";

export type AcctType = "資産" | "負債" | "純資産" | "収益" | "費用";
export type Account = { code: string; name: string; type: AcctType };

export const ACCOUNTS: Account[] = [
  { code: "1110", name: "現金", type: "資産" }, { code: "1120", name: "普通預金", type: "資産" },
  { code: "1310", name: "売掛金", type: "資産" }, { code: "1410", name: "棚卸資産", type: "資産" },
  { code: "1510", name: "仮払消費税", type: "資産" }, { code: "1520", name: "前払費用", type: "資産" },
  { code: "1610", name: "建物", type: "資産" }, { code: "1620", name: "工具器具備品", type: "資産" },
  { code: "1690", name: "減価償却累計額", type: "資産" }, { code: "1710", name: "投資有価証券", type: "資産" },
  { code: "2110", name: "買掛金", type: "負債" }, { code: "2120", name: "未払金", type: "負債" },
  { code: "2130", name: "未払費用", type: "負債" }, { code: "2140", name: "預り金", type: "負債" },
  { code: "2150", name: "仮受消費税", type: "負債" }, { code: "2160", name: "未払法人税等", type: "負債" },
  { code: "2170", name: "未払消費税", type: "負債" }, { code: "2210", name: "長期借入金", type: "負債" },
  { code: "3110", name: "資本金", type: "純資産" }, { code: "3120", name: "資本剰余金", type: "純資産" }, { code: "3130", name: "利益剰余金", type: "純資産" },
  { code: "4110", name: "売上高", type: "収益" }, { code: "4210", name: "受取利息", type: "収益" },
  { code: "5110", name: "売上原価", type: "費用" },
  { code: "6110", name: "給料手当", type: "費用" }, { code: "6120", name: "賞与", type: "費用" }, { code: "6130", name: "法定福利費", type: "費用" },
  { code: "6140", name: "福利厚生費", type: "費用" }, { code: "6210", name: "旅費交通費", type: "費用" }, { code: "6220", name: "通信費", type: "費用" },
  { code: "6230", name: "接待交際費", type: "費用" }, { code: "6240", name: "会議費", type: "費用" }, { code: "6250", name: "消耗品費", type: "費用" },
  { code: "6260", name: "地代家賃", type: "費用" }, { code: "6270", name: "支払手数料", type: "費用" }, { code: "6280", name: "広告宣伝費", type: "費用" },
  { code: "6290", name: "研究開発費", type: "費用" }, { code: "6310", name: "減価償却費", type: "費用" }, { code: "6320", name: "租税公課", type: "費用" },
  { code: "6330", name: "雑費", type: "費用" },
  { code: "7110", name: "支払利息", type: "費用" }, { code: "8110", name: "法人税等", type: "費用" },
];
export const acct = (code: string) => ACCOUNTS.find((a) => a.code === code);
export const isSga = (code: string) => code.startsWith("6");
export const TAX_KINDS = ["課税10%", "軽減8%", "非課税", "不課税", "対象外"] as const;
export type TaxKind = (typeof TAX_KINDS)[number];

export type JLine = { account: string; side: "D" | "C"; amount: number; tax?: TaxKind; dept?: string };
export type JournalCore = {
  id: string; date: string; memo: string; partner?: string; evidenceNo?: string; invoiceNo?: string;
  lines: JLine[]; source: string; createdBy: string; reverses?: string;
};
export type Journal = JournalCore & Chained;
export type Approvals = Record<string, { by: string; at: string }>;

/** 適格請求書発行事業者の登録番号：T + 13桁（先頭のTを除く13桁の最後は検査用数字ではなく法人番号ベースのため形式のみ確認） */
export const isInvoiceNo = (s: string) => /^T\d{13}$/.test(s);

export function checkEntry(j: Pick<JournalCore, "lines" | "date">): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date)) return "日付が不正です";
  if (j.lines.length < 2) return "2行以上の明細が必要です";
  for (const l of j.lines) {
    if (!acct(l.account)) return `未登録の勘定科目: ${l.account}`;
    if (!Number.isInteger(l.amount) || l.amount <= 0) return "金額は1円以上の整数で入力してください";
  }
  const d = j.lines.filter((l) => l.side === "D").reduce((s, l) => s + l.amount, 0);
  const c = j.lines.filter((l) => l.side === "C").reduce((s, l) => s + l.amount, 0);
  if (d !== c) return `貸借が一致しません（借方 ${d.toLocaleString()} / 貸方 ${c.toLocaleString()}）`;
  return null;
}

export const isPosted = (j: Journal, appr: Approvals) => j.source !== "manual" || !!appr[j.id];
export const nextJournalId = (list: Journal[]) => `J-${String(list.length + 1).padStart(6, "0")}`;

export function postJournal(list: Journal[], core: Omit<JournalCore, "id">): Journal[] {
  return append(list, { ...core, id: nextJournalId(list) } as JournalCore) as Journal[];
}

/** 取消：元の仕訳の貸借を反転した「反対仕訳」を追加する（削除・上書きはしない＝電子帳簿保存法の訂正削除履歴） */
export function reversal(orig: Journal, by: string, date: string): Omit<JournalCore, "id"> {
  return { date, memo: `【取消】${orig.memo}（${orig.id}）`, partner: orig.partner, evidenceNo: orig.evidenceNo, invoiceNo: orig.invoiceNo, source: "reversal", createdBy: by, reverses: orig.id,
    lines: orig.lines.map((l) => ({ ...l, side: l.side === "D" ? "C" : "D" })) };
}

// ---------- 集計 ----------
export type Bal = { debit: number; credit: number };
export function balances(list: Journal[], appr: Approvals, from: string | null, to: string) {
  const m = new Map<string, Bal>();
  for (const j of list) {
    if (!isPosted(j, appr) || j.date > to || (from && j.date < from)) continue;
    for (const l of j.lines) {
      const b = m.get(l.account) ?? { debit: 0, credit: 0 };
      if (l.side === "D") b.debit += l.amount; else b.credit += l.amount;
      m.set(l.account, b);
    }
  }
  return m;
}
const net = (a: Account, b?: Bal) => (!b ? 0 : a.type === "資産" || a.type === "費用" ? b.debit - b.credit : b.credit - b.debit);

export type TbRow = { code: string; name: string; type: AcctType; opening: number; debit: number; credit: number; closing: number };
/** 試算表（期首〜to）。opening は from より前の残高（貸借科目のみ） */
export function trialBalance(list: Journal[], appr: Approvals, from: string, to: string): TbRow[] {
  const before = balances(list, appr, null, dayBefore(from)), during = balances(list, appr, from, to);
  return ACCOUNTS.map((a) => {
    const stock = a.type === "資産" || a.type === "負債" || a.type === "純資産";
    const opening = stock ? net(a, before.get(a.code)) : 0;
    const d = during.get(a.code);
    return { code: a.code, name: a.name, type: a.type, opening, debit: d?.debit ?? 0, credit: d?.credit ?? 0, closing: opening + net(a, d) };
  }).filter((r) => r.opening || r.debit || r.credit || r.closing);
}
export function dayBefore(d: string) { const t = new Date(`${d}T00:00:00`); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; }

export type PL = {
  sales: number; cogs: number; grossProfit: number; sga: { code: string; name: string; amount: number }[]; sgaTotal: number; operatingIncome: number;
  nonOpIncome: number; nonOpExpense: number; ordinaryIncome: number; preTaxIncome: number; tax: number; netIncome: number;
};
export function incomeStatement(tb: TbRow[]): PL {
  const v = (c: string) => tb.find((r) => r.code === c)?.closing ?? 0;
  const sga = tb.filter((r) => isSga(r.code)).map((r) => ({ code: r.code, name: r.name, amount: r.closing }));
  const sgaTotal = sga.reduce((s, x) => s + x.amount, 0);
  const sales = v("4110"), cogs = v("5110"), gross = sales - cogs, op = gross - sgaTotal;
  const ordinary = op + v("4210") - v("7110");
  return { sales, cogs, grossProfit: gross, sga, sgaTotal, operatingIncome: op, nonOpIncome: v("4210"), nonOpExpense: v("7110"), ordinaryIncome: ordinary, preTaxIncome: ordinary, tax: v("8110"), netIncome: ordinary - v("8110") };
}

export type BS = { assets: TbRow[]; liabilities: TbRow[]; equity: TbRow[]; currentProfit: number; totalAssets: number; totalLiabilities: number; totalEquity: number; balanced: boolean };
/** 貸借対照表：期首残高（繰越）＋当期純利益を純資産に含める */
export function balanceSheet(list: Journal[], appr: Approvals, fyStart: string, to: string): BS {
  const tb = trialBalance(list, appr, fyStart, to);
  const pl = incomeStatement(tb);
  const pick = (t: AcctType) => tb.filter((r) => r.type === t && r.closing !== 0);
  const assets = pick("資産"), liabilities = pick("負債"), equity = pick("純資産");
  const sum = (r: TbRow[]) => r.reduce((s, x) => s + x.closing, 0);
  const totalAssets = sum(assets), totalLiabilities = sum(liabilities), totalEquity = sum(equity) + pl.netIncome;
  return { assets, liabilities, equity, currentProfit: pl.netIncome, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
}

/** 販管費：勘定科目 × 月 */
export function sgaByMonth(list: Journal[], appr: Approvals, months: string[]) {
  const rows = ACCOUNTS.filter((a) => isSga(a.code)).map((a) => ({ code: a.code, name: a.name, monthly: months.map((mo) => {
    const b = balances(list, appr, `${mo}-01`, `${mo}-31`).get(a.code); return net(a, b);
  }) }));
  return rows.filter((r) => r.monthly.some((x) => x));
}
/** 販管費：部門別（明細の dept タグ） */
export function sgaByDept(list: Journal[], appr: Approvals, from: string, to: string) {
  const m = new Map<string, number>();
  for (const j of list) {
    if (!isPosted(j, appr) || j.date < from || j.date > to) continue;
    for (const l of j.lines) if (isSga(l.account)) m.set(l.dept ?? "（部門未設定）", (m.get(l.dept ?? "（部門未設定）") ?? 0) + (l.side === "D" ? l.amount : -l.amount));
  }
  return [...m.entries()].map(([dept, amount]) => ({ dept, amount })).sort((a, b) => b.amount - a.amount);
}
/** 消費税：仮受−仮払＝納付見込み */
export function consumptionTax(tb: TbRow[]) {
  const out = tb.find((r) => r.code === "2150")?.closing ?? 0, inn = tb.find((r) => r.code === "1510")?.closing ?? 0;
  return { output: out, input: inn, payable: out - inn };
}
export const monthsOfFy = (fyStart: string, upTo: string) => {
  const out: string[] = []; const d = new Date(`${fyStart}T00:00:00`); const end = upTo.slice(0, 7);
  for (let i = 0; i < 12; i++) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; if (k > end) break; out.push(k); d.setMonth(d.getMonth() + 1); }
  return out;
};
export const fyStartOf = (date: string) => { const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)); return `${m >= 4 ? y : y - 1}-04-01`; };

/** 承認済みの経費・出張から自動作成する仕訳（適格請求書の登録番号がなければ仕入税額控除しない） */
export function workflowJournal(w: { type: string; amount?: number; category?: string; taxKind?: string; invoiceNo?: string; title: string; id: string }, job: string | undefined, date: string): Omit<JournalCore, "id"> | null {
  if ((w.type !== "経費精算" && w.type !== "出張申請") || !w.amount) return null;
  const code = w.category && acct(w.category) ? w.category : "6210";
  const taxable = (w.taxKind ?? "課税10%") === "課税10%" && !!w.invoiceNo && isInvoiceNo(w.invoiceNo); // 適格請求書がなければ仕入税額控除しない
  const tax = taxable ? Math.round((w.amount * 10) / 110) : 0;
  return {
    date, memo: `${w.type}：${w.title}`, evidenceNo: w.id, invoiceNo: w.invoiceNo, source: "workflow", createdBy: "system",
    lines: [{ account: code, side: "D", amount: w.amount - tax, tax: taxable ? "課税10%" : "対象外", dept: job }, ...(tax ? [{ account: "1510", side: "D" as const, amount: tax }] : []), { account: "2120", side: "C", amount: w.amount }],
  };
}

