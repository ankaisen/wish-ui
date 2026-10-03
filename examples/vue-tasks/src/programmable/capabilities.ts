// The only module files in this folder may import, besides approved packages such as Vue.
// Wishes can rewrite anything in src/programmable but reach the app only through here.
import { taskListRef, taskStore, type Task } from "../store";

export type { Task };

export const tasks = {
  /** Every task, kept up to date. Read it as tasks.all.value. */
  all: taskListRef(taskStore),
  add: (title: string) => taskStore.add(title),
  toggle: (id: string) => taskStore.toggle(id),
  remove: (id: string) => taskStore.remove(id),
};
