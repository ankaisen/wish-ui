/** Where the panel keeps the user's API key. */
export type ApiKeyStore = {
  get(): string | null;
  set(key: string | null): void;
  /** Tells the user where the key is kept. Shown above the key field. */
  description?: string;
};

/** Keeps the key in this browser's localStorage, never sent anywhere but the model provider. */
export function localApiKeyStore(storageKey = "wishkit.api-key"): ApiKeyStore {
  return {
    description: "It stays in this browser and is sent only to the Claude API.",
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
