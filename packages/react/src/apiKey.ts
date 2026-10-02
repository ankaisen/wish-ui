/** Where the panel keeps the user's API key. */
export type ApiKeyStore = {
  get(): string | null;
  set(key: string | null): void;
};

/** Keeps the key in this browser's localStorage, never sent anywhere but the model provider. */
export function localApiKeyStore(storageKey = "wish-ui.api-key"): ApiKeyStore {
  return {
    get() {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    set(key) {
      try {
        if (key) localStorage.setItem(storageKey, key);
        else localStorage.removeItem(storageKey);
      } catch {
        // Storage unavailable: the key lasts only until reload.
      }
    },
  };
}
