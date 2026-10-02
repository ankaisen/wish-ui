// The only module files in this folder may import, besides approved packages such as React.
// Wishes can rewrite anything in src/programmable but reach the app only through here.
import { taskStore, useTaskList, type Task } from "../store";

export type { Task };

export const tasks = {
  useAll: () => useTaskList(taskStore),
  add: (title: string) => taskStore.add(title),
  toggle: (id: string) => taskStore.toggle(id),
  remove: (id: string) => taskStore.remove(id),
};
