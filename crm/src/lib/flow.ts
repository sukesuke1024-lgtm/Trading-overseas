// 「契約に進むか／撤退するか」の判定フロー。決済条件・保証会社（貿易保険）・L/C・前払いの有無などで自動分岐する（純関数）。
// フロー図の描画（レイアウト）もここで計算し、辿った経路をハイライトする。

export type EndKind = "go" | "judge" | "conditional" | "stop" | "hold";
export interface Option { label: string; next: string; cond?: string; note?: string }
export interface QNode { id: string; kind: "q"; text: string; help: string; options: Option[] }
export interface ENode { id: string; kind: "end"; end: EndKind; text: string; help: string }
export type FlowNode = QNode | ENode;

const q = (id: string, text: string, help: string, options: Option[]): QNode => ({ id, kind: "q", text, help, options });
const e = (id: string, end: EndKind, text: string, help: string): ENode => ({ id, kind: "end", end, text, help });

export const START = "pay";
export const FLOW: FlowNode[] = [
  q("pay", "決済条件は？", "代金をいつ・どう受け取るかで、回収リスクが大きく変わります。", [
    { label: "前払い（T/T 全額）", next: "adv" },
    { label: "一部前払い（残金は船積後）", next: "part" },
    { label: "L/C（信用状）決済", next: "lc" },
    { label: "D/P（支払渡し）", next: "dp" },
    { label: "D/A・O/A（後払い）", next: "hist" },
  ]),
  q("adv", "全額の入金を確認してから出荷できる？", "入金前に出荷すると、実質『後払い』になります。", [
    { label: "入金確認後に出荷する", next: "reg" },
    { label: "入金前に出荷が必要", next: "hist", cond: "全額前払いの約束でも入金前に出荷する場合は『後払い』扱いで与信を行う" },
  ]),
  q("part", "前払いの比率は？", "前払いが原価＋諸費用をカバーしていれば、最悪でも赤字を避けられます。", [
    { label: "50%以上", next: "reg", cond: "残金は B/L コピー送付後◯日以内の入金条件を契約書に明記" },
    { label: "30%以上50%未満", next: "guar" },
    { label: "30%未満", next: "hist" },
  ]),
  q("lc", "L/C の発行銀行は？", "信用状は『銀行が支払いを約束する』仕組み。銀行の信用力が大事です。", [
    { label: "大手・格付けの高い銀行", next: "lcdocs" },
    { label: "中小・新興国の銀行（確認なし）", next: "lcconf" },
  ]),
  q("lcconf", "日本の銀行に確認（コンファーム）をつけられる？", "確認をつけると、発行銀行が破綻しても日本の銀行が支払います（手数料はかかります）。", [
    { label: "つけられる", next: "lcdocs", cond: "確認手数料を販売価格に織り込む（計算機の『決済手数料』に入力）" },
    { label: "つけられない", next: "guar", cond: "確認なし L/C は発行銀行リスクが残るため、貿易保険で補う" },
  ]),
  q("lcdocs", "L/C が求める書類を、すべて提出できる？", "書類の不備（ディスクレ）があると、L/C があっても支払われません。", [
    { label: "すべて提出できる", next: "reg", cond: "L/C 条件と書類のチェックリストを船積前に作成し、ダブルチェックする" },
    { label: "一部むずかしい", next: "lcamend" },
  ]),
  q("lcamend", "L/C の条件変更（アメンド）を依頼できる？", "条件を満たせないなら、先にアメンドを依頼します。", [
    { label: "依頼でき、承諾済み／承諾見込み", next: "reg", cond: "アメンド承認を書面で確認してから船積みする" },
    { label: "依頼できない", next: "stop_lc" },
  ]),
  q("dp", "荷受人が受け取らなかった場合の手当（返送・転売先）はある？", "D/P は代金と引換えに書類を渡しますが、受取拒否のリスクがあります。", [
    { label: "手当あり（現地代理店・転売先など）", next: "guar", cond: "引受拒否時の保管・返送費用の負担先を契約で決めておく" },
    { label: "手当なし", next: "stop_dp" },
  ]),
  q("hist", "この取引先との取引実績は？", "初回の後払いはリスクが最も高い取引です。", [
    { label: "実績あり・支払遅延なし", next: "guar" },
    { label: "実績あり・遅延あり", next: "guar", cond: "過去の支払遅延があるため、支払期日を短くし、一部前払いを求める" },
    { label: "初回（実績なし）", next: "guar", cond: "初回取引のため、初回は少額・短期の支払条件にする" },
  ]),
  q("guar", "保証会社・貿易保険（NEXI など）で付保できる？", "付保できれば、買い手が支払えない場合も一定割合が補償されます。", [
    { label: "付保できる（承認済み）", next: "limit" },
    { label: "審査中", next: "hold_guar" },
    { label: "付保できない・対象外", next: "report" },
  ]),
  q("report", "信用調査レポート（調査会社など）の結果は？", "財務・支払状況・訴訟履歴などから、取引先の信用力を確認します。", [
    { label: "良好", next: "small", cond: "保証なしの取引のため、取引上限額を設定し、超えたら出荷停止" },
    { label: "普通", next: "small", cond: "前払いの一部（30%以上）への条件変更を交渉する" },
    { label: "懸念あり", next: "stop_credit" },
    { label: "未取得", next: "hold_report" },
  ]),
  q("small", "取引金額は『保証なしでも許容できる少額』？（社内基準：100万円以下）", "保証がない後払いは、万一回収できなくても耐えられる金額に抑えます。", [
    { label: "100万円以下", next: "reg", cond: "少額でも回収期限と督促日を Next Action に登録する" },
    { label: "100万円超", next: "stop_big" },
  ]),
  q("limit", "取引金額は自社の与信限度内？（社内基準：年間取引先ごとの与信枠）", "与信枠を超える場合は、分割出荷や前払い比率の引き上げで調整します。", [
    { label: "限度内", next: "reg" },
    { label: "限度を超える", next: "reg", cond: "与信枠超過のため、分割出荷または前払い比率の引き上げ、上長・役員の事前承認を得る" },
  ]),
  q("reg", "輸入規制・検疫・必要な許可（HACCP・ハラール・植物防疫・動物検疫など）は満たせる？", "規制を満たせないと、契約しても出荷できません。", [
    { label: "すべて満たせる／取得見込み", next: "margin" },
    { label: "満たせない", next: "stop_reg" },
  ]),
  q("margin", "最低粗利率（社内基準：15%）を確保できる？（『自動計算』で確認）", "決済手数料・保険・為替コストを引いた後の粗利率で判断します。", [
    { label: "確保できる（15%以上）", next: "fx" },
    { label: "やや下回る（10〜15%）", next: "fx", cond: "粗利率が基準を下回るため、上長の承認を得る（価格または数量の見直しも検討）" },
    { label: "10%未満", next: "stop_margin" },
  ]),
  q("fx", "為替リスクの手当は？", "売上が外貨のとき、円高になると円での手取りが減ります。", [
    { label: "為替予約済み／円建て", next: "judge" },
    { label: "予約できる（成約後すぐ予約する）", next: "judge", cond: "契約成立後、すぐに為替予約を入れる（為替予約ページで登録）" },
    { label: "手当なし（レート変動を受ける）", next: "judge", cond: "為替予約をしない場合、レートが5円動いたときの影響額を確認し、粗利に余裕を持たせる" },
  ]),
  e("judge", "judge", "契約へ進む", "ここまでの条件を満たしています。"),
  e("hold_guar", "hold", "保留：保険・保証の審査結果を待つ", "審査結果が出るまで契約・出荷は進めません。結果が出たらこのフローを再実施。"),
  e("hold_report", "hold", "保留：信用調査レポートを取得する", "調査レポートを取得してから判断します（目安：数営業日）。"),
  e("stop_lc", "stop", "撤退：書類条件を満たせない L/C", "条件を満たせないL/Cは不払いリスクが高く、撤退（または条件変更後に再検討）。"),
  e("stop_dp", "stop", "撤退：受取拒否時の手当がない D/P", "返送・保管費を負うリスクが大きく、撤退。前払いまたはL/Cに条件変更できれば再検討。"),
  e("stop_credit", "stop", "撤退：信用に懸念がある取引先（保証なし）", "保証がなく、信用にも懸念がある取引は撤退。前払い100%またはL/Cなら再検討。"),
  e("stop_big", "stop", "撤退：保証なしの大口・後払い", "保証がない大口の後払いは、回収不能時の損失が大きすぎるため撤退。付保・前払い・L/Cへの変更で再検討。"),
  e("stop_reg", "stop", "撤退：輸入規制・許可を満たせない", "出荷できない契約は結べません。許可・認証が取れる見込みが立ってから再検討。"),
  e("stop_margin", "stop", "撤退：粗利率が10%未満", "手数料・為替の変動で赤字になりやすく撤退。価格・数量・条件の見直しで再検討。"),
];

