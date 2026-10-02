// 予定を Google カレンダー / Outlook(Microsoft 365) に追加するリンクと、.ics（iCalendar）の生成。
// OAuth・外部サーバー不要：押した人のブラウザから、その人のカレンダーを開くだけ（データは第三者に自動送信しない）。
export type CalItem = { title: string; date: string; endDate?: string; start?: string; end?: string; note?: string; location?: string };

const TZ = "Asia/Tokyo";
const d8 = (iso: string) => iso.replaceAll("-", "");
const t6 = (hm: string) => hm.replace(":", "").padStart(4, "0") + "00";
const addDay = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };

/** 開始・終了（終日なら date 形式。終日の終了日は翌日を指定する規則）。25:00 のような翌日表記は丸めない前提で、通常の時刻のみ扱う */
function span(e: CalItem) {
  const endDate = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
  if (!e.start) return { allDay: true as const, from: e.date, to: addDay(endDate, 1) };
  const end = e.end && e.end > e.start ? e.end : e.start;
  return { allDay: false as const, from: `${e.date}T${e.start}`, to: `${endDate}T${end}` };
}

export function googleCalendarUrl(e: CalItem): string {
  const sp = span(e);
  const dates = sp.allDay ? `${d8(sp.from)}/${d8(sp.to)}` : `${d8(sp.from.slice(0, 10))}T${t6(sp.from.slice(11))}/${d8(sp.to.slice(0, 10))}T${t6(sp.to.slice(11))}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, ctz: TZ });
  if (e.note) q.set("details", e.note);
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Outlook on the web（Microsoft 365）。個人用は outlook.live.com、会社用は outlook.office.com */
export function outlookCalendarUrl(e: CalItem, host: "outlook.office.com" | "outlook.live.com" = "outlook.office.com"): string {
  const sp = span(e);
  const q = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: e.title, startdt: sp.allDay ? sp.from : `${sp.from}:00`, enddt: sp.allDay ? sp.to : `${sp.to}:00`, ...(sp.allDay ? { allday: "true" } : {}) });
  if (e.note) q.set("body", e.note);
  if (e.location) q.set("location", e.location);
  return `https://${host}/calendar/0/deeplink/compose?${q}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => { const out: string[] = []; let rest = line; while (new TextEncoder().encode(rest).length > 73) { let n = 70; while (new TextEncoder().encode(rest.slice(0, n)).length > 73) n--; out.push(rest.slice(0, n)); rest = " " + rest.slice(n); } out.push(rest); return out.join("\r\n"); };

/** .ics（RFC 5545）。Apple カレンダー・Outlook・Google カレンダー・Thunderbird で開ける */
export function icsOf(items: (CalItem & { id: string })[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//H-LINK//Portal//JA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of items) {
    const sp = span(e);
    lines.push("BEGIN:VEVENT", `UID:${e.id}@hlink-portal`, `DTSTAMP:${stamp}`);
    if (sp.allDay) lines.push(`DTSTART;VALUE=DATE:${d8(sp.from)}`, `DTEND;VALUE=DATE:${d8(sp.to)}`);
    else lines.push(`DTSTART;TZID=${TZ}:${d8(sp.from.slice(0, 10))}T${t6(sp.from.slice(11))}`, `DTEND;TZID=${TZ}:${d8(sp.to.slice(0, 10))}T${t6(sp.to.slice(11))}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
