import { useSyncExternalStore } from "react";

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

const STORAGE_KEY = "wish-ui.web-tasks.tasks";

const SEED: Task[] = [
  { id: "1", title: "Buy groceries", done: false },
  { id: "2", title: "Finish report", done: false },
  { id: "3", title: "Read paper", done: false },
];

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : SEED;
  } catch {
    return SEED;
  }
}

function save(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage can be unavailable (private mode, quota); the app keeps working in memory.
  }
}

export function createTaskStore(initial: Task[] = load(), persist = save) {
  let tasks = initial;
  const listeners = new Set<() => void>();

  function set(next: Task[]) {
    tasks = next;
    persist(tasks);
    listeners.forEach((listener) => listener());
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
      set([...tasks, { id: crypto.randomUUID(), title: trimmed, done: false }]);
    },
    toggle(id: string) {
      set(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
    },
    remove(id: string) {
      set(tasks.filter((task) => task.id !== id));
    },
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;

export const taskStore = createTaskStore();

export function useTaskList(store: TaskStore = taskStore): Task[] {
  return useSyncExternalStore(store.subscribe, store.getAll);
}
