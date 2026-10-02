// What the preload script exposes to the renderer as `window.desktop`. The renderer has no
// Node.js access; everything it needs from the system goes through these calls.

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

/** A request to the Claude API, made by the renderer and sent by the main process with the key. */
export type ClaudeRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
};

export type ClaudeResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
};

export type DesktopApi = {
  tasks: {
    list(): Promise<Task[]>;
    add(title: string): Promise<void>;
    toggle(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    /** Calls back with the new list whenever tasks change. Returns an unsubscribe function. */
    onChange(listener: (tasks: Task[]) => void): () => void;
  };
  /** The user's saved wishes, as text in a file next to the app's other data. */
  wishes: {
    read(): Promise<string | null>;
    write(text: string): Promise<void>;
    keepUnreadable(text: string): Promise<void>;
  };
  /** The Claude API key lives in the main process. The renderer can only ask whether one is set, or replace it. */
  apiKey: {
    has: boolean;
    description: string;
    set(key: string | null): Promise<void>;
  };
  claudeFetch(request: ClaudeRequest): Promise<ClaudeResponse>;
};
