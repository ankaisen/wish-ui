import { describe, expect, it } from "vitest";
import type { Overlay } from "./runtime";
import {
  addWish,
  composeOverlay,
  createWishList,
  hashSource,
  parseWishes,
  serializeWishes,
  setEnabled,
  type SavedWish,
  type WishStore,
} from "./wishes";

const sources = { "List.tsx": "list v1", "Bar.tsx": "bar v1" };

let nextId = 0;
function make(wishes: SavedWish[], id: string, files: Record<string, string>, from = sources): SavedWish[] {
  return addWish(wishes, { id, text: id, summary: id, selection: null, createdAt: nextId++, files }, from);
}

function enabledIds(wishes: SavedWish[]) {
  return wishes.filter((wish) => wish.enabled).map((wish) => wish.id);
}

describe("saved wishes", () => {
  it("add up to an overlay, later wishes winning", () => {
    let wishes = make([], "badges", { "List.tsx": "list + badges" });
    wishes = make(wishes, "hide bar", { "Bar.tsx": "" });
    wishes = make(wishes, "bigger badges", { "List.tsx": "list + big badges", "Badge.tsx": "badge" });

    expect(composeOverlay(wishes, sources)).toEqual({ "List.tsx": "list + big badges", "Bar.tsx": "", "Badge.tsx": "badge" });
    expect(wishes.map((wish) => wish.dependsOn)).toEqual([[], [], ["badges"]]);
  });

  it("turn off the wishes built on one that is turned off, and back on together", () => {
    let wishes = make([], "badges", { "List.tsx": "list + badges" });
    wishes = make(wishes, "bigger badges", { "List.tsx": "list + big badges" });
    wishes = make(wishes, "hide bar", { "Bar.tsx": "" });

    const off = setEnabled(wishes, "badges", false);
    expect(enabledIds(off.wishes)).toEqual(["hide bar"]);
    expect(off.changed.map((wish) => wish.id)).toEqual(["bigger badges"]);
    expect(composeOverlay(off.wishes, sources)).toEqual({ "Bar.tsx": "" });

    const on = setEnabled(off.wishes, "bigger badges", true);
    expect(enabledIds(on.wishes)).toEqual(["badges", "bigger badges", "hide bar"]);
    expect(on.changed.map((wish) => wish.id)).toEqual(["badges"]);
  });

  it("turn off a later wish that rewrote the same file without the one turned back on", () => {
    let wishes = make([], "badges", { "List.tsx": "list + badges" });
    wishes = setEnabled(wishes, "badges", false).wishes;
    wishes = make(wishes, "stripes", { "List.tsx": "list + stripes" });
    expect(wishes[1]!.dependsOn).toEqual([]);

    const on = setEnabled(wishes, "badges", true);
    expect(enabledIds(on.wishes)).toEqual(["badges"]);
    expect(on.changed.map((wish) => wish.id)).toEqual(["stripes"]);
  });

  it("stay off once the app's own version of their files changes", () => {
    let wishes = make([], "badges", { "List.tsx": "list + badges" });
    wishes = make(wishes, "bigger badges", { "List.tsx": "list + big badges" });
    wishes = make(wishes, "hide bar", { "Bar.tsx": "" });

    expect(composeOverlay(wishes, { ...sources, "List.tsx": "list v2" })).toEqual({ "Bar.tsx": "" });
  });

  it("round-trip through storage and reject data they don't understand", () => {
    const wishes = make([], "badges", { "List.tsx": "list + badges" });
    expect(parseWishes(serializeWishes(wishes))).toEqual(wishes);
    expect(parseWishes(null)).toEqual([]);
    expect(parseWishes("{}")).toBeNull();
    expect(parseWishes("not json")).toBeNull();
    expect(parseWishes(JSON.stringify({ version: 1, wishes: [{ id: 1 }] }))).toBeNull();
  });

  it("hash file text stably", () => {
    expect(hashSource("abc")).toBe(hashSource("abc"));
    expect(hashSource("abc")).not.toBe(hashSource("abd"));
  });
});

