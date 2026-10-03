import { signal, type Signal } from "@angular/core";

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type TaskStorage = {
  /** Returns the persisted tasks, or null when nothing valid is stored. */
  load(): Task[] | null;
  save(tasks: Task[]): void;
  /** Calls back when another tab or window changes the stored tasks. */
  subscribe?(onChange: () => void): () => void;
};

const STORAGE_KEY = "wishkit.angular-tasks.tasks";

const SEED: Task[] = [
  { id: "1", title: "Buy groceries", done: false },
  { id: "2", title: "Finish report", done: false },
  { id: "3", title: "Read paper", done: false },
];

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" && typeof task.title === "string" && typeof task.done === "boolean";
}

export function parseTasks(raw: string | null): Task[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isTask) ? value : null;
  } catch {
    return null;
  }
}

export const localStorageTasks: TaskStorage = {
  load() {
    try {
      return parseTasks(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  },
  save(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Storage can be unavailable (private mode, quota); the app keeps working in memory.
    }
  },
  subscribe(onChange) {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) onChange();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  },
};

export function createTaskStore(storage: TaskStorage = localStorageTasks, seed: Task[] = SEED) {
  let tasks = storage.load() ?? seed;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  storage.subscribe?.(() => {
    tasks = storage.load() ?? tasks;
    notify();
  });

  // Apply each change to the latest persisted tasks, so a stale tab never overwrites newer ones.
  function update(change: (current: Task[]) => Task[]) {
    tasks = change(storage.load() ?? tasks);
    storage.save(tasks);
    notify();
  }

  return {
    getAll: () => tasks,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(title: string) {
      const trimmed = title.trim();
      if (!trimmed) return;
      update((current) => [...current, { id: crypto.randomUUID(), title: trimmed, done: false }]);
    },
    toggle(id: string) {
      update((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
    },
    remove(id: string) {
      update((current) => current.filter((task) => task.id !== id));
    },
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;

export const taskStore = createTaskStore();

/** The tasks as an Angular signal that follows the store. */
export function taskListSignal(store: TaskStore = taskStore): Signal<Task[]> {
  const tasks = signal(store.getAll());
  store.subscribe(() => tasks.set(store.getAll()));
  return tasks.asReadonly();
}
