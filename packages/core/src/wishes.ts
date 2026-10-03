import type { BuildResult, Overlay } from "./runtime";
import type { Selection } from "./wish";

/** A wish the user made, kept so it can be turned off, on, or made again. */
export type SavedWish = {
  id: string;
  /** The user's words: the source of truth. The files below are a cache of them. */
  text: string;
  /** What changed, in one sentence. */
  summary: string;
  selection: Selection | null;
  createdAt: number;
  /** The new content of every file this wish changed. */
  files: Record<string, string>;
  /** A hash of each changed file's source as the app shipped it. A mismatch means the app has changed since. */
  base: Record<string, string>;
  /** Earlier wishes whose changes this one built on. */
  dependsOn: string[];
  enabled: boolean;
};

/** Where a user's wishes are kept: localStorage on the web, a file on disk in Electron. */
export type WishStore = {
  load(): Promise<SavedWish[]>;
  save(wishes: SavedWish[]): Promise<void>;
  /** Calls back when the wishes change elsewhere, e.g. in another tab. Returns an unsubscribe function. */
  subscribe?(listener: () => void): () => void;
};

/** A short, stable hash of a file's text (32-bit FNV-1a). Used only to notice that a file changed. */
export function hashSource(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const MISSING = "missing";

function baseHashOf(path: string, sources: Record<string, string>): string {
  const source = sources[path];
  return source === undefined ? MISSING : hashSource(source);
}

/** True when a file this wish changed is no longer the version the wish was made against. */
export function isStale(wish: SavedWish, sources: Record<string, string>): boolean {
  return Object.entries(wish.base).some(([path, hash]) => baseHashOf(path, sources) !== hash);
}

/** The wishes that are live: turned on, not stale, and with every wish they build on live too. */
export function liveWishes(wishes: SavedWish[], sources: Record<string, string>): SavedWish[] {
  const live = new Set<string>();
  for (const wish of wishes) {
    if (wish.enabled && !isStale(wish, sources) && wish.dependsOn.every((id) => live.has(id))) live.add(wish.id);
  }
  return wishes.filter((wish) => live.has(wish.id));
}

/** The overlay the live wishes add up to, applied oldest first. */
export function composeOverlay(wishes: SavedWish[], sources: Record<string, string>): Overlay {
  return Object.assign({}, ...liveWishes(wishes, sources).map((wish) => wish.files));
}

/** Records a new wish. It builds on whichever live wishes last changed the files it changes. */
export function addWish(
  wishes: SavedWish[],
  wish: Pick<SavedWish, "id" | "text" | "summary" | "selection" | "createdAt" | "files">,
  sources: Record<string, string>,
): SavedWish[] {
  const live = liveWishes(wishes, sources);
  const dependsOn = new Set<string>();
  for (const path of Object.keys(wish.files)) {
    const provider = [...live].reverse().find((earlier) => path in earlier.files);
    if (provider) dependsOn.add(provider.id);
  }
  const base = Object.fromEntries(Object.keys(wish.files).map((path) => [path, baseHashOf(path, sources)]));
  return [...wishes, { ...wish, base, dependsOn: [...dependsOn], enabled: true }];
}

/** Every wish that builds on `id`, directly or through another wish. */
export function dependentsOf(wishes: SavedWish[], id: string): SavedWish[] {
  const found = new Set([id]);
  for (const wish of wishes) {
    if (wish.dependsOn.some((dependency) => found.has(dependency))) found.add(wish.id);
  }
  found.delete(id);
  return wishes.filter((wish) => found.has(wish.id));
}

/** Every wish `id` builds on, directly or through another wish. */
export function dependenciesOf(wishes: SavedWish[], id: string): SavedWish[] {
  const byId = new Map(wishes.map((wish) => [wish.id, wish]));
  const found = new Set<string>();
  const pending = [...(byId.get(id)?.dependsOn ?? [])];
  while (pending.length) {
    const next = pending.pop()!;
    if (found.has(next) || !byId.has(next)) continue;
    found.add(next);
    pending.push(...byId.get(next)!.dependsOn);
  }
  return wishes.filter((wish) => found.has(wish.id));
}

/**
 * Turns a wish on or off. Turning one off also turns off the wishes built on it. Turning one on
 * also turns on the wishes it builds on, and turns off later wishes that rewrote the same files
 * without it, since only one version of a file can be live. `changed` lists the other wishes
 * this switched, so the user can be told.
 */
export function setEnabled(
  wishes: SavedWish[],
  id: string,
  enabled: boolean,
): { wishes: SavedWish[]; changed: SavedWish[] } {
  const target = wishes.find((wish) => wish.id === id);
  if (!target) return { wishes, changed: [] };
  const next = new Map(wishes.map((wish) => [wish.id, wish.enabled]));

  function turnOff(wish: SavedWish) {
    next.set(wish.id, false);
    for (const dependent of dependentsOf(wishes, wish.id)) next.set(dependent.id, false);
  }

  if (!enabled) {
    turnOff(target);
  } else {
    const turningOn = [...dependenciesOf(wishes, id), target];
    for (const wish of turningOn) next.set(wish.id, true);
    const keep = new Set([...turningOn, ...dependentsOf(wishes, id)].map((wish) => wish.id));
    for (const on of turningOn) {
      const paths = Object.keys(on.files);
      for (const later of wishes.slice(wishes.indexOf(on) + 1)) {
        if (!keep.has(later.id) && next.get(later.id) && paths.some((path) => path in later.files)) {
          if (!dependentsOf(wishes, on.id).includes(later)) turnOff(later);
        }
      }
    }
  }

  const changed = wishes.filter((wish) => wish.id !== id && next.get(wish.id) !== wish.enabled);
  return { wishes: wishes.map((wish) => ({ ...wish, enabled: next.get(wish.id)! })), changed };
}

/** Removes a wish and every wish built on it. */
export function removeWish(wishes: SavedWish[], id: string): SavedWish[] {
  const gone = new Set([id, ...dependentsOf(wishes, id).map((wish) => wish.id)]);
  return wishes.filter((wish) => !gone.has(wish.id));
}

export type WishListSnapshot = {
  wishes: SavedWish[];
  /**
   * Ids of the wishes in the running app. A wish that is turned on but not live was made
   * against an older version of the app, or builds on one that was, and needs making again.
   */
  live: Set<string>;
  /** Why the saved wishes could not be turned on, if they couldn't. */
  error: string | null;
};

export type WishListOptions = {
  store: WishStore;
  /** The programmable folder's sources as the app shipped them. */
  sources: Record<string, string>;
  /** Applies an overlay and reports whether it built and rendered, e.g. runtime.tryApply. */
  apply(overlay: Overlay): Promise<BuildResult>;
  /** The overlay the app runs now, so an unchanged one isn't applied again. */
  current?: () => Overlay;
  newId?: () => string;
  now?: () => number;
};

export type WishListChange = { ok: true; changed: SavedWish[] } | { ok: false; error: string };

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * A user's saved wishes and the overlay they add up to. Every change re-reads the store first,
 * so wishes made in another tab are kept, and is saved only once the new overlay has applied.
 */
export function createWishList(options: WishListOptions) {
  const { store, sources, apply } = options;
  const newId = options.newId ?? randomId;
  const now = options.now ?? Date.now;
  let snapshot: WishListSnapshot = { wishes: [], live: new Set(), error: null };
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();

  function publish(wishes: SavedWish[], error: string | null = null) {
    const live = new Set(liveWishes(wishes, sources).map((wish) => wish.id));
    snapshot = { wishes, live, error };
    listeners.forEach((listener) => listener());
  }

  /** Runs changes one at a time, so two clicks can't interleave their reads and writes. */
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** Applies the overlay the wishes add up to, unless the app already runs exactly that. */
  async function applyWishes(wishes: SavedWish[]): Promise<BuildResult> {
    const overlay = composeOverlay(wishes, sources);
    const current = options.current?.();
    if (current && sameOverlay(current, overlay)) return { ok: true };
    return apply(overlay);
  }

  async function applyAndSave(wishes: SavedWish[], changed: SavedWish[]): Promise<WishListChange> {
    const result = await applyWishes(wishes);
    if (!result.ok) return { ok: false, error: result.errors.join("\n") };
    await store.save(wishes);
    publish(wishes);
    return { ok: true, changed };
  }

  /** Loads the saved wishes and turns the live ones on. */
  function restore(): Promise<WishListChange> {
    return serial(async () => {
      const wishes = await store.load();
      const result = await applyWishes(wishes);
      if (!result.ok) {
        const error = result.errors.join("\n");
        publish(wishes, error);
        return { ok: false, error };
      }
      publish(wishes);
      return { ok: true, changed: [] };
    });
  }

  store.subscribe?.(() => void restore());

  let restoredOnce: Promise<WishListChange> | undefined;

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore,
    /**
     * Restores the saved wishes the first time it is called and resolves once they are live.
     * Anything that reads or changes the app's files waits for this first, so it never starts
     * from the app's original files while saved wishes are still on their way back.
     */
    ready: (): Promise<WishListChange> =>
      (restoredOnce ??= restore().catch((error: unknown) => ({ ok: false as const, error: String(error) }))),
    /** Saves a wish whose change is already live. It starts out turned on. */
    record(wish: { text: string; summary: string; selection: Selection | null; files: Record<string, string> }) {
      return serial(async () => {
        const saved = await store.load();
        const wishes = addWish(saved, { ...wish, id: newId(), createdAt: now() }, sources);
        await store.save(wishes);
        publish(wishes);
        return wishes.at(-1)!;
      });
    },
    /**
     * Replaces a wish that needs making again with its new version, whose change is already
     * live. Wishes built on the old version stay, waiting to be made again themselves.
     */
    remake(id: string, wish: { summary: string; files: Record<string, string> }) {
      return serial(async () => {
        const saved = await store.load();
        const old = saved.find((item) => item.id === id);
        if (!old) throw new Error("That wish no longer exists");
        const rest = saved.filter((item) => item.id !== id);
        const wishes = addWish(rest, { ...old, ...wish, id: newId(), createdAt: now() }, sources);
        await store.save(wishes);
        publish(wishes);
        return wishes.at(-1)!;
      });
    },
    /** Turns a wish on or off. Nothing changes if the result fails to build or render. */
    setEnabled(id: string, enabled: boolean): Promise<WishListChange> {
      return serial(async () => {
        const next = setEnabled(await store.load(), id, enabled);
        return applyAndSave(next.wishes, next.changed);
      });
    },
    /** Deletes a wish and the wishes built on it. */
    remove(id: string): Promise<WishListChange> {
      return serial(async () => {
        const saved = await store.load();
        const removed = [...saved.filter((wish) => wish.id === id), ...dependentsOf(saved, id)];
        return applyAndSave(removeWish(saved, id), removed.slice(1));
      });
    },
  };
}

