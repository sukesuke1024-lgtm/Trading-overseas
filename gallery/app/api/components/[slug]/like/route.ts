import { NextResponse } from "next/server";
import { likeComponent } from "@/lib/db";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const likes = likeComponent(slug);
  if (likes === undefined) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ likes });
}
