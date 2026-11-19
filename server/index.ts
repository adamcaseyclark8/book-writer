import express from "express";
import path from "node:path";
import fs from "node:fs";
import { db, wordCount } from "./db.js";

const app = express();
app.use(express.json({ limit: "20mb" }));

type Chapter = {
  id: number;
  book_id: number;
  position: number;
  title: string;
  summary: string;
  content: string;
  updated_at: string;
};

function renumber(bookId: number) {
  const rows = db
    .prepare("SELECT id FROM chapters WHERE book_id = ? ORDER BY position, id")
    .all(bookId) as { id: number }[];
  const upd = db.prepare("UPDATE chapters SET position = ? WHERE id = ?");
  rows.forEach((r, i) => upd.run(i + 1, r.id));
}

function chapterList(bookId: number) {
  const rows = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? ORDER BY position")
    .all(bookId) as Chapter[];
  return rows.map(({ content, ...rest }) => ({ ...rest, words: wordCount(content) }));
}

app.get("/api/books", (_req, res) => {
  const books = db.prepare("SELECT * FROM books ORDER BY id").all() as { id: number }[];
  res.json(
    books.map((b) => {
      const chapters = chapterList(b.id);
      return {
        ...b,
        chapters: chapters.length,
        words: chapters.reduce((n, c) => n + c.words, 0),
      };
    })
  );
});

app.post("/api/books", (req, res) => {
  const title = String(req.body?.title ?? "").trim() || "Untitled book";
  const create = db.transaction(() => {
    const { lastInsertRowid } = db.prepare("INSERT INTO books (title) VALUES (?)").run(title);
    db.prepare("INSERT INTO chapters (book_id, position, title) VALUES (?, 1, 'Chapter 1')").run(
      lastInsertRowid
    );
    return Number(lastInsertRowid);
  });
  const id = create();
  res.status(201).json(db.prepare("SELECT * FROM books WHERE id = ?").get(id));
});

app.patch("/api/books/:id", (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  const r = db.prepare("UPDATE books SET title = ? WHERE id = ?").run(title, req.params.id);
  if (!r.changes) return res.status(404).json({ error: "not found" });
  res.json(db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id));
});

app.delete("/api/books/:id", (req, res) => {
  const r = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

app.get("/api/books/:id/chapters", (req, res) => {
  res.json(chapterList(Number(req.params.id)));
});

app.post("/api/books/:id/chapters", (req, res) => {
  const bookId = Number(req.params.id);
  if (!db.prepare("SELECT 1 FROM books WHERE id = ?").get(bookId))
    return res.status(404).json({ error: "not found" });
  const { n } = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS n FROM chapters WHERE book_id = ?")
    .get(bookId) as { n: number };
  const title = String(req.body?.title ?? "").trim() || `Chapter ${n + 1}`;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO chapters (book_id, position, title) VALUES (?, ?, ?)")
    .run(bookId, n + 1, title);
  res.status(201).json(db.prepare("SELECT * FROM chapters WHERE id = ?").get(lastInsertRowid));
});

app.get("/api/chapters/:id", (req, res) => {
  const c = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});

app.patch("/api/chapters/:id", (req, res) => {
  const c = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id) as
    | Chapter
    | undefined;
  if (!c) return res.status(404).json({ error: "not found" });
  const next = {
    title: typeof req.body?.title === "string" ? req.body.title : c.title,
    summary: typeof req.body?.summary === "string" ? req.body.summary : c.summary,
    content: typeof req.body?.content === "string" ? req.body.content : c.content,
  };
  db.prepare(
    "UPDATE chapters SET title = ?, summary = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(next.title, next.summary, next.content, c.id);
  res.json(db.prepare("SELECT * FROM chapters WHERE id = ?").get(c.id));
});

app.delete("/api/chapters/:id", (req, res) => {
  const c = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id) as
    | Chapter
    | undefined;
  if (!c) return res.status(404).json({ error: "not found" });
  db.transaction(() => {
    db.prepare("DELETE FROM chapters WHERE id = ?").run(c.id);
    renumber(c.book_id);
  })();
  res.status(204).end();
});

app.post("/api/chapters/:id/move", (req, res) => {
  const c = db.prepare("SELECT * FROM chapters WHERE id = ?").get(req.params.id) as
    | Chapter
    | undefined;
  if (!c) return res.status(404).json({ error: "not found" });
  const dir = req.body?.direction;
  if (dir !== "up" && dir !== "down") return res.status(400).json({ error: "direction must be up or down" });
  const target = db
    .prepare("SELECT * FROM chapters WHERE book_id = ? AND position = ?")
    .get(c.book_id, dir === "up" ? c.position - 1 : c.position + 1) as Chapter | undefined;
  if (target) {
    db.transaction(() => {
      const upd = db.prepare("UPDATE chapters SET position = ? WHERE id = ?");
      upd.run(target.position, c.id);
      upd.run(c.position, target.id);
    })();
  }
  res.json(chapterList(c.book_id));
});

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Book Writer API on http://localhost:${port}`));
