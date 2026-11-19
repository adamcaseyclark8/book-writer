export type Book = { id: number; title: string; chapters: number; words: number };
export type ChapterSummary = {
  id: number;
  book_id: number;
  position: number;
  title: string;
  summary: string;
  words: number;
};
export type Chapter = Omit<ChapterSummary, "words"> & { content: string; updated_at: string };

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  books: () => req<Book[]>("GET", "/api/books"),
  createBook: (title: string) => req<Book>("POST", "/api/books", { title }),
  renameBook: (id: number, title: string) => req<Book>("PATCH", `/api/books/${id}`, { title }),
  deleteBook: (id: number) => req<void>("DELETE", `/api/books/${id}`),
  chapters: (bookId: number) => req<ChapterSummary[]>("GET", `/api/books/${bookId}/chapters`),
  addChapter: (bookId: number) => req<Chapter>("POST", `/api/books/${bookId}/chapters`, {}),
  chapter: (id: number) => req<Chapter>("GET", `/api/chapters/${id}`),
  updateChapter: (id: number, patch: Partial<Pick<Chapter, "title" | "summary" | "content">>) =>
    req<Chapter>("PATCH", `/api/chapters/${id}`, patch),
  deleteChapter: (id: number) => req<void>("DELETE", `/api/chapters/${id}`),
  moveChapter: (id: number, direction: "up" | "down") =>
    req<ChapterSummary[]>("POST", `/api/chapters/${id}/move`, { direction }),
};
