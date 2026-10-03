import {
  dependentsOf,
  type ProgrammableRuntime,
  type SavedWish,
  type Selection,
  type Wisher,
  type WishList,
  type WishOutcome,
} from "@wishkit/core";
import { html, nothing, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import type { ApiKeyStore } from "./apiKey";
import { pickElement } from "./pickElement";

export type PanelOptions = {
  runtime: ProgrammableRuntime;
  /** The user's saved wishes. */
  wishes: WishList;
  /** Turns wishes into changes. Without one, the panel only selects. */
  wisher?: Wisher;
  /** When given, the panel asks for an API key before the first wish. */
  apiKey?: ApiKeyStore;
};

const styles = {
  launcher:
    "position: fixed; right: 20px; bottom: 20px; z-index: 2147483645; padding: 10px 16px; border: none; border-radius: 999px; background: #6e56cf; color: #fff; font: 600 14px system-ui, sans-serif; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); cursor: pointer;",
  panel:
    "position: fixed; right: 20px; bottom: 20px; z-index: 2147483645; width: 360px; max-width: calc(100vw - 40px); padding: 16px; border-radius: 12px; background: #fff; color: #1f2328; font: 14px system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; gap: 10px;",
  header: "display: flex; justify-content: space-between; align-items: center;",
  title: "margin: 0; font-size: 15px;",
  subtitle: "margin: 0; font-size: 13px;",
  form: "display: flex; flex-direction: column; gap: 8px;",
  row: "display: flex; gap: 8px; flex-wrap: wrap; align-items: center;",
  button:
    "padding: 6px 12px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; color: inherit; font: inherit; cursor: pointer;",
  primary:
    "padding: 6px 12px; border: none; border-radius: 6px; background: #6e56cf; color: #fff; font: 600 14px system-ui, sans-serif; cursor: pointer;",
  input:
    "width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #d0d7de; border-radius: 6px; font: inherit; resize: vertical;",
  selection: "margin: 0; padding: 8px; border-radius: 6px; background: #f3f0ff; font-size: 13px;",
  hint: "margin: 0; color: #57606a; font-size: 13px;",
  applied: "margin: 0; padding: 8px; border-radius: 6px; background: #dafbe1; font-size: 13px;",
  problem: "margin: 0; padding: 8px; border-radius: 6px; background: #fff8c5; font-size: 13px;",
  section: "display: flex; flex-direction: column; gap: 6px;",
  list: "margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;",
  item: "display: flex; gap: 8px; align-items: flex-start; font-size: 13px;",
  itemText: "flex: 1; display: flex; flex-direction: column; gap: 4px;",
  small:
    "padding: 2px 8px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; color: inherit; font: inherit; font-size: 12px; cursor: pointer; align-self: flex-start;",
};

function quoteList(wishes: SavedWish[]): string {
  return wishes.map((wish) => `“${wish.text}”`).join(", ");
}

type State = {
  open: boolean;
  picking: "preparing" | "picking" | null;
  selection: Selection | null;
  text: string;
  progress: string | null;
  outcome: WishOutcome | null;
  /** The wish the last outcome is about, so it can be undone from there. */
  madeId: string | null;
  notice: string | null;
  hasKey: boolean;
  keyDraft: string;
};

/**
 * Renders the floating wish panel into `host`: select part of the app, describe a change, see it
 * happen, turn it off again. Plain DOM, so it works the same in every framework. Returns a
 * function that removes it.
 */
export function mountPanel(host: HTMLElement, { runtime, wishes, wisher, apiKey }: PanelOptions): () => void {
  let state: State = {
    open: false,
    picking: null,
    selection: null,
    text: "",
    progress: null,
    outcome: null,
    madeId: null,
    notice: null,
    hasKey: !apiKey || Boolean(apiKey.get()),
    keyDraft: "",
  };
  let mounted = true;

  function set(patch: Partial<State>) {
    state = { ...state, ...patch };
    update();
  }

  async function select() {
    set({ picking: "preparing" });
    try {
      // The first pick switches to modules compiled from source, which carry data-source-* attributes.
      await wishes.ready();
      const prepared = await runtime.prepare();
      if (!prepared.ok) {
        set({ outcome: { status: "failed", error: prepared.errors.join("; ") } });
        return;
      }
      // Listen before showing "Click something", so it never shows too early.
      const pick = pickElement(host.ownerDocument);
      set({ picking: "picking" });
      const picked = await pick;
      if (picked) set({ selection: picked });
    } finally {
      set({ picking: null });
    }
  }

  /** Runs a wish through the wisher and saves it once its change is live. */
  async function run(
    wishText: string,
    wishSelection: Selection | null,
    save: (outcome: Extract<WishOutcome, { status: "applied" }>) => Promise<SavedWish>,
  ) {
    if (!wisher || state.progress) return false;
    set({ outcome: null, notice: null, madeId: null, progress: "Starting" });
    try {
      await wishes.ready();
      await runtime.prepare();
      const result = await wisher({
        text: wishText,
        selection: wishSelection,
        workspace: runtime,
        onProgress: (progress) => set({ progress }),
      });
      if (result.status === "applied") set({ madeId: (await save(result)).id });
      set({ outcome: result });
      return result.status === "applied";
    } catch (error) {
      set({ outcome: { status: "failed", error: error instanceof Error ? error.message : String(error) } });
      return false;
    } finally {
      set({ progress: null });
    }
  }

  async function makeWish(event: Event) {
    event.preventDefault();
    const wishText = state.text.trim();
    if (!wishText) return;
    const selection = state.selection;
    const applied = await run(wishText, selection, ({ summary, files }) =>
      wishes.record({ text: wishText, summary, selection, files }),
    );
    if (applied) set({ text: "", selection: null });
  }

  /** Makes a wish again against the app as it is now, replacing its old version. */
  function remake(wish: SavedWish) {
    return run(wish.text, null, ({ summary, files }) => wishes.remake(wish.id, { summary, files }));
  }

  async function toggle(wish: SavedWish, enabled: boolean) {
    set({ outcome: null, notice: null });
    const result = await wishes.setEnabled(wish.id, enabled);
    if (!result.ok) {
      set({ outcome: { status: "failed", error: result.error } });
    } else if (result.changed.length) {
      const turnedOn = result.changed.filter((item) => !item.enabled);
      const turnedOff = result.changed.filter((item) => item.enabled);
      set({
        notice: [
          turnedOn.length ? `Also turned on ${quoteList(turnedOn)}, which it builds on.` : "",
          turnedOff.length
            ? `Also turned off ${quoteList(turnedOff)}, which ${enabled ? "changed the same part" : "built on it"}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
  }

  async function remove(wish: SavedWish) {
    const dependents = dependentsOf(wishes.getSnapshot().wishes, wish.id);
    const question = dependents.length
      ? `Remove “${wish.text}” and the wishes built on it (${quoteList(dependents)})? This can't be undone.`
      : `Remove “${wish.text}”? This can't be undone.`;
    if (!window.confirm(question)) return;
    set({ outcome: null, notice: null });
    const result = await wishes.remove(wish.id);
    if (!result.ok) set({ outcome: { status: "failed", error: result.error } });
  }

  function saveKey(event: Event) {
    event.preventDefault();
    if (!apiKey || !state.keyDraft.trim()) return;
    apiKey.set(state.keyDraft.trim());
    set({ keyDraft: "", hasKey: true });
  }

  const valueOf = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value;

  function keyForm() {
    return html`<form style=${styles.form} @submit=${saveKey}>
      <p style=${styles.hint}>Enter your Claude API key. ${apiKey?.description ?? ""}</p>
      <input
        aria-label="API key"
        type="password"
        placeholder="sk-ant-…"
        style=${styles.input}
        .value=${state.keyDraft}
        @input=${(event: Event) => set({ keyDraft: valueOf(event) })}
      />
      <div style=${styles.row}>
        <button type="submit" style=${styles.primary}>Save key</button>
      </div>
    </form>`;
  }

  function wishForm() {
    const { progress, text } = state;
    return html`<form style=${styles.form} @submit=${makeWish}>
      <textarea
        aria-label="Your wish"
        rows="3"
        placeholder="e.g. Add a priority to each task"
        style=${styles.input}
        .value=${text}
        ?disabled=${Boolean(progress)}
        @input=${(event: Event) => set({ text: valueOf(event) })}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void makeWish(event);
        }}
      ></textarea>
      <div style=${styles.row}>
        <button type="submit" style=${styles.primary} ?disabled=${!text.trim() || Boolean(progress)}>
          ${progress ? `${progress}…` : "Make it so"}
        </button>
        ${apiKey && !progress
          ? html`<button
              type="button"
              style=${styles.button}
              @click=${() => {
                apiKey.set(null);
                set({ hasKey: false });
              }}
            >
              Change API key
            </button>`
          : nothing}
      </div>
    </form>`;
  }

  function outcomeView() {
    const { outcome, madeId } = state;
    const list = wishes.getSnapshot();
    if (outcome?.status === "applied") {
      const made = madeId && list.live.has(madeId) ? list.wishes.find((wish) => wish.id === madeId) : undefined;
      return html`<p role="status" style=${styles.applied}>
        ✓ ${outcome.summary}
        ${made ? html`<button type="button" style=${styles.small} @click=${() => toggle(made, false)}>Undo</button>` : nothing}
      </p>`;
    }
    if (outcome?.status === "declined") {
      return html`<p role="status" style=${styles.problem}>Can't do that here: ${outcome.reason}</p>`;
    }
    if (outcome?.status === "failed") {
      return html`<p role="status" style=${styles.problem}>That didn't work: ${outcome.error}</p>`;
    }
    return nothing;
  }

  function wishList() {
    const list = wishes.getSnapshot();
    const busy = Boolean(state.progress);
    if (list.wishes.length === 0) return nothing;
    return html`<section aria-label="Your wishes" style=${styles.section}>
      <h3 style=${styles.subtitle}>Your wishes</h3>
      <ul style=${styles.list}>
        ${repeat([...list.wishes].reverse(), (wish) => wish.id, (wish) => {
          const needsRemake = wish.enabled && !list.live.has(wish.id);
          return html`<li style=${styles.item}>
            <input
              type="checkbox"
              aria-label=${`${wish.enabled ? "Turn off" : "Turn on"}: ${wish.text}`}
              .checked=${wish.enabled}
              ?disabled=${busy}
              @change=${(event: Event) => toggle(wish, (event.target as HTMLInputElement).checked)}
            />
            <span style=${styles.itemText} title=${wish.summary}>
              ${wish.text}
              ${needsRemake
                ? html`<span style=${styles.hint}>The app changed since this wish, so it is paused.</span>
                    ${wisher
                      ? html`<button type="button" style=${styles.small} ?disabled=${busy} @click=${() => remake(wish)}>
                          Make it again
                        </button>`
                      : nothing}`
                : nothing}
            </span>
            <button
              type="button"
              aria-label=${`Remove: ${wish.text}`}
              style=${styles.small}
              ?disabled=${busy}
              @click=${() => remove(wish)}
            >
              ×
            </button>
          </li>`;
        })}
      </ul>
    </section>`;
  }

  function view() {
    const { open, picking, progress, selection, notice } = state;
    if (!open) {
      return html`<button type="button" style=${styles.launcher} @click=${() => set({ open: true })}>✨ Make a wish</button>`;
    }
    const list = wishes.getSnapshot();
    return html`<section aria-label="Wish panel" style=${styles.panel} data-wish-panel="">
      <div style=${styles.header}>
        <h2 style=${styles.title}>Make a wish</h2>
        <button type="button" aria-label="Close" style=${styles.button} @click=${() => set({ open: false })}>×</button>
      </div>
      ${!state.hasKey && apiKey
        ? keyForm()
        : html`<div style=${styles.row}>
              <button type="button" style=${styles.button} ?disabled=${Boolean(picking || progress)} @click=${select}>
                ${picking === "picking"
                  ? "Click something… (Esc to cancel)"
                  : picking === "preparing"
                    ? "Getting ready…"
                    : "Select part of the app"}
              </button>
            </div>
            ${selection
              ? html`<p style=${styles.selection}>
                  Selected <code>&lt;${selection.tag}&gt;</code> ${selection.text ? `“${selection.text}” ` : ""}
                  <button type="button" style=${styles.button} @click=${() => set({ selection: null })}>Clear</button>
                </p>`
              : html`<p style=${styles.hint}>Select what you want to change, or just describe it.</p>`}
            ${wisher ? wishForm() : nothing} ${outcomeView()}
            ${notice ? html`<p role="status" style=${styles.hint}>${notice}</p>` : nothing}
            ${list.error
              ? html`<p style=${styles.problem}>Your saved wishes couldn't be turned on: ${list.error}</p>`
              : nothing}
            ${wishList()}`}
    </section>`;
  }

  function update() {
    if (mounted) render(view(), host);
  }

  const unsubscribe = wishes.subscribe(update);
  update();

  return () => {
    mounted = false;
    unsubscribe();
    render(nothing, host);
  };
}
