import { textWishStore, type WishStore } from "@wishkit/core";

/**
 * Keeps the user's wishes in this browser's localStorage. Data this version can't read is
 * moved aside to `<key>.unreadable` rather than overwritten, so nothing is lost silently.
 */
export function localWishStore(storageKey = "wishkit.wishes"): WishStore {
  // Used when localStorage is unavailable, so wishes still last until reload.
  let memory: string | null = null;

  return textWishStore({
    async read() {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return memory;
      }
    },
    async write(text) {
      memory = text;
      try {
        localStorage.setItem(storageKey, text);
      } catch {
        // Storage unavailable or full: the wishes last only until reload.
      }
    },
    async keepUnreadable(text) {
      try {
        localStorage.setItem(`${storageKey}.unreadable`, text);
        localStorage.removeItem(storageKey);
      } catch {
        // Leave it in place; the next save would fail the same way.
      }
    },
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  });
}
