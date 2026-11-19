import "./style.css";
import { api, type Book, type Chapter, type ChapterSummary } from "./api";
import { createEditor } from "./editor";

const app = document.getElementById("app")!;
app.innerHTML = `
  <aside class="sidebar">
    <div class="book-bar">
      <select id="book-select" title="Book"></select>
      <button id="new-book" title="New book">+</button>
    </div>
    <div class="book-actions">
      <button id="rename-book">rename</button>
      <button id="delete-book">delete</button>
    </div>
    <ol id="chapter-list" class="chapter-list"></ol>
    <button id="add-chapter" class="add-chapter">+ add chapter</button>
    <div id="totals" class="totals"></div>
  </aside>
  <main class="main">
    <header class="chapter-head">
      <input id="chapter-title" class="chapter-title" placeholder="Chapter title" />
      <div class="chapter-tools">
        <button id="move-up" title="Move chapter up">↑</button>
        <button id="move-down" title="Move chapter down">↓</button>
        <button id="delete-chapter" title="Delete chapter">delete</button>
        <span id="status" class="status"></span>
      </div>
    </header>
    <textarea id="chapter-summary" class="chapter-summary" rows="2" placeholder="Summary or notes"></textarea>
    <div id="editor" class="editor"></div>
  </main>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const bookSelect = $<HTMLSelectElement>("book-select");
const chapterList = $<HTMLOListElement>("chapter-list");
const titleInput = $<HTMLInputElement>("chapter-title");
const summaryInput = $<HTMLTextAreaElement>("chapter-summary");
const statusEl = $("status");
const totalsEl = $("totals");

let books: Book[] = [];
let chapters: ChapterSummary[] = [];
let bookId: number | null = null;
let current: Chapter | null = null;
let dirty = false;
let saveTimer: number | undefined;
let loading = false;

const editor = createEditor($("editor"), () => {
  if (!loading) scheduleSave();
});

const countWords = (t: string) => t.trim().match(/\S+/g)?.length ?? 0;

function setStatus(text: string) {
  statusEl.textContent = text;
}

function scheduleSave() {
  dirty = true;
  setStatus("editing…");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 700);
}

async function save() {
  window.clearTimeout(saveTimer);
  if (!current || !dirty) return;
  dirty = false;
  const content = editor.getText();
  const patch = { title: titleInput.value, summary: summaryInput.value, content };
  setStatus("saving…");
  try {
    current = await api.updateChapter(current.id, patch);
    const c = chapters.find((x) => x.id === current!.id);
    if (c) {
      c.title = patch.title;
      c.words = countWords(content);
    }
    renderChapters();
    setStatus("saved");
  } catch {
    dirty = true;
    setStatus("save failed");
  }
}

function renderBooks() {
  bookSelect.innerHTML = books
    .map((b) => `<option value="${b.id}">${escapeHtml(b.title)}</option>`)
    .join("");
  if (bookId) bookSelect.value = String(bookId);
}

function renderChapters() {
  chapterList.innerHTML = chapters
    .map(
      (c) => `
      <li class="${c.id === current?.id ? "active" : ""}">
        <a href="#/book/${c.book_id}/chapter/${c.id}">
          <span class="num">${c.position}</span>
          <span class="name">${escapeHtml(c.title || "Untitled")}</span>
          <span class="words">${c.words}</span>
        </a>
      </li>`
    )
    .join("");
  const words = chapters.reduce((n, c) => n + c.words, 0);
  totalsEl.textContent = `${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${words.toLocaleString()} words`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

async function openBook(id: number) {
  bookId = id;
  chapters = await api.chapters(id);
  renderBooks();
  renderChapters();
}

async function openChapter(id: number) {
  await save();
  current = await api.chapter(id);
  loading = true;
  titleInput.value = current.title;
  summaryInput.value = current.summary;
  editor.setText(current.content);
  loading = false;
  setStatus("");
  renderChapters();
}

async function route() {
  const m = location.hash.match(/^#\/book\/(\d+)(?:\/chapter\/(\d+))?/);
  let bid = m ? Number(m[1]) : books[0]?.id;
  if (!books.some((b) => b.id === bid)) bid = books[0]?.id;
  if (!bid) return;
  if (bid !== bookId) await openBook(bid);
  let cid = m?.[2] ? Number(m[2]) : chapters[0]?.id;
  if (!chapters.some((c) => c.id === cid)) cid = chapters[0]?.id;
  const target = `#/book/${bid}/chapter/${cid}`;
  if (location.hash !== target) {
    history.replaceState(null, "", target);
  }
  if (cid && cid !== current?.id) await openChapter(cid);
}

function goChapter(offset: number) {
  const i = chapters.findIndex((c) => c.id === current?.id);
  const next = chapters[i + offset];
  if (next) location.hash = `#/book/${next.book_id}/chapter/${next.id}`;
}

async function reloadBooks() {
  books = await api.books();
  if (!books.length) books = [await api.createBook("My book")].map((b) => ({ ...b, chapters: 1, words: 0 }));
  renderBooks();
}

// --- events ---
titleInput.addEventListener("input", scheduleSave);
summaryInput.addEventListener("input", scheduleSave);
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", () => {
  if (dirty) void save();
});

bookSelect.addEventListener("change", async () => {
  await save();
  location.hash = `#/book/${bookSelect.value}`;
});

$("new-book").addEventListener("click", async () => {
  const title = prompt("Book title?");
  if (title === null) return;
  await save();
  const b = await api.createBook(title);
  await reloadBooks();
  location.hash = `#/book/${b.id}`;
});

$("rename-book").addEventListener("click", async () => {
  const b = books.find((x) => x.id === bookId);
  if (!b) return;
  const title = prompt("Rename book", b.title);
  if (!title) return;
  await api.renameBook(b.id, title);
  await reloadBooks();
});

$("delete-book").addEventListener("click", async () => {
  const b = books.find((x) => x.id === bookId);
  if (!b || !confirm(`Delete "${b.title}" and all its chapters?`)) return;
  dirty = false;
  await api.deleteBook(b.id);
  bookId = null;
  current = null;
  await reloadBooks();
  location.hash = "";
  await route();
});

$("add-chapter").addEventListener("click", async () => {
  if (!bookId) return;
  await save();
  const c = await api.addChapter(bookId);
  chapters = await api.chapters(bookId);
  location.hash = `#/book/${bookId}/chapter/${c.id}`;
});

$("delete-chapter").addEventListener("click", async () => {
  if (!current || !bookId) return;
  if (chapters.length <= 1) return alert("A book needs at least one chapter.");
  if (!confirm(`Delete "${current.title || "Untitled"}"?`)) return;
  dirty = false;
  const i = chapters.findIndex((c) => c.id === current!.id);
  await api.deleteChapter(current.id);
  chapters = await api.chapters(bookId);
  current = null;
  const next = chapters[Math.min(i, chapters.length - 1)];
  location.hash = `#/book/${bookId}/chapter/${next.id}`;
});

async function move(direction: "up" | "down") {
  if (!current) return;
  await save();
  chapters = await api.moveChapter(current.id, direction);
  renderChapters();
}
$("move-up").addEventListener("click", () => move("up"));
$("move-down").addEventListener("click", () => move("down"));

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    dirty = true;
    void save();
  } else if (e.altKey && e.key === "ArrowUp") {
    e.preventDefault();
    goChapter(-1);
  } else if (e.altKey && e.key === "ArrowDown") {
    e.preventDefault();
    goChapter(1);
  }
});

await reloadBooks();
await route();
editor.focus();
