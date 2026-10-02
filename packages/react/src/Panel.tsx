import type { ProgrammableRuntime } from "@wish-ui/core";
import { useState, type CSSProperties, type ReactNode } from "react";
import { pickElement, type Selection } from "./pickElement";

export type PanelProps = {
  runtime: ProgrammableRuntime;
  /** Extra content under the selection, e.g. the wish form. */
  children?: (selection: Selection | null) => ReactNode;
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
    width: 340,
    maxWidth: "calc(100vw - 40px)",
    padding: 16,
    borderRadius: 12,
    background: "#fff",
    color: "#1f2328",
    font: "14px system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { margin: 0, fontSize: 15 },
  button: {
    padding: "6px 12px",
    border: "1px solid #d0d7de",
    borderRadius: 6,
    background: "#f6f8fa",
    font: "inherit",
    cursor: "pointer",
  },
  selection: { margin: "10px 0", padding: 8, borderRadius: 6, background: "#f3f0ff", fontSize: 13 },
  hint: { margin: "10px 0", color: "#57606a", fontSize: 13 },
} satisfies Record<string, CSSProperties>;

/** The floating wish panel: pick something in the app, then (with a wisher) ask for a change. */
export function Panel({ runtime, children }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  async function select() {
    setPicking(true);
    try {
      // The first pick switches to modules compiled from source, which carry data-source-* attributes.
      await runtime.prepare();
      const picked = await pickElement();
      if (picked) setSelection(picked);
    } finally {
      setPicking(false);
    }
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
      <button type="button" style={styles.button} disabled={picking} onClick={select}>
        {picking ? "Click something in the app… (Esc to cancel)" : "Select part of the app"}
      </button>
      {selection ? (
        <p style={styles.selection}>
          Selected <code>&lt;{selection.tag}&gt;</code> {selection.text && <>“{selection.text}” </>}
          in <code>{selection.file}:{selection.line}</code>{" "}
          <button type="button" style={styles.button} onClick={() => setSelection(null)}>
            Clear
          </button>
        </p>
      ) : (
        <p style={styles.hint}>Select what you want to change, or describe it below.</p>
      )}
      {children?.(selection)}
    </section>
  );
}
