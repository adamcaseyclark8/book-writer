import { createTheme } from "@mui/material/styles";
import { colors, mono } from "./palette";

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: colors.bg, paper: colors.panel },
    text: { primary: colors.text, secondary: colors.muted },
    divider: colors.border,
    primary: { main: colors.cursor },
  },
  typography: {
    fontFamily: mono,
    fontSize: 13,
    htmlFontSize: 16,
  },
  shape: { borderRadius: 4 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body": { margin: 0, height: "100%", fontSize: 13 },
        body: { backgroundColor: colors.bg, color: colors.text, fontFamily: mono },
        "::placeholder": { color: colors.muted, opacity: 1 },
      },
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { variant: "outlined", size: "small", disableElevation: true },
      styleOverrides: {
        root: {
          font: "inherit",
          textTransform: "none",
          minWidth: 0,
          lineHeight: "normal",
          padding: "2px 8px",
          borderRadius: 4,
          color: colors.text,
          borderColor: colors.border,
          "&:hover": { color: "#ffffff", borderColor: colors.muted, backgroundColor: "transparent" },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { font: "inherit", color: "inherit" },
        input: { "&::placeholder": { color: colors.muted, opacity: 1 } },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: colors.panel, backgroundImage: "none", border: `1px solid ${colors.border}` },
      },
    },
  },
});
