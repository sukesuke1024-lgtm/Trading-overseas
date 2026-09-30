import { json, sameOrigin, setCookie } from "@/server/session";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  return json({ ok: true }, 200, { "set-cookie": setCookie(req, "", 0) });
}
