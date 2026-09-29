"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ROOMS, SLOTS, empById } from "@/lib/data";
import { useStore, ymd } from "@/lib/store";
import { PageHeader } from "@/components/ui";

export default function Rooms() {
  const { s, d, meId } = useStore();
  const [date, setDate] = useState(ymd(new Date()));
  const [pick, setPick] = useState<{ roomId: string; slot: string } | null>(null);
  const [title, setTitle] = useState("");

  const at = (roomId: string, slot: string) => s.bookings.find((b) => b.roomId === roomId && b.date === date && b.slot === slot);
  const book = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pick || at(pick.roomId, pick.slot)) return;
    d({ t: "book", b: { id: `b${Date.now()}`, ...pick, date, title, by: meId } });
    setPick(null); setTitle("");
  };
  return (
    <div>
      <PageHeader title="会議室予約" sub="空きスロットを選んで予約します。ダブルブッキングは自動で防止されます。"
        actions={<input type="date" className="input !w-44" value={date} onChange={(e) => setDate(e.target.value)} aria-label="日付" />} />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-[12.5px]">
          <thead><tr><th className="th w-56">会議室</th>{SLOTS.map((t) => <th key={t} className="th tabular text-center">{t}</th>)}</tr></thead>
          <tbody>
            {ROOMS.map((r) => (
              <tr key={r.id}>
                <td className="td"><div className="font-semibold">{r.name}</div><div className="text-[11.5px] text-ink-3">{r.cap}名・{r.equip.join(" / ")}</div></td>
                {SLOTS.map((t) => {
                  const b = at(r.id, t);
                  const sel = pick?.roomId === r.id && pick.slot === t;
                  return (
                    <td key={t} className="td !p-1">
                      {b ? (
                        <div className={`group relative rounded-md px-1.5 py-1.5 ${b.by === meId ? "bg-brand text-white" : "bg-surface-2 text-ink-2"}`} title={`${b.title}（${empById(b.by)?.name}）`}>
                          <div className="truncate text-[11.5px] font-semibold">{b.title}</div>
                          {b.by === meId && <button aria-label="予約を取り消す" className="absolute right-0.5 top-0.5 hidden rounded bg-white/20 group-hover:block" onClick={() => d({ t: "unbook", id: b.id })}><X size={12} /></button>}
                        </div>
                      ) : (
                        <button aria-label={`${r.name} ${t} を選択`} onClick={() => setPick({ roomId: r.id, slot: t })} className={`h-9 w-full rounded-md border border-dashed ${sel ? "border-brand bg-brand-soft" : "border-line-strong hover:bg-brand-soft"}`} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pick && (
        <form onSubmit={book} className="card mt-4 flex flex-wrap items-end gap-3 p-4">
          <div className="text-[13px]"><div className="text-ink-3">選択中</div><div className="font-semibold">{ROOMS.find((r) => r.id === pick.roomId)?.name}　{date}　{pick.slot}〜（1時間）</div></div>
          <div className="min-w-56 flex-1"><label className="label" htmlFor="bt">会議名</label><input id="bt" required autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <button type="button" className="btn" onClick={() => setPick(null)}>キャンセル</button><button className="btn btn-primary">予約する</button>
        </form>
      )}
    </div>
  );
}
