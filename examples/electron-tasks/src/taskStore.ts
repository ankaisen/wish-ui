import { useSyncExternalStore } from "react";
import type { DesktopApi, Task } from "../electron/api";

export type { Task };

/** The task list as the main process keeps it. Changes go to the main process and come back as updates. */
export function createTaskStore(api: DesktopApi["tasks"], initial: Task[]) {
  let tasks = initial;
  const listeners = new Set<() => void>();

  api.onChange((next) => {
    tasks = next;
    listeners.forEach((listener) => listener());
  });

  return {
    getAll: () => tasks,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(title: string) {
      const trimmed = title.trim();
      if (trimmed) void api.add(trimmed);
    },
    toggle: (id: string) => void api.toggle(id),
    remove: (id: string) => void api.remove(id),
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;

export function useTaskList(store: TaskStore): Task[] {
  return useSyncExternalStore(store.subscribe, store.getAll);
}
