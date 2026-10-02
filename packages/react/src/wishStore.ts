import { parseWishes, serializeWishes, type SavedWish, type WishStore } from "@wishkit/core";

/**
 * Keeps the user's wishes in this browser's localStorage. Data this version can't read is
 * moved aside to `<key>.unreadable` rather than overwritten, so nothing is lost silently.
 */
export function localWishStore(storageKey = "wishkit.wishes"): WishStore {
  let memory: SavedWish[] = [];

  function read(): SavedWish[] {
    let text: string | null;
    try {
      text = localStorage.getItem(storageKey);
    } catch {
      return memory;
    }
    const wishes = parseWishes(text);
    if (wishes) return wishes;
    try {
      localStorage.setItem(`${storageKey}.unreadable`, text!);
      localStorage.removeItem(storageKey);
    } catch {
      // Leave it in place; the next save would fail the same way.
    }
    return [];
  }

  return {
    async load() {
      return read();
    },
    async save(wishes) {
      memory = wishes;
      try {
        localStorage.setItem(storageKey, serializeWishes(wishes));
      } catch {
        // Storage unavailable or full: the wishes last only until reload.
      }
    },
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
