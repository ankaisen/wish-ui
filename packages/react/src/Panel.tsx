import type { Overlay, ProgrammableRuntime, Selection, Wisher, WishOutcome } from "@wish-ui/core";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ApiKeyStore } from "./apiKey";
import { pickElement } from "./pickElement";

export type PanelProps = {
  runtime: ProgrammableRuntime;
  /** Turns wishes into changes. Without one, the panel only selects. */
  wisher?: Wisher;
  /** When given, the panel asks for an API key before the first wish. */
  apiKey?: ApiKeyStore;
};

const styles = {
  launcher: {
    position: "fixed",
    right: 20,
    bottom: 20,
    zIndex: 2147483645,
    padding: "10px 16px",
    border: "none",
    borderRadius: 999,
    background: "#6e56cf",
    color: "#fff",
    font: "600 14px system-ui, sans-serif",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
    cursor: "pointer",
  },
  panel: {
    position: "fixed",
    right: 20,
    bottom: 20,
    zIndex: 2147483645,
    width: 360,
    maxWidth: "calc(100vw - 40px)",
    padding: 16,
    borderRadius: 12,
    background: "#fff",
    color: "#1f2328",
    font: "14px system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: 15 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  button: {
    padding: "6px 12px",
    border: "1px solid #d0d7de",
    borderRadius: 6,
    background: "#f6f8fa",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
  },
  primary: {
    padding: "6px 12px",
    border: "none",
    borderRadius: 6,
    background: "#6e56cf",
    color: "#fff",
    font: "600 14px system-ui, sans-serif",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 8,
    border: "1px solid #d0d7de",
    borderRadius: 6,
    font: "inherit",
    resize: "vertical",
  },
  selection: { margin: 0, padding: 8, borderRadius: 6, background: "#f3f0ff", fontSize: 13 },
  hint: { margin: 0, color: "#57606a", fontSize: 13 },
  applied: { margin: 0, padding: 8, borderRadius: 6, background: "#dafbe1", fontSize: 13 },
  problem: { margin: 0, padding: 8, borderRadius: 6, background: "#fff8c5", fontSize: 13 },
} satisfies Record<string, CSSProperties>;

/** The floating wish panel: select part of the app, describe a change, see it happen. */
export function Panel({ runtime, wisher, apiKey }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<"preparing" | "picking" | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<WishOutcome | null>(null);
  const [hasKey, setHasKey] = useState(() => !apiKey || Boolean(apiKey.get()));
  const [keyDraft, setKeyDraft] = useState("");
  const history = useRef<Overlay[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  async function select() {
    setPicking("preparing");
    try {
      // The first pick switches to modules compiled from source, which carry data-source-* attributes.
      const prepared = await runtime.prepare();
      if (!prepared.ok) {
        setOutcome({ status: "failed", error: prepared.errors.join("; ") });
        return;
      }
      // pickElement() listens before React re-renders, so "Click something" never shows too early.
      const pick = pickElement();
      setPicking("picking");
      const picked = await pick;
      if (picked) setSelection(picked);
    } finally {
      setPicking(null);
    }
  }

  async function makeWish(event: FormEvent) {
    event.preventDefault();
    if (!wisher || !text.trim() || progress) return;
    const before = runtime.getSnapshot().overlay;
    setOutcome(null);
    setProgress("Starting");
    try {
      await runtime.prepare();
      const result = await wisher({ text: text.trim(), selection, workspace: runtime, onProgress: setProgress });
      setOutcome(result);
      if (result.status === "applied") {
        history.current.push(before);
        setCanUndo(true);
        setText("");
        setSelection(null);
      }
    } catch (error) {
      setOutcome({ status: "failed", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setProgress(null);
    }
  }

  async function undo() {
    const previous = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (previous === undefined) return;
    const result = await runtime.tryApply(previous);
    setOutcome(result.ok ? null : { status: "failed", error: result.errors.join("; ") });
  }

  function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!apiKey || !keyDraft.trim()) return;
    apiKey.set(keyDraft.trim());
    setKeyDraft("");
    setHasKey(true);
  }

  if (!open) {
    return (
      <button type="button" style={styles.launcher} onClick={() => setOpen(true)}>
        ✨ Make a wish
      </button>
    );
  }

  return (
    <section aria-label="Wish panel" style={styles.panel} data-wish-panel="">
      <div style={styles.header}>
        <h2 style={styles.title}>Make a wish</h2>
        <button type="button" aria-label="Close" style={styles.button} onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      {!hasKey && apiKey ? (
        <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={saveKey}>
          <p style={styles.hint}>Enter your Claude API key. It stays in this browser and is sent only to the Claude API.</p>
          <input
            aria-label="API key"
            type="password"
            placeholder="sk-ant-…"
            style={styles.input}
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
          />
          <div style={styles.row}>
            <button type="submit" style={styles.primary}>
              Save key
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={styles.row}>
            <button type="button" style={styles.button} disabled={Boolean(picking || progress)} onClick={select}>
              {picking === "picking"
                ? "Click something… (Esc to cancel)"
                : picking === "preparing"
                  ? "Getting ready…"
                  : "Select part of the app"}
            </button>
            {canUndo && (
              <button type="button" style={styles.button} disabled={Boolean(progress)} onClick={undo}>
                Undo last change
              </button>
            )}
          </div>
          {selection ? (
            <p style={styles.selection}>
              Selected <code>&lt;{selection.tag}&gt;</code> {selection.text && <>“{selection.text}” </>}
              <button type="button" style={styles.button} onClick={() => setSelection(null)}>
                Clear
              </button>
            </p>
          ) : (
            <p style={styles.hint}>Select what you want to change, or just describe it.</p>
          )}
          {wisher && (
            <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={makeWish}>
              <textarea
                aria-label="Your wish"
                rows={3}
                placeholder="e.g. Add a priority to each task"
                style={styles.input}
                value={text}
                disabled={Boolean(progress)}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) makeWish(event);
                }}
              />
              <div style={styles.row}>
                <button type="submit" style={styles.primary} disabled={!text.trim() || Boolean(progress)}>
                  {progress ? `${progress}…` : "Make it so"}
                </button>
                {apiKey && !progress && (
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      apiKey.set(null);
                      setHasKey(false);
                    }}
                  >
                    Change API key
                  </button>
                )}
              </div>
            </form>
          )}
          {outcome?.status === "applied" && <p role="status" style={styles.applied}>✓ {outcome.summary}</p>}
          {outcome?.status === "declined" && <p role="status" style={styles.problem}>Can't do that here: {outcome.reason}</p>}
          {outcome?.status === "failed" && <p role="status" style={styles.problem}>That didn't work: {outcome.error}</p>}
        </>
      )}
    </section>
  );
}
