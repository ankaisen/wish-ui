import {
  dependentsOf,
  type ProgrammableRuntime,
  type SavedWish,
  type Selection,
  type Wisher,
  type WishList,
  type WishOutcome,
} from "@wishkit/core";
import { useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import type { ApiKeyStore } from "./apiKey";
import { pickElement } from "./pickElement";

export type PanelProps = {
  runtime: ProgrammableRuntime;
  /** The user's saved wishes. */
  wishes: WishList;
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
  list: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" },
  item: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 },
  itemText: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  small: { padding: "2px 8px", border: "1px solid #d0d7de", borderRadius: 6, background: "#f6f8fa", color: "inherit", font: "inherit", fontSize: 12, cursor: "pointer", alignSelf: "flex-start" },
} satisfies Record<string, CSSProperties>;

function quoteList(wishes: SavedWish[]): string {
  return wishes.map((wish) => `“${wish.text}”`).join(", ");
}

/** The floating wish panel: select part of the app, describe a change, see it happen, turn it off again. */
export function Panel({ runtime, wishes, wisher, apiKey }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<"preparing" | "picking" | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<WishOutcome | null>(null);
  /** The wish the last outcome is about, so it can be undone from there. */
  const [madeId, setMadeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useSyncExternalStore(wishes.subscribe, wishes.getSnapshot);
  const [hasKey, setHasKey] = useState(() => !apiKey || Boolean(apiKey.get()));
  const [keyDraft, setKeyDraft] = useState("");

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

  /** Runs a wish through the wisher and saves it once its change is live. */
  async function run(wishText: string, wishSelection: Selection | null, save: (outcome: Extract<WishOutcome, { status: "applied" }>) => Promise<SavedWish>) {
    if (!wisher || progress) return false;
    setOutcome(null);
    setNotice(null);
    setMadeId(null);
    setProgress("Starting");
    try {
      await runtime.prepare();
      const result = await wisher({ text: wishText, selection: wishSelection, workspace: runtime, onProgress: setProgress });
      if (result.status === "applied") setMadeId((await save(result)).id);
      setOutcome(result);
      return result.status === "applied";
    } catch (error) {
      setOutcome({ status: "failed", error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      setProgress(null);
    }
  }

  async function makeWish(event: FormEvent) {
    event.preventDefault();
    const wishText = text.trim();
    if (!wishText) return;
    const applied = await run(wishText, selection, ({ summary, files }) =>
      wishes.record({ text: wishText, summary, selection, files }),
    );
    if (applied) {
      setText("");
      setSelection(null);
    }
  }

  /** Makes a wish again against the app as it is now, replacing its old version. */
  function remake(wish: SavedWish) {
    return run(wish.text, null, ({ summary, files }) => wishes.remake(wish.id, { summary, files }));
  }

  async function toggle(wish: SavedWish, enabled: boolean) {
    setOutcome(null);
    setNotice(null);
    const result = await wishes.setEnabled(wish.id, enabled);
    if (!result.ok) {
      setOutcome({ status: "failed", error: result.error });
    } else if (result.changed.length) {
      const turnedOn = result.changed.filter((item) => !item.enabled);
      const turnedOff = result.changed.filter((item) => item.enabled);
      setNotice(
        [
          turnedOn.length ? `Also turned on ${quoteList(turnedOn)}, which it builds on.` : "",
          turnedOff.length
            ? `Also turned off ${quoteList(turnedOff)}, which ${enabled ? "changed the same part" : "built on it"}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  async function remove(wish: SavedWish) {
    const dependents = dependentsOf(list.wishes, wish.id);
    const question = dependents.length
      ? `Remove “${wish.text}” and the wishes built on it (${quoteList(dependents)})? This can't be undone.`
      : `Remove “${wish.text}”? This can't be undone.`;
    if (!window.confirm(question)) return;
    setOutcome(null);
    setNotice(null);
    const result = await wishes.remove(wish.id);
    if (!result.ok) setOutcome({ status: "failed", error: result.error });
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
          {outcome?.status === "applied" && (
            <p role="status" style={styles.applied}>
              ✓ {outcome.summary}{" "}
              {madeId && list.live.has(madeId) && (
                <button type="button" style={styles.small} onClick={() => toggle(list.wishes.find((wish) => wish.id === madeId)!, false)}>
                  Undo
                </button>
              )}
            </p>
          )}
          {outcome?.status === "declined" && <p role="status" style={styles.problem}>Can't do that here: {outcome.reason}</p>}
          {outcome?.status === "failed" && <p role="status" style={styles.problem}>That didn't work: {outcome.error}</p>}
          {notice && <p role="status" style={styles.hint}>{notice}</p>}
          {list.error && <p style={styles.problem}>Your saved wishes couldn't be turned on: {list.error}</p>}
          {list.wishes.length > 0 && (
            <section aria-label="Your wishes" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h3 style={{ ...styles.title, fontSize: 13 }}>Your wishes</h3>
              <ul style={styles.list}>
                {[...list.wishes].reverse().map((wish) => {
                  const needsRemake = wish.enabled && !list.live.has(wish.id);
                  return (
                    <li key={wish.id} style={styles.item}>
                      <input
                        type="checkbox"
                        aria-label={`${wish.enabled ? "Turn off" : "Turn on"}: ${wish.text}`}
                        checked={wish.enabled}
                        disabled={Boolean(progress)}
                        onChange={(event) => toggle(wish, event.target.checked)}
                      />
                      <span style={styles.itemText} title={wish.summary}>
                        {wish.text}
                        {needsRemake && (
                          <>
                            <span style={styles.hint}>The app changed since this wish, so it is paused.</span>
                            {wisher && (
                              <button type="button" style={styles.small} disabled={Boolean(progress)} onClick={() => remake(wish)}>
                                Make it again
                              </button>
                            )}
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove: ${wish.text}`}
                        style={styles.small}
                        disabled={Boolean(progress)}
                        onClick={() => remove(wish)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