export const byId = (id: string) => FLOW.find((n) => n.id === id)!;

export interface Answer { node: string; option: number }
export interface Result { kind: EndKind; label: string; result: "go" | "conditional" | "stop" | "hold"; conditions: string[]; path: string[]; endNode: string; approval: string | null }

/** 回答の並びから、結果（GO／条件付きGO／保留／撤退）を求める。金額が大きい場合は役員承認を付ける */
export function evaluate(answers: Answer[], amountJPY = 0, approvalLimitJPY = 5_000_000): Result | null {
  let id = START; const conditions: string[] = []; const path: string[] = [];
  for (const a of answers) {
    const n = byId(id);
    if (n.kind !== "q" || n.id !== a.node) return null;
    const o = n.options[a.option];
    if (!o) return null;
    path.push(`${n.text} → ${o.label}`);
    if (o.cond) conditions.push(o.cond);
    id = o.next;
  }
  const n = byId(id);
  if (n.kind === "q") return null;
  let result: Result["result"] = n.end === "stop" ? "stop" : n.end === "hold" ? "hold" : conditions.length > 0 ? "conditional" : "go";
  let approval: string | null = null;
  if ((result === "go" || result === "conditional") && amountJPY >= approvalLimitJPY) {
    approval = `取引金額が ${approvalLimitJPY.toLocaleString()}円以上のため、契約前に上長・役員の承認を得る`;
    if (result === "go") result = "conditional";
    conditions.push(approval);
  }
  const label = result === "go" ? "契約へ進む（GO）" : result === "conditional" ? "条件付きで契約へ進む（条件付きGO）" : result === "hold" ? n.text : n.text;
  return { kind: n.end, label, result, conditions, path, endNode: id, approval };
}

