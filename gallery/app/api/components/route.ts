import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { createComponent, listComponents } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const items = listComponents({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(body.title);
  const description = str(body.description);
  const category = str(body.category);
  const tags = str(body.tags).slice(0, 120);
  const author = str(body.author).slice(0, 40) || "Anonymous";
  const code = str(body.code);

  const errors: Record<string, string> = {};
  if (title.length < 3 || title.length > 60) errors.title = "Title must be 3–60 characters.";
  if (description.length > 200) errors.description = "Description must be 200 characters or fewer.";
  if (!(CATEGORIES as readonly string[]).includes(category)) errors.category = "Pick a category.";
  if (code.length < 10 || code.length > 20000) errors.code = "Code must be 10–20,000 characters.";
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

  const slug = createComponent({ title, description, category, tags, author, code });
  return NextResponse.json({ slug }, { status: 201 });
}
