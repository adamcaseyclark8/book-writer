import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.BOOK_DATA_DIR ?? path.resolve("data");
fs.mkdirSync(dir, { recursive: true });

export const db = new Database(path.join(dir, "book.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS chapters_book ON chapters(book_id, position);
`);

export function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}