function memoryStore(initial: SavedWish[] = []): WishStore & { data: SavedWish[] } {
  return {
    data: initial,
    async load() {
      return this.data;
    },
    async save(wishes) {
      this.data = wishes;
    },
  };
}

describe("wish list", () => {
  function setup(store = memoryStore(), failWhen?: (overlay: Overlay) => boolean) {
    const applied: Overlay[] = [];
    let id = 0;
    const list = createWishList({
      store,
      sources,
      newId: () => `w${++id}`,
      now: () => 0,
      async apply(overlay) {
        if (failWhen?.(overlay)) return { ok: false, errors: ["Error while rendering: boom"] };
        applied.push(overlay);
        return { ok: true };
      },
    });
    return { list, store, applied };
  }

  it("restores saved wishes into the app", async () => {
    const { list, applied } = setup(memoryStore(make([], "badges", { "List.tsx": "list + badges" })));
    expect(await list.restore()).toEqual({ ok: true, changed: [] });
    expect(applied).toEqual([{ "List.tsx": "list + badges" }]);
    expect(list.getSnapshot().wishes).toHaveLength(1);
  });

  it("records wishes and toggles them", async () => {
    const { list, store, applied } = setup();
    await list.record({ text: "badges", summary: "Added badges", selection: null, files: { "List.tsx": "list + badges" } });
    expect(store.data.map((wish) => wish.id)).toEqual(["w1"]);

    expect(await list.setEnabled("w1", false)).toEqual({ ok: true, changed: [] });
    expect(applied.at(-1)).toEqual({});
    expect(store.data[0]!.enabled).toBe(false);
  });

  it("keeps wishes saved in another tab", async () => {
    const { list, store } = setup();
    await list.record({ text: "a", summary: "a", selection: null, files: { "Bar.tsx": "a" } });
    store.data = make(store.data, "from another tab", { "List.tsx": "other" });
    await list.record({ text: "b", summary: "b", selection: null, files: { "Bar.tsx": "b" } });
    expect(store.data.map((wish) => wish.id)).toEqual(["w1", "from another tab", "w2"]);
  });

  it("changes nothing when a toggle would break the app", async () => {
    const { list, store } = setup(memoryStore(), (overlay) => !("Bar.tsx" in overlay) && "List.tsx" in overlay);
    await list.record({ text: "a", summary: "a", selection: null, files: { "Bar.tsx": "a" } });
    await list.record({ text: "b", summary: "b", selection: null, files: { "List.tsx": "uses a" } });

    const result = await list.setEnabled("w1", false);
    expect(result).toEqual({ ok: false, error: "Error while rendering: boom" });
    expect(enabledIds(store.data)).toEqual(["w1", "w2"]);
  });

  it("marks wishes made against an older app", async () => {
    const old = make([], "badges", { "List.tsx": "list + badges" }, { ...sources, "List.tsx": "list v0" });
    const { list, applied } = setup(memoryStore(old));
    await list.restore();
    expect(list.getSnapshot().live).toEqual(new Set());
    expect(applied).toEqual([{}]);

    const remade = await list.remake("badges", { summary: "Added badges again", files: { "List.tsx": "v1 + badges" } });
    expect(list.getSnapshot().wishes).toEqual([remade]);
    expect(remade).toMatchObject({ text: "badges", summary: "Added badges again", enabled: true });
    expect(list.getSnapshot().live).toEqual(new Set([remade.id]));
  });

  it("doesn't re-apply an overlay the app already runs", async () => {
    const applied: Overlay[] = [];
    const list = createWishList({
      store: memoryStore(),
      sources,
      current: () => ({}),
      async apply(overlay) {
        applied.push(overlay);
        return { ok: true };
      },
    });
    await list.restore();
    expect(applied).toEqual([]);
  });
});
