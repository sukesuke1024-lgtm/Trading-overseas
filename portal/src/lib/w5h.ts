// 5W1H（いつ・どこで・誰が・何を・なぜ・どのように）への正規化。
// 勤怠（打刻）・ワークフロー（申請/承認）・手入力の記録を、同じ6項目の「出来事」にそろえて可視化・出力する。
import { calcDay, fmtHM } from "./attendance-calc.ts";
import { toCsv } from "./csv.ts";

export type LogRec = { id: string; by: string; start: string; end?: string; where: string; who: string; what: string; why: string; how: string; category: string };
export const CATEGORIES = ["作業", "会議", "移動", "連絡・調整", "学習", "その他"] as const;

export type W5H = {
  id: string;
  when: string; // YYYY-MM-DD もしくは YYYY-MM-DDTHH:mm
  until?: string;
  where: string; who: string; what: string; why: string; how: string;
  category: string; // 勤務 / 申請 / 承認 / 手入力の分類
  source: "punch" | "workflow" | "manual";
  minutes: number;
};

type PunchLike = { in?: string; out?: string; break?: number; place?: string; who?: string; what?: string; why?: string; how?: string; edited?: boolean };
type WfLike = { id: string; type: string; title: string; applicantId: string; detail: string; createdAt: string; amount?: number; w5h?: { when?: string; where?: string; who?: string; how?: string }; steps: { approverId: string; label: string; state: string; at?: string; comment?: string }[] };
export type Src = {
  meId: string;
  name: (id: string) => string;
  punches: Record<string, PunchLike>;
  workflows: WfLike[];
  logs: LogRec[];
};

const mins = (a?: string, b?: string) => {
  if (!a || !b) return 0;
  const t = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s).getTime();
  const d = Math.round((t(b) - t(a)) / 60000);
  return d > 0 ? d : 0;
};

export function buildEvents(src: Src, from: string, to: string): W5H[] {
  const out: W5H[] = [];
  const inRange = (d: string) => d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const me = src.name(src.meId);

  for (const [date, p] of Object.entries(src.punches)) {
    if (!inRange(date) || !p.in) continue;
    const c = calcDay(date, p);
    out.push({
      id: `punch-${date}`, when: `${date}T${p.in}`, until: p.out ? `${date}T${p.out}` : undefined,
      where: p.place ?? "オフィス", who: p.who ? `${me}／${p.who}` : me, what: p.what || "勤務",
      why: p.why || (c.overtime > 0 ? `所定労働（時間外 ${fmtHM(c.overtime)}）` : c.kind === "workday" ? "所定労働" : "休日労働"),
      how: p.how || `ポータルで打刻${p.edited ? "（修正あり）" : ""}／休憩${c.breakMin}分`,
      category: "勤務", source: "punch", minutes: c.work,
    });
  }

  for (const w of src.workflows) {
    const applicant = src.name(w.applicantId), route = w.steps.map((s) => src.name(s.approverId)).join(" → ");
    if (w.applicantId === src.meId && inRange(w.createdAt)) {
      const f = w.w5h ?? {};
      out.push({ id: `wf-${w.id}-apply`, when: f.when ? `${w.createdAt}` : w.createdAt, where: f.where || "ワークフロー", who: `${applicant} → ${route}${f.who ? `／関係者：${f.who}` : ""}`, what: `申請：${w.title}`, why: w.detail, how: f.how || `${w.type}${w.amount ? `（${w.amount.toLocaleString("ja-JP")}円）` : ""}として申請`, category: "申請", source: "workflow", minutes: 0 });
    }
    w.steps.forEach((s, i) => {
      if (s.approverId !== src.meId || !s.at || !inRange(s.at)) return;
      out.push({ id: `wf-${w.id}-step${i}`, when: s.at, where: "ワークフロー", who: `${me}（${s.label}）← ${applicant}`, what: `${s.state}：${w.title}`, why: s.comment ? `${w.detail}／コメント：${s.comment}` : w.detail, how: `${w.type}の承認フロー`, category: "承認", source: "workflow", minutes: 0 });
    });
  }

  for (const l of src.logs) {
    if (l.by !== src.meId || !inRange(l.start)) continue;
    out.push({ id: l.id, when: l.start, until: l.end || undefined, where: l.where, who: l.who || me, what: l.what, why: l.why, how: l.how, category: l.category, source: "manual", minutes: mins(l.start, l.end) });
  }
  return out.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
}

export type Tally = { key: string; count: number; minutes: number };
export function tally(events: W5H[], pick: (e: W5H) => string[]): Tally[] {
  const m = new Map<string, Tally>();
  for (const e of events) for (const k of pick(e)) { const t = m.get(k) ?? { key: k, count: 0, minutes: 0 }; t.count++; t.minutes += e.minutes; m.set(k, t); }
  return [...m.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count);
}
export const people = (who: string) => who.split(/[、,→←／]/).map((s) => s.replace(/（.*?）/g, "").trim()).filter(Boolean);

const disp = (s?: string) => (s ? s.replace("T", " ") : "");

/** Notion の「CSVからインポート」でそのまま取り込める列構成（先頭列＝タイトル） */
export function notionCsv(events: W5H[]) {
  return toCsv(["何を（件名）", "いつ", "終了", "どこで", "誰が", "なぜ", "どのように", "分類", "所要分"], events.map((e) => [e.what, disp(e.when), disp(e.until), e.where, e.who, e.why, e.how, e.category, e.minutes || ""]));
}

export function markdown(events: W5H[], title: string) {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [`# ${title}`, "", "| いつ | どこで | 誰が | 何を | なぜ | どのように |", "|---|---|---|---|---|---|", ...events.map((e) => `| ${disp(e.when)}${e.until ? `〜${e.until.slice(11)}` : ""} | ${esc(e.where)} | ${esc(e.who)} | ${esc(e.what)} | ${esc(e.why)} | ${esc(e.how)} |`), ""].join("\n");
}
