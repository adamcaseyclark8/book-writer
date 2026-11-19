# Book Writer

A local app for writing a book one chapter at a time.
Each chapter is its own page. Click any chapter in the sidebar to jump straight to it.

## Stack

1. React + Material UI frontend in TypeScript, built with Vite (CodeMirror for the chapter editor)
2. Node + Express API
3. PostgreSQL database via node-postgres (`pg`)

## Run it

You need two things installed:

1. Node 22.13 or newer. Check with `node -v`. If you upgrade Node, delete `node_modules` and run `npm install` again.
2. PostgreSQL, running. On a Mac the easiest way is [Postgres.app](https://postgresapp.com): install it, open it and click Initialize. Or use Homebrew: `brew install postgresql@17` then `brew services start postgresql@17`.

The app creates its database (`bookwriter`) and tables the first time it starts.

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

Everything is stored in a PostgreSQL database called `bookwriter`.
By default the app connects to `localhost:5432` as your own user with no password, which is how Postgres.app and Homebrew are set up.
To use a different server, set `DATABASE_URL`, for example `DATABASE_URL=postgres://user:password@host:5432/bookwriter npm run dev`.

To back it up:

```bash
pg_dump bookwriter > bookwriter-backup.sql
```

### Moving from the old SQLite version

Earlier versions stored books in `data/book.db`.
The first time the app starts with an empty Postgres database, it copies everything from that file automatically.
The old file is left untouched, so you can delete it once you've checked your books are there.

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
