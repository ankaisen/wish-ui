// The only module files in this folder may import, besides approved packages such as @angular/core.
// Wishes can rewrite anything in src/programmable but reach the app only through here.
import { taskListSignal, taskStore, type Task } from "../store";

export type { Task };

export const tasks = {
  /** Every task, as a signal: read it as tasks.all(). */
  all: taskListSignal(taskStore),
  add: (title: string) => taskStore.add(title),
  toggle: (id: string) => taskStore.toggle(id),
  remove: (id: string) => taskStore.remove(id),
};
