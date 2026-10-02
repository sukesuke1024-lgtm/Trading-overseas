import type { Rating } from "@/lib/credit";

export const RATING_STYLE: Record<Rating, string> = { S: "bg-[#17784a] text-white", A: "bg-[#2f8f5f] text-white", B: "bg-[#c47a1c] text-white", C: "bg-[#d0572f] text-white", D: "bg-[#c0362c] text-white", NG: "bg-[#17171a] text-white" };
export function RatingBadge({ r, size = "md" }: { r: Rating | null; size?: "md" | "lg" }) {
  if (!r) return <span className="chip chip-warn">未審査</span>;
  return <span className={`inline-grid place-items-center rounded-lg font-bold ${RATING_STYLE[r]} ${size === "lg" ? "h-14 w-14 text-[26px]" : "h-7 min-w-7 px-1.5 text-[14px]"}`}>{r}</span>;
}
