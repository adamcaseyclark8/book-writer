import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

type Request =
  | { kind: "prompt"; message: string; value: string; resolve: (v: string | null) => void }
  | { kind: "confirm"; message: string; resolve: (v: boolean) => void }
  | { kind: "alert"; message: string; resolve: () => void };

/** Material replacements for window.prompt / confirm / alert, returned as promises. */
export function useDialogs() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const reqRef = useRef<Request | null>(null);

  const open = useCallback((r: Request) => {
    reqRef.current = r;
    if (r.kind === "prompt") setValue(r.value);
    setReq(r);
  }, []);

  const prompt = useCallback(
    (message: string, defaultValue = "") =>
      new Promise<string | null>((resolve) => open({ kind: "prompt", message, value: defaultValue, resolve })),
    [open]
  );
  const confirm = useCallback(
    (message: string) => new Promise<boolean>((resolve) => open({ kind: "confirm", message, resolve })),
    [open]
  );
  const alert = useCallback(
    (message: string) => new Promise<void>((resolve) => open({ kind: "alert", message, resolve })),
    [open]
  );

  const close = (ok: boolean) => {
    const r = reqRef.current;
    if (!r) return;
    reqRef.current = null;
    setReq(null);
    if (r.kind === "prompt") r.resolve(ok ? value : null);
    else if (r.kind === "confirm") r.resolve(ok);
    else r.resolve();
  };

  const element: ReactNode = (
    <Dialog open={!!req} onClose={() => close(false)} fullWidth maxWidth="xs">
      {req && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            close(true);
          }}
        >
          {req.kind === "prompt" ? (
            <>
              <DialogTitle sx={{ fontSize: 14 }}>{req.message}</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  variant="outlined"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </DialogContent>
            </>
          ) : (
            <DialogContent>
              <DialogContentText sx={{ color: "text.primary" }}>{req.message}</DialogContentText>
            </DialogContent>
          )}
          <DialogActions>
            {req.kind !== "alert" && <Button onClick={() => close(false)}>cancel</Button>}
            <Button type="submit" autoFocus={req.kind !== "prompt"}>
              ok
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );

  return { prompt, confirm, alert, element };
}
