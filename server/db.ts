import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Connects to a local Postgres by default, as your own macOS user with no password
// (how Postgres.app and Homebrew set it up). Set DATABASE_URL to use another server.
const url = withUser(process.env.DATABASE_URL ?? "postgres://localhost:5432/bookwriter");

// With no user in the URL, connect as the current OS user.
function withUser(raw: string) {
  const u = new URL(raw);
  if (!u.username) u.username = encodeURIComponent(process.env.PGUSER || process.env.USER || os.userInfo().username);
  return u.toString();
}

export const pool = new pg.Pool({ connectionString: url });

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

/** Runs fn inside a transaction on one connection. */
export async function transaction<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const q = async (text: string, params: unknown[] = []) => (await client.query(text, params)).rows;
  try {
    await client.query("BEGIN");
    const result = await fn(q as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Creates the database if it is missing (local servers only). */
async function ensureDatabase() {
  const u = new URL(url);
  const name = decodeURIComponent(u.pathname.slice(1));
  u.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: u.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.log(`Created database "${name}"`);
    }
  } finally {
    await admin.end();
  }
}

export async function init() {
  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    if (e.code === "3D000") await ensureDatabase(); // database does not exist
    else {
      console.error(
        `\nCan't connect to Postgres at ${url.replace(/:[^:@/]*@/, ":***@")}\n` +
          `Make sure Postgres is installed and running (for example Postgres.app, or\n` +
          `"brew services start postgresql@17"), or set DATABASE_URL.\n\n${e.message}\n`
      );
      process.exit(1);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS chapters (
      id SERIAL PRIMARY KEY,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS chapters_book ON chapters(book_id, position);
  `);

  await importFromSqlite();
}

/**
 * One-time copy of books written with the old SQLite version (data/book.db),
 * run only while the Postgres database is still empty. The old file is left in place.
 */
async function importFromSqlite() {
  const file = path.join(process.env.BOOK_DATA_DIR ?? path.resolve("data"), "book.db");
  if (!fs.existsSync(file)) return;
  const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM books");
  if (n > 0) return;

  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(file, { readOnly: true });
  const books = old.prepare("SELECT * FROM books ORDER BY id").all() as any[];
  const chapters = old.prepare("SELECT * FROM chapters ORDER BY id").all() as any[];
  old.close();
  if (!books.length) return;

  // SQLite stored times as "YYYY-MM-DD HH:MM:SS" in UTC.
  const ts = (t: string | null) => (t ? `${t.replace(" ", "T")}Z` : new Date().toISOString());
  await transaction(async (q) => {
    for (const b of books)
      await q("INSERT INTO books (id, title, created_at) VALUES ($1, $2, $3)", [b.id, b.title, ts(b.created_at)]);
    for (const c of chapters)
      await q(
        `INSERT INTO chapters (id, book_id, position, title, summary, content, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, c.book_id, c.position, c.title, c.summary, c.content, ts(c.updated_at)]
      );
    await q("SELECT setval('books_id_seq', (SELECT max(id) FROM books))");
    await q("SELECT setval('chapters_id_seq', GREATEST((SELECT max(id) FROM chapters), 1))");
  });
  console.log(`Imported ${books.length} book(s) and ${chapters.length} chapter(s) from ${file}`);
}

export function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}
