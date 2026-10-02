import { expect, it } from "vitest";
import type { DesktopApi, Task } from "../electron/api";
import { createTaskStore } from "./taskStore";

it("sends changes to the main process and shows what comes back", async () => {
  const calls: string[] = [];
  let push: (tasks: Task[]) => void = () => {};
  const api: DesktopApi["tasks"] = {
    list: async () => [],
    add: async (title) => void calls.push(`add ${title}`),
    toggle: async (id) => void calls.push(`toggle ${id}`),
    remove: async (id) => void calls.push(`remove ${id}`),
    onChange(listener) {
      push = listener;
      return () => {};
    },
  };
  const store = createTaskStore(api, []);
  let notified = 0;
  store.subscribe(() => notified++);

  store.add("  Call mum ");
  store.add("   ");
  store.toggle("1");
  expect(calls).toEqual(["add Call mum", "toggle 1"]);

  push([{ id: "1", title: "Call mum", done: false }]);
  expect(store.getAll()).toEqual([{ id: "1", title: "Call mum", done: false }]);
  expect(notified).toBe(1);
});