export type WishList = ReturnType<typeof createWishList>;

function sameOverlay(a: Overlay, b: Overlay): boolean {
  const paths = Object.keys(a);
  return paths.length === Object.keys(b).length && paths.every((path) => a[path] === b[path]);
}

const STORE_VERSION = 1;

function isSavedWish(value: unknown): value is SavedWish {
  if (typeof value !== "object" || value === null) return false;
  const wish = value as Record<string, unknown>;
  const isStrings = (record: unknown) =>
    typeof record === "object" && record !== null && Object.values(record).every((item) => typeof item === "string");
  return (
    typeof wish.id === "string" &&
    typeof wish.text === "string" &&
    typeof wish.summary === "string" &&
    typeof wish.createdAt === "number" &&
    typeof wish.enabled === "boolean" &&
    isStrings(wish.files) &&
    isStrings(wish.base) &&
    Array.isArray(wish.dependsOn) &&
    wish.dependsOn.every((id) => typeof id === "string")
  );
}

/** Reads the stored form, or returns null if it isn't one this version understands. */
export function parseWishes(text: string | null): SavedWish[] | null {
  if (text === null) return [];
  try {
    const data = JSON.parse(text) as { version?: unknown; wishes?: unknown };
    if (data.version !== STORE_VERSION || !Array.isArray(data.wishes) || !data.wishes.every(isSavedWish)) return null;
    return data.wishes.map((wish) => ({ ...wish, selection: wish.selection ?? null }));
  } catch {
    return null;
  }
}

export function serializeWishes(wishes: SavedWish[]): string {
  return JSON.stringify({ version: STORE_VERSION, wishes });
}

/** Keeps wishes only until reload. Useful in tests and when nothing should be saved. */
export function memoryWishStore(initial: SavedWish[] = []): WishStore {
  let wishes = initial;
  return {
    load: async () => wishes,
    save: async (next) => {
      wishes = next;
    },
  };
}

/** Somewhere to keep the wishes as text: localStorage, a file, a database row. */
export type TextStorage = {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  /** Moves text this version can't read out of the way, so saving over it loses nothing. */
  keepUnreadable(text: string): Promise<void>;
  subscribe?(listener: () => void): () => void;
};

/** A WishStore over plain text storage, in the format parseWishes() reads. */
export function textWishStore(storage: TextStorage): WishStore {
  return {
    async load() {
      const text = await storage.read();
      const wishes = parseWishes(text);
      if (wishes) return wishes;
      await storage.keepUnreadable(text!);
      return [];
    },
    save: (wishes) => storage.write(serializeWishes(wishes)),
    subscribe: storage.subscribe && ((listener) => storage.subscribe!(listener)),
  };
}