/** 現在地（次に聞く質問）。終端なら null */
export function currentNode(answers: Answer[]): FlowNode | null {
  let id = START;
  for (const a of answers) { const n = byId(id); if (n.kind !== "q") return null; id = n.options[a.option]?.next ?? id; }
  return byId(id);
}

// ---- フロー図のレイアウト（左→右。深さ＝列、同じ深さの中は上から順）----
export interface Placed { id: string; x: number; y: number; w: number; h: number }
export interface Edge { from: string; to: string; label: string; points: [number, number][] }
export function layout() {
  const depth = new Map<string, number>(); depth.set(START, 0);
  // 最長経路の深さで列を決める（複数の親から合流するノードは右側に置く）
  for (let pass = 0; pass < FLOW.length; pass++) for (const n of FLOW) if (n.kind === "q" && depth.has(n.id)) for (const o of n.options) { const d = (depth.get(n.id) ?? 0) + 1; if ((depth.get(o.next) ?? -1) < d) depth.set(o.next, d); }
  const cols = new Map<number, string[]>();
  for (const n of FLOW) { const d = depth.get(n.id) ?? 0; cols.set(d, [...(cols.get(d) ?? []), n.id]); }
  const W = 210, H = 64, GX = 70, GY = 22;
  const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
  const placed = new Map<string, Placed>();
  for (const [d, ids] of cols) {
    const colH = ids.length * H + (ids.length - 1) * GY;
    const total = maxRows * H + (maxRows - 1) * GY;
    ids.forEach((id, i) => placed.set(id, { id, x: 20 + d * (W + GX), y: 20 + (total - colH) / 2 + i * (H + GY), w: W, h: H }));
  }
  const edges: Edge[] = [];
  for (const n of FLOW) if (n.kind === "q") for (const o of n.options) {
    const a = placed.get(n.id)!, b = placed.get(o.next)!;
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    const mx = x1 + (x2 - x1) / 2 - 0;
    edges.push({ from: n.id, to: o.next, label: o.label, points: [[x1, y1], [mx, y1], [mx, y2], [x2, y2]] });
  }
  const width = 20 + (Math.max(...depth.values()) + 1) * (W + GX) - GX + 20;
  const height = 20 + maxRows * H + (maxRows - 1) * GY + 20;
  return { placed, edges, width, height };
}
