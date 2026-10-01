import { json } from "@/server/session";
import { peekReset } from "@/server/reset";

export const dynamic = "force-dynamic";
/** リンクの有効性の確認（本人の番号は返さない） */
export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  return json({ valid: !!peekReset(token) });
}
