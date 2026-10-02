import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SEED } from "./seed-data";

export type ComponentRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  author: string;
  code: string;
  likes: number;
  created_at: string;
};

const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "component";
}

function uniqueSlug(db: Database.Database, title: string): string {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM components WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function open(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "gallery.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT 'Anonymous',
      code TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM components").get() as { n: number };
  if (n === 0) {
    const insert = db.prepare(
      `INSERT INTO components (slug, title, description, category, tags, author, code)
       VALUES (@slug, @title, @description, @category, @tags, @author, @code)`,
    );
    db.transaction(() => {
      for (const c of SEED) insert.run({ ...c, slug: uniqueSlug(db, c.title) });
    })();
  }
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__db) globalForDb.__db = open();
  return globalForDb.__db;
}

export function listComponents(opts: { q?: string; category?: string; sort?: string }) {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (opts.q) {
    where.push("(title LIKE @q OR description LIKE @q OR tags LIKE @q)");
    params.q = `%${opts.q.replace(/[%_]/g, "")}%`;
  }
  if (opts.category) {
    where.push("category = @category");
    params.category = opts.category;
  }
  const order = opts.sort === "popular" ? "likes DESC, id DESC" : "id DESC";
  const sql = `SELECT * FROM components ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT 100`;
  return getDb().prepare(sql).all(params) as ComponentRow[];
}

export function getComponent(slug: string) {
  return getDb().prepare("SELECT * FROM components WHERE slug = ?").get(slug) as
    | ComponentRow
    | undefined;
}

export function createComponent(input: {
  title: string;
  description: string;
  category: string;
  tags: string;
  author: string;
  code: string;
}) {
  const db = getDb();
  const slug = uniqueSlug(db, input.title);
  db.prepare(
    `INSERT INTO components (slug, title, description, category, tags, author, code)
     VALUES (@slug, @title, @description, @category, @tags, @author, @code)`,
  ).run({ ...input, slug });
  return slug;
}

export function likeComponent(slug: string) {
  const db = getDb();
  db.prepare("UPDATE components SET likes = likes + 1 WHERE slug = ?").run(slug);
  return (db.prepare("SELECT likes FROM components WHERE slug = ?").get(slug) as
    | { likes: number }
    | undefined)?.likes;
}
