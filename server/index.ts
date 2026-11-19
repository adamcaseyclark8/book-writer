import express from "express";
import path from "node:path";
import fs from "node:fs";
import { init, query, transaction, wordCount } from "./db.js";

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

const one = async <T>(text: string, params: unknown[] = []) => (await query<T>(text, params))[0];

async function chapterList(bookId: number) {
  const rows = await query<Chapter>("SELECT * FROM chapters WHERE book_id = $1 ORDER BY position", [bookId]);
  return rows.map(({ content, ...rest }) => ({ ...rest, words: wordCount(content) }));
}

// Ids in the URL must be whole numbers, or Postgres rejects the query.
const id = (v: string) => (/^\d+$/.test(v) ? Number(v) : 0);

app.get("/api/books", async (_req, res) => {
  const books = await query<{ id: number }>("SELECT * FROM books ORDER BY id");
  const out = [];
  for (const b of books) {
    const chapters = await chapterList(b.id);
    out.push({ ...b, chapters: chapters.length, words: chapters.reduce((n, c) => n + c.words, 0) });
  }
  res.json(out);
});

app.post("/api/books", async (req, res) => {
  const title = String(req.body?.title ?? "").trim() || "Untitled book";
  const book = await transaction(async (q) => {
    const [b] = await q<{ id: number }>("INSERT INTO books (title) VALUES ($1) RETURNING *", [title]);
    await q("INSERT INTO chapters (book_id, position, title) VALUES ($1, 1, 'Chapter 1')", [b.id]);
    return b;
  });
  res.status(201).json(book);
});

app.patch("/api/books/:id", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  const b = await one("UPDATE books SET title = $1 WHERE id = $2 RETURNING *", [title, id(req.params.id)]);
  if (!b) return res.status(404).json({ error: "not found" });
  res.json(b);
});

app.delete("/api/books/:id", async (req, res) => {
  const b = await one("DELETE FROM books WHERE id = $1 RETURNING id", [id(req.params.id)]);
  if (!b) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

app.get("/api/books/:id/chapters", async (req, res) => {
  res.json(await chapterList(id(req.params.id)));
});

app.post("/api/books/:id/chapters", async (req, res) => {
  const bookId = id(req.params.id);
  if (!(await one("SELECT 1 FROM books WHERE id = $1", [bookId])))
    return res.status(404).json({ error: "not found" });
  const c = await transaction(async (q) => {
    await q("SELECT 1 FROM books WHERE id = $1 FOR UPDATE", [bookId]);
    const [{ n }] = await q<{ n: number }>(
      "SELECT COALESCE(MAX(position), 0)::int AS n FROM chapters WHERE book_id = $1",
      [bookId]
    );
    const title = String(req.body?.title ?? "").trim() || `Chapter ${n + 1}`;
    const [row] = await q(
      "INSERT INTO chapters (book_id, position, title) VALUES ($1, $2, $3) RETURNING *",
      [bookId, n + 1, title]
    );
    return row;
  });
  res.status(201).json(c);
});

app.get("/api/chapters/:id", async (req, res) => {
  const c = await one("SELECT * FROM chapters WHERE id = $1", [id(req.params.id)]);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});

app.patch("/api/chapters/:id", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const c = await one(
    `UPDATE chapters SET
       title = COALESCE($1, title),
       summary = COALESCE($2, summary),
       content = COALESCE($3, content),
       updated_at = now()
     WHERE id = $4 RETURNING *`,
    [str(req.body?.title), str(req.body?.summary), str(req.body?.content), id(req.params.id)]
  );
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
});

app.delete("/api/chapters/:id", async (req, res) => {
  const c = await one<Chapter>("DELETE FROM chapters WHERE id = $1 RETURNING book_id", [id(req.params.id)]);
  if (!c) return res.status(404).json({ error: "not found" });
  // Renumber the remaining chapters 1, 2, 3, ...
  await query(
    `UPDATE chapters SET position = r.n
     FROM (SELECT id, row_number() OVER (ORDER BY position, id) AS n FROM chapters WHERE book_id = $1) r
     WHERE chapters.id = r.id`,
    [c.book_id]
  );
  res.status(204).end();
});

app.post("/api/chapters/:id/move", async (req, res) => {
  const dir = req.body?.direction;
  if (dir !== "up" && dir !== "down") return res.status(400).json({ error: "direction must be up or down" });
  const c = await one<Chapter>("SELECT * FROM chapters WHERE id = $1", [id(req.params.id)]);
  if (!c) return res.status(404).json({ error: "not found" });
  const target = await one<Chapter>("SELECT * FROM chapters WHERE book_id = $1 AND position = $2", [
    c.book_id,
    dir === "up" ? c.position - 1 : c.position + 1,
  ]);
  if (target) {
    await transaction(async (q) => {
      await q("UPDATE chapters SET position = $1 WHERE id = $2", [target.position, c.id]);
      await q("UPDATE chapters SET position = $1 WHERE id = $2", [c.position, target.id]);
    });
  }
  res.json(await chapterList(c.book_id));
});

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

await init();
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Book Writer API on http://localhost:${port}`));
