// 職務権限規程（承認ルートの自動分岐）。中小企業の標準的な水準を既定値とし、管理者が金額の区切りと承認者を編集できる。
// サーバー側でも同じ関数で承認ルートを再計算し、申請者が弱いルートを選べないようにする。
import type { Employee, WfStep, WfType } from "./data.ts";
import { PRESIDENT_ID } from "./data.ts";

export const APPROVERS = ["所属長", "部長", "管理部", "役員", "社長"] as const;
export type Approver = (typeof APPROVERS)[number];
/** amount 以上の申請に steps の順で承認が必要（種別ごとに、該当する中で最も大きい min の行を使う） */
export type AuthorityRule = { type: WfType; min: number; steps: Approver[] };

export const APPROVER_DESC: Record<Approver, string> = {
  所属長: "申請者の上司（従業員マスタの「上司」）",
  部長: "上司をたどって最初に見つかる部長・本部長・取締役等",
  管理部: "管理者（人事・経理・総務）。申請者本人は除く",
  役員: "役員（権限が「役員」の人）。申請者本人は除く",
  社長: "代表取締役",
};

export const DEFAULT_AUTHORITY: AuthorityRule[] = [
  { type: "経費精算", min: 0, steps: ["所属長"] },
  { type: "経費精算", min: 30_000, steps: ["所属長", "管理部"] },
  { type: "経費精算", min: 1_000_000, steps: ["所属長", "管理部", "役員"] },
  { type: "経費精算", min: 5_000_000, steps: ["所属長", "管理部", "役員", "社長"] },
  { type: "稟議", min: 0, steps: ["所属長"] },
  { type: "稟議", min: 100_000, steps: ["所属長", "管理部"] },
  { type: "稟議", min: 1_000_000, steps: ["所属長", "管理部", "役員"] },
  { type: "稟議", min: 5_000_000, steps: ["所属長", "管理部", "役員", "社長"] },
  { type: "出張申請", min: 0, steps: ["所属長"] },
  { type: "出張申請", min: 100_000, steps: ["所属長", "管理部"] },
  { type: "出張申請", min: 1_000_000, steps: ["所属長", "管理部", "役員"] },
  { type: "休暇申請", min: 0, steps: ["所属長", "管理部"] },
  { type: "IT機器・アカウント申請", min: 0, steps: ["所属長", "管理部"] },
  { type: "IT機器・アカウント申請", min: 500_000, steps: ["所属長", "管理部", "役員"] },
  { type: "異動変更届", min: 0, steps: ["管理部"] },
];

/** 申請の種別・金額に当てはまる規程の行 */
export function ruleFor(rules: AuthorityRule[], type: WfType, amount: number): AuthorityRule | undefined {
  return rules.filter((r) => r.type === type && r.min <= amount).sort((a, b) => b.min - a.min)[0];
}

const MANAGER_JOBS = ["部長", "本部長", "取締役", "執行役員", "代表取締役"];

function resolve(a: Approver, list: Employee[], applicant: Employee | undefined): Employee | undefined {
  const byId = (id?: string) => list.find((e) => e.id === id && !e.left);
  const others = list.filter((e) => e.id !== applicant?.id && !e.left);
  switch (a) {
    case "所属長": return byId(applicant?.bossId);
    case "部長": {
      const seen = new Set<string>();
      for (let b = byId(applicant?.bossId); b && !seen.has(b.id); b = byId(b.bossId)) { seen.add(b.id); if (MANAGER_JOBS.includes(b.job) || b.role !== "employee") return b; }
      return undefined;
    }
    case "管理部": return others.find((e) => e.role === "admin" && e.id !== PRESIDENT_ID) ?? others.find((e) => e.role === "admin");
    case "役員": return others.find((e) => e.role === "executive") ?? others.find((e) => e.id === PRESIDENT_ID);
    case "社長": return byId(PRESIDENT_ID);
  }
}
const LABEL: Record<Approver, string> = { 所属長: "所属長", 部長: "部長", 管理部: "管理部", 役員: "役員決裁", 社長: "社長決裁" };

/** 承認ルートを計算する。申請者本人・重複する承認者は除き、誰もいなければ社長（社長本人の申請は自己決裁）にする */
export function routeFor(list: Employee[], rules: AuthorityRule[], type: WfType, amount: number | undefined, applicantId: string): WfStep[] {
  const applicant = list.find((e) => e.id === applicantId);
  const rule = ruleFor(rules, type, amount ?? 0);
  const out: WfStep[] = [];
  const seen = new Set<string>([applicantId]);
  for (const a of rule?.steps ?? ["管理部"]) {
    const e = resolve(a, list, applicant);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push({ approverId: e.id, label: LABEL[a], state: out.length === 0 ? "承認待ち" : "待機" });
  }
  if (out.length === 0) {
    const pres = list.find((e) => e.id === PRESIDENT_ID && e.id !== applicantId) ?? list.find((e) => e.role === "admin" && e.id !== applicantId);
    return [{ approverId: pres?.id ?? applicantId, label: pres ? "社長決裁" : "代表者（自己決裁）", state: "承認待ち" }];
  }
  return out;
}
export const sameRoute = (a: WfStep[], b: WfStep[]) => a.length === b.length && a.every((x, i) => x.approverId === b[i].approverId && x.label === b[i].label);

export const yenJp = (n: number) => (n >= 10000 ? `${n / 10000}万円` : `${n}円`);
export function describeRule(r: AuthorityRule, next?: AuthorityRule) {
  return `${r.min === 0 ? "金額に関わらず" : `${yenJp(r.min)}以上`}${next ? `〜${yenJp(next.min)}未満` : ""}：${r.steps.join(" → ")}`;
}
