import { createTaskStore, useTaskList as useTasks, type Task, type TaskStore } from "./taskStore";

export type { Task, TaskStore };

/** The app's task list, loaded from the main process before the first render. */
export const taskStore = createTaskStore(window.desktop.tasks, await window.desktop.tasks.list());

export function useTaskList(store: TaskStore = taskStore): Task[] {
  return useTasks(store);
}
