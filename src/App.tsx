import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  InputBase,
  List,
  ListItemButton,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { api, type Book, type Chapter, type ChapterSummary } from "./api";
import { createEditor } from "./editor";
import { useDialogs } from "./dialogs";
import { colors } from "./palette";

const countWords = (t: string) => t.trim().match(/\S+/g)?.length ?? 0;
const mobile = "@media (max-width: 700px)";

export default function App() {
  const dialogs = useDialogs();

  // Rendered state.
  const [books, setBooksState] = useState<Book[]>([]);
  const [chapters, setChaptersState] = useState<ChapterSummary[]>([]);
  const [bookId, setBookIdState] = useState<number | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [title, setTitleState] = useState("");
  const [summary, setSummaryState] = useState("");
  const [status, setStatus] = useState("");

  // Mutable state read by async handlers, so they always see the latest values.
  const s = useRef({
    books: [] as Book[],
    chapters: [] as ChapterSummary[],
    bookId: null as number | null,
    current: null as Chapter | null,
    title: "",
    summary: "",
    dirty: false,
    saveTimer: undefined as number | undefined,
    loading: false,
  }).current;

  const editorEl = useRef<HTMLDivElement>(null);
  const editor = useRef<ReturnType<typeof createEditor> | null>(null);

  const setBooks = (v: Book[]) => setBooksState((s.books = v));
  const setChapters = (v: ChapterSummary[]) => setChaptersState((s.chapters = [...v]));
  const setBookId = (v: number | null) => setBookIdState((s.bookId = v));
  const setCurrent = (v: Chapter | null) => {
    s.current = v;
    setCurrentId(v?.id ?? null);
  };
  const setTitle = (v: string) => setTitleState((s.title = v));
  const setSummary = (v: string) => setSummaryState((s.summary = v));

  function scheduleSave() {
    s.dirty = true;
    setStatus("editing…");
    window.clearTimeout(s.saveTimer);
    s.saveTimer = window.setTimeout(save, 700);
  }

  async function save() {
    window.clearTimeout(s.saveTimer);
    if (!s.current || !s.dirty) return;
    s.dirty = false;
    const content = editor.current!.getText();
    const patch = { title: s.title, summary: s.summary, content };
    setStatus("saving…");
    try {
      s.current = await api.updateChapter(s.current.id, patch);
      const c = s.chapters.find((x) => x.id === s.current!.id);
      if (c) {
        c.title = patch.title;
        c.words = countWords(content);
      }
      setChapters(s.chapters);
      setStatus("saved");
    } catch {
      s.dirty = true;
      setStatus("save failed");
    }
  }

  async function openBook(id: number) {
    setBookId(id);
    setChapters(await api.chapters(id));
  }

  async function openChapter(id: number) {
    await save();
    const c = await api.chapter(id);
    setCurrent(c);
    s.loading = true;
    setTitle(c.title);
    setSummary(c.summary);
    editor.current!.setText(c.content);
    s.loading = false;
    setStatus("");
  }

  async function route() {
    const m = location.hash.match(/^#\/book\/(\d+)(?:\/chapter\/(\d+))?/);
    let bid = m ? Number(m[1]) : s.books[0]?.id;
    if (!s.books.some((b) => b.id === bid)) bid = s.books[0]?.id;
    if (!bid) return;
    if (bid !== s.bookId) await openBook(bid);
    let cid = m?.[2] ? Number(m[2]) : s.chapters[0]?.id;
    if (!s.chapters.some((c) => c.id === cid)) cid = s.chapters[0]?.id;
    const target = `#/book/${bid}/chapter/${cid}`;
    if (location.hash !== target) {
      history.replaceState(null, "", target);
    }
    if (cid && cid !== s.current?.id) await openChapter(cid);
  }

  function goChapter(offset: number) {
    const i = s.chapters.findIndex((c) => c.id === s.current?.id);
    const next = s.chapters[i + offset];
    if (next) location.hash = `#/book/${next.book_id}/chapter/${next.id}`;
  }

  async function reloadBooks() {
    let list = await api.books();
    if (!list.length) list = [await api.createBook("My book")].map((b) => ({ ...b, chapters: 1, words: 0 }));
    setBooks(list);
  }

  // --- actions ---
  async function selectBook(id: number) {
    await save();
    location.hash = `#/book/${id}`;
  }

  async function newBook() {
    const t = await dialogs.prompt("Book title?");
    if (t === null) return;
    await save();
    const b = await api.createBook(t);
    await reloadBooks();
    location.hash = `#/book/${b.id}`;
  }

  async function renameBook() {
    const b = s.books.find((x) => x.id === s.bookId);
    if (!b) return;
    const t = await dialogs.prompt("Rename book", b.title);
    if (!t) return;
    await api.renameBook(b.id, t);
    await reloadBooks();
  }

  async function deleteBook() {
    const b = s.books.find((x) => x.id === s.bookId);
    if (!b || !(await dialogs.confirm(`Delete "${b.title}" and all its chapters?`))) return;
    s.dirty = false;
    await api.deleteBook(b.id);
    setBookId(null);
    setCurrent(null);
    await reloadBooks();
    location.hash = "";
    await route();
  }

  async function addChapter() {
    if (!s.bookId) return;
    await save();
    const c = await api.addChapter(s.bookId);
    setChapters(await api.chapters(s.bookId));
    location.hash = `#/book/${s.bookId}/chapter/${c.id}`;
  }

  async function deleteChapter() {
    const cur = s.current;
    if (!cur || !s.bookId) return;
    if (s.chapters.length <= 1) return dialogs.alert("A book needs at least one chapter.");
    if (!(await dialogs.confirm(`Delete "${cur.title || "Untitled"}"?`))) return;
    s.dirty = false;
    const i = s.chapters.findIndex((c) => c.id === cur.id);
    await api.deleteChapter(cur.id);
    setChapters(await api.chapters(s.bookId));
    setCurrent(null);
    const next = s.chapters[Math.min(i, s.chapters.length - 1)];
    location.hash = `#/book/${s.bookId}/chapter/${next.id}`;
  }

  async function move(direction: "up" | "down") {
    if (!s.current) return;
    await save();
    setChapters(await api.moveChapter(s.current.id, direction));
  }

  // Handlers registered once below call through this ref to get the latest closures.
  const latest = useRef({ scheduleSave, save, route, goChapter });
  latest.current = { scheduleSave, save, route, goChapter };

  useEffect(() => {
    if (editor.current) return;
    editor.current = createEditor(editorEl.current!, () => {
      if (!s.loading) latest.current.scheduleSave();
    });

    const onHash = () => void latest.current.route();
    const onUnload = () => {
      if (s.dirty) void latest.current.save();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        s.dirty = true;
        void latest.current.save();
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        latest.current.goChapter(-1);
      } else if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        latest.current.goChapter(1);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("keydown", onKey);

    (async () => {
      await reloadBooks();
      await latest.current.route();
      editor.current?.focus();
    })();
  }, []);

  const totalWords = chapters.reduce((n, c) => n + c.words, 0);
  const small = { color: colors.muted, fontSize: 11 };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100vh",
        [mobile]: { gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr" },
      }}
    >
      {/* ---- sidebar ---- */}
      <Box
        component="aside"
        sx={{
          bgcolor: colors.panel,
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          p: "12px 10px",
          gap: "8px",
          [mobile]: { maxHeight: "35vh" },
        }}
      >
        <Box sx={{ display: "flex", gap: "6px" }}>
          <Select
            size="small"
            title="Book"
            value={bookId && books.some((b) => b.id === bookId) ? bookId : ""}
            onChange={(e) => void selectBook(Number(e.target.value))}
            sx={{
              flex: 1,
              minWidth: 0,
              bgcolor: colors.bg,
              color: colors.textBright,
              font: "inherit",
              "& .MuiSelect-select": { p: "4px", pr: "28px !important", minHeight: 0 },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.border },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.muted },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: colors.muted, borderWidth: 1 },
              "& .MuiSelect-icon": { color: colors.muted },
            }}
            MenuProps={{ slotProps: { paper: { sx: { bgcolor: colors.bg, border: `1px solid ${colors.border}` } } } }}
          >
            {books.map((b) => (
              <MenuItem key={b.id} value={b.id} sx={{ font: "inherit", color: colors.textBright }}>
                {b.title}
              </MenuItem>
            ))}
          </Select>
          <Button title="New book" onClick={newBook}>
            +
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: "6px", "& .MuiButton-root": { fontSize: 11 } }}>
          <Button onClick={renameBook}>rename</Button>
          <Button onClick={deleteBook}>delete</Button>
        </Box>

        <List component="ol" disablePadding sx={{ mt: "4px", overflowY: "auto", flex: 1 }}>
          {chapters.map((c) => (
            <li key={c.id}>
              <ListItemButton
                component="a"
                href={`#/book/${c.book_id}/chapter/${c.id}`}
                selected={c.id === currentId}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  alignItems: "baseline",
                  gap: "6px",
                  p: "4px 6px",
                  borderRadius: "3px",
                  color: colors.textBright,
                  "&:hover": { bgcolor: colors.bg },
                  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: colors.activeGutter },
                }}
              >
                <Typography component="span" sx={{ ...small, textAlign: "right" }}>
                  {c.position}
                </Typography>
                <Typography component="span" noWrap sx={{ font: "inherit" }}>
                  {c.title || "Untitled"}
                </Typography>
                <Typography component="span" sx={{ ...small, textAlign: "right" }}>
                  {c.words}
                </Typography>
              </ListItemButton>
            </li>
          ))}
        </List>

        <Button fullWidth onClick={addChapter}>
          + add chapter
        </Button>
        <Typography sx={{ ...small, p: "4px 2px 0" }}>
          {chapters.length} chapter{chapters.length === 1 ? "" : "s"} · {totalWords.toLocaleString()} words
        </Typography>
      </Box>

      {/* ---- main ---- */}
      <Box component="main" sx={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            p: "10px 16px 6px 60px", // lines up with the text past the gutter
            [mobile]: { pl: "16px" },
          }}
        >
          <InputBase
            placeholder="Chapter title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
            sx={{ flex: 1, minWidth: 0, fontSize: 14, color: colors.textBright, "& input": { p: 0 } }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Button title="Move chapter up" onClick={() => move("up")}>
              ↑
            </Button>
            <Button title="Move chapter down" onClick={() => move("down")}>
              ↓
            </Button>
            <Button title="Delete chapter" onClick={deleteChapter}>
              delete
            </Button>
            <Typography component="span" sx={{ ...small, minWidth: 64, textAlign: "right" }}>
              {status}
            </Typography>
          </Box>
        </Box>

        <InputBase
          multiline
          minRows={2}
          placeholder="Summary or notes"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            scheduleSave();
          }}
          sx={{
            m: "0 16px 8px 60px",
            p: "4px 0 8px",
            borderBottom: `1px solid ${colors.border}`,
            color: colors.text,
            [mobile]: { ml: "16px" },
          }}
        />

        {/* full-width editor, numbers in the margin */}
        <Box ref={editorEl} sx={{ flex: 1, minHeight: 0 }} />
      </Box>

      {dialogs.element}
    </Box>
  );
}
