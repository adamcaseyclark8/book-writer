import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { colors, mono } from "./palette";

// Colours taken from the screenshot: slate background, muted gutter numbers,
// a lighter band on the current line and an orange cursor.
const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: colors.text,
      backgroundColor: colors.bg,
      fontSize: "13px",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: mono,
      lineHeight: "1.4",
    },
    // Wrap at about 80 characters (plus the line padding below).
    ".cm-content": {
      padding: "12px 0 40vh",
      caretColor: colors.cursor,
      maxWidth: "calc(80ch + 34px)",
    },
    ".cm-line": { padding: "0 24px 0 10px" },
    ".cm-gutters": {
      backgroundColor: colors.bg,
      color: colors.gutterText,
      border: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 14px 0 18px",
      minWidth: "48px",
    },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": {
      backgroundColor: colors.activeGutter,
      color: colors.textBright,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeft: `2px solid ${colors.cursor}`,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: `${colors.selection} !important`,
    },
  },
  { dark: true }
);

export function createEditor(parent: HTMLElement, onChange: (text: string) => void) {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    theme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
    }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ doc: "", extensions }) });

  return {
    view,
    setText(text: string) {
      view.setState(EditorState.create({ doc: text, extensions }));
    },
    getText: () => view.state.doc.toString(),
    focus: () => view.focus(),
  };
}
