import { sessionUser } from "@/server/session";
import { subscribe } from "@/server/bus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const uid = sessionUser(req);
  if (!uid) return new Response("unauthorized", { status: 401 });
  const enc = new TextEncoder();
  let off = () => {}, beat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(ctl) {
      const send = (m: string) => ctl.enqueue(enc.encode(`data: ${m}\n\n`));
      ctl.enqueue(enc.encode("retry: 3000\n\n"));
      off = subscribe(uid, send);
      beat = setInterval(() => { try { ctl.enqueue(enc.encode(": keepalive\n\n")); } catch {} }, 25000);
      req.signal.addEventListener("abort", () => { off(); clearInterval(beat); try { ctl.close(); } catch {} });
    },
    cancel() { off(); clearInterval(beat); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
