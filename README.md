# Book Writer

A local app for writing a book one chapter at a time.
Each chapter is its own page. Click any chapter in the sidebar to jump straight to it.

## Stack

1. React + Material UI frontend in TypeScript, built with Vite (CodeMirror for the chapter editor)
2. Node + Express API
3. SQLite database via better-sqlite3

## Run it

Requires Node 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

The API runs on port 3001. Vite proxies `/api` calls to it.

To run a single production server instead:

```bash
npm start
```

Open http://localhost:3001.

## Features

1. Multiple books, each with its own chapters
2. Sidebar chapter list with word counts
3. Each chapter has a title, a summary or notes field, and body text
4. Autosave about 0.7 seconds after you stop typing
5. Reorder chapters with the up and down buttons
6. Book-wide chapter and word totals
7. Bookmarkable URLs, for example `#/book/1/chapter/10`

## Keyboard shortcuts

1. `Alt + ↑` goes to the previous chapter
2. `Alt + ↓` goes to the next chapter
3. `Ctrl/Cmd + S` saves now

## Data

Everything is stored in `data/book.db`.
Back up that file to back up your book.
Set `BOOK_DATA_DIR` to store it somewhere else.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/books | List books |
| POST | /api/books | Create a book with a first chapter |
| PATCH | /api/books/:id | Rename a book |
| DELETE | /api/books/:id | Delete a book and its chapters |
| GET | /api/books/:id/chapters | List chapters with word counts |
| POST | /api/books/:id/chapters | Add a chapter at the end |
| GET | /api/chapters/:id | Get one chapter with its content |
| PATCH | /api/chapters/:id | Update title, summary or content |
| DELETE | /api/chapters/:id | Delete a chapter and renumber the rest |
| POST | /api/chapters/:id/move | Move a chapter `up` or `down` |
# book-writer
